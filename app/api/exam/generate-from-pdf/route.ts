import { NextResponse } from 'next/server';
import { GoogleGenAI, createPartFromBase64 } from '@google/genai';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const GEMINI_TIMEOUT_MS = 60_000; // 60 seconds

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Expected multipart/form-data with a file upload.' },
        { status: 400 }
      );
    }

    // Check Content-Length header before attempting to parse the body
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_FILE_SIZE) {
      const sizeMB = (contentLength / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `File is too large (${sizeMB} MB). Maximum allowed size is 10 MB. Try uploading a shorter document or splitting it into sections.`,
        },
        { status: 413 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (parseErr: any) {
      return NextResponse.json(
        { error: 'File is too large or could not be read. Maximum allowed size is 10 MB.' },
        { status: 413 }
      );
    }
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file was uploaded. Please select a PDF or DOCX file.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `File is too large (${sizeMB} MB). Maximum allowed size is 10 MB. Try uploading a shorter document or splitting it into sections.`,
        },
        { status: 413 }
      );
    }

    // Validate file type using magic bytes (not just extension/MIME which can be spoofed)
    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // PDF magic bytes: %PDF (0x25 0x50 0x44 0x46)
    const isPdf =
      fileBytes.length >= 4 &&
      fileBytes[0] === 0x25 &&
      fileBytes[1] === 0x50 &&
      fileBytes[2] === 0x44 &&
      fileBytes[3] === 0x46;

    // DOCX magic bytes: PK zip header (0x50 0x4B 0x03 0x04)
    const isDocx =
      fileBytes.length >= 4 &&
      fileBytes[0] === 0x50 &&
      fileBytes[1] === 0x4B &&
      fileBytes[2] === 0x03 &&
      fileBytes[3] === 0x04;

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        {
          error:
            'This file does not appear to be a valid PDF or DOCX document. Please upload a genuine PDF (.pdf) or Word (.docx) file.',
        },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert educational assessment tool. You will receive a document (either as a PDF file or as extracted text from a Word document).

Your task:
1. First, analyze whether the document contains READY-MADE exam questions (e.g. a past exam paper, a question bank, a quiz, a worksheet with numbered questions). Look for patterns like numbered questions, question marks, "Q1:", "Question 1", answer keys, multiple choice options (A/B/C/D), etc.

2. If the document DOES contain ready-made questions:
   - Extract each question stem.
   - CRITICAL FOR MULTIPLE CHOICE (MCQ) QUESTIONS:
     * "questionText": MUST contain ONLY the clean question stem (prompt text), with NO option choices (A, B, C, D) inside it.
     * "options": An array of EXACTLY 4 option strings in order [Option A text, Option B text, Option C text, Option D text]. Strip option letter prefixes like "A.", "B)", "1.", "(C)" from each choice text so only the clean choice text remains.
     * "questionType": "mcq".
     * "correctOptionLetter": The letter of the correct option if specified in the document ("A", "B", "C", or "D"), otherwise null.
     * "explanation": ONLY provide text here if the document includes an actual detailed explanation of WHY the answer is correct. If the document only states the correct answer choice (e.g. "Answer: A" or "A. Central Processing Unit") without a multi-sentence explanation, set "explanation" to "". DO NOT duplicate option text into "explanation".
   - FOR OPEN-ENDED / ESSAY / SHORT-ANSWER QUESTIONS (without options):
     * "questionText": The question prompt.
     * "options": [];
     * "questionType": "open".
     * "explanation": Model answer or criteria text.

3. If the document does NOT contain ready-made questions (it's study material, a textbook chapter, lecture notes, an article, etc.):
   - Generate 5-8 appropriate exam questions based on the content.
   - For open questions, provide a model answer in "explanation".
   - For MCQ questions, provide 4 clean option texts in "options" and set "questionType" to "mcq".

CRITICAL: Respond ONLY with valid JSON. No markdown wrappers, no extra text before or after.
The JSON must have this exact structure:
{
  "mode": "extracted" | "generated",
  "questions": [
    {
      "questionText": "Just the clean question stem (no options)",
      "questionType": "mcq" | "open",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctOptionLetter": "A" | "B" | "C" | "D" | null,
      "explanation": "Detailed explanation if present in document, otherwise empty string"
    }
  ]
}`;

    let responseText = '';

    // Helper: call Gemini with a timeout
    const callGeminiWithTimeout = async (
      model: string,
      contents: any
    ): Promise<string> => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('AI processing timed out after 60 seconds.');
          err.name = 'AbortError';
          reject(err);
        }, GEMINI_TIMEOUT_MS);
      });

      try {
        const apiPromise = ai.models.generateContent({
          model,
          contents,
        });
        const response = await Promise.race([apiPromise, timeoutPromise]);
        return response.text || '';
      } finally {
        clearTimeout(timer!);
      }
    };

    if (isPdf) {
      // PDF: Send directly to Gemini as inline data (native PDF understanding)
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const pdfPart = createPartFromBase64(base64Data, 'application/pdf');
      const pdfContents = [
        {
          role: 'user' as const,
          parts: [pdfPart, { text: systemPrompt }],
        },
      ];

      try {
        responseText = await callGeminiWithTimeout('gemini-3.6-flash', pdfContents);
      } catch (primaryErr: any) {
        if (primaryErr?.name === 'AbortError') {
          return NextResponse.json(
            { error: 'AI processing timed out after 60 seconds. Try a shorter or simpler document.' },
            { status: 504 }
          );
        }
        console.warn('Gemini 3.6 flash PDF call failed, trying gemini-2.5-flash...', primaryErr);
        try {
          responseText = await callGeminiWithTimeout('gemini-2.5-flash', pdfContents);
        } catch (fallbackErr: any) {
          if (fallbackErr?.name === 'AbortError') {
            return NextResponse.json(
              { error: 'AI processing timed out after 60 seconds. Try a shorter or simpler document.' },
              { status: 504 }
            );
          }
          throw fallbackErr;
        }
      }
    } else {
      // DOCX: Extract text with mammoth first, then send as text to Gemini
      // Gemini does NOT natively support .docx inline data — must convert to text
      let extractedText = '';
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
        extractedText = result.value;
      } catch (mammothErr) {
        console.error('Mammoth DOCX extraction error:', mammothErr);
        return NextResponse.json(
          { error: 'Failed to read the DOCX file. The file may be corrupted or password-protected.' },
          { status: 422 }
        );
      }

      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: 'The uploaded DOCX file appears to be empty or contains only images. Please upload a document with text content.' },
          { status: 422 }
        );
      }

      // Truncate extremely long text to avoid token limits (roughly 100k chars)
      const truncatedText =
        extractedText.length > 100000
          ? extractedText.slice(0, 100000) + '\n\n[Document truncated due to length]'
          : extractedText;

      const prompt = `${systemPrompt}

--- DOCUMENT CONTENT (extracted from a Word document) ---
${truncatedText}
--- END OF DOCUMENT ---`;

      try {
        responseText = await callGeminiWithTimeout('gemini-3.6-flash', prompt);
      } catch (primaryErr: any) {
        if (primaryErr?.name === 'AbortError') {
          return NextResponse.json(
            { error: 'AI processing timed out after 60 seconds. Try a shorter or simpler document.' },
            { status: 504 }
          );
        }
        console.warn('Gemini 3.6 flash DOCX text call failed, trying gemini-2.5-flash...', primaryErr);
        try {
          responseText = await callGeminiWithTimeout('gemini-2.5-flash', prompt);
        } catch (fallbackErr: any) {
          if (fallbackErr?.name === 'AbortError') {
            return NextResponse.json(
              { error: 'AI processing timed out after 60 seconds. Try a shorter or simpler document.' },
              { status: 504 }
            );
          }
          throw fallbackErr;
        }
      }
    }

    // Parse the JSON response
    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsedResult: {
      mode: string;
      questions: Array<{
        questionText: string;
        questionType?: string;
        options?: any;
        modelAnswerText: string;
      }>;
    };
    try {
      parsedResult = JSON.parse(cleanJsonStr);
    } catch {
      console.error('Failed to parse Gemini response as JSON:', responseText.substring(0, 500));
      return NextResponse.json(
        {
          error: 'AI could not process this document into a structured format. Try a different file or a shorter document.',
        },
        { status: 422 }
      );
    }

    // Validate the parsed structure
    if (!parsedResult.questions || !Array.isArray(parsedResult.questions) || parsedResult.questions.length === 0) {
      return NextResponse.json(
        {
          error: 'AI could not find or generate any questions from this document. Try uploading a document with more content.',
        },
        { status: 422 }
      );
    }

    // Sanitize and return
    const questions = parsedResult.questions
      .map((q: any) => {
        let opts: string[] | undefined = undefined;
        if (Array.isArray(q.options) && q.options.length > 0) {
          opts = q.options.map((opt: any) => {
            if (typeof opt === 'object' && opt !== null) {
              return (opt.text || opt.label || '').trim();
            }
            return String(opt || '').trim();
          });
        }

        const isMcq = q.questionType === 'mcq' || (opts && opts.some((o) => o.length > 0));

        let correctIdx = 0;
        const letterCandidate = q.correctOptionLetter ?? q.correctOptionIndex;
        if (letterCandidate !== undefined && letterCandidate !== null) {
          const str = String(letterCandidate).trim().toUpperCase();
          if (str === 'A' || str === '0') correctIdx = 0;
          else if (str === 'B' || str === '1') correctIdx = 1;
          else if (str === 'C' || str === '2') correctIdx = 2;
          else if (str === 'D' || str === '3') correctIdx = 3;
        }

        let explanationText = (q.explanation || q.modelAnswerText || '').trim();
        if (isMcq && opts) {
          const lowerExp = explanationText.toLowerCase();
          const matchesOption = opts.some(
            (opt) => opt.length > 0 && lowerExp.includes(opt.toLowerCase())
          );
          const isShortDecl =
            /^(answer:?\s*)?([a-d])[\.\)\:]?\s*/i.test(explanationText) &&
            explanationText.length < 50;

          if (isShortDecl || (matchesOption && explanationText.length < 60)) {
            explanationText = ''; // Clear option repetition from explanation field
          }
        }

        return {
          questionText: (q.questionText || '').trim(),
          questionType: isMcq ? ('mcq' as const) : ('open' as const),
          options: isMcq && opts ? opts : undefined,
          correctOptionIndex: correctIdx,
          modelAnswerText: explanationText,
        };
      })
      .filter((q) => q.questionText.length > 0);

    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'AI returned questions with empty text. Try a different document.' },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      mode: parsedResult.mode || 'generated',
      questions,
      rawText: responseText,
    });
  } catch (err: any) {
    console.error('API /exam/generate-from-pdf exception:', err);
    // Don't leak raw API error JSON to the user
    const friendlyMessage =
      'AI could not process this document. The file may be corrupted, empty, or in an unsupported format. Please try a different PDF or DOCX file.';
    return NextResponse.json(
      { error: friendlyMessage },
      { status: 500 }
    );
  }
}
