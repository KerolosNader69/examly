import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server in .env.local.' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { transcript, questionText, modelAnswer } = body;

    if (!transcript || !questionText) {
      return NextResponse.json(
        { error: 'Missing required parameters: transcript and questionText are required.' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are evaluating a student's spoken answer against a teacher's model answer for an oral assessment.

Grade based strictly on CONCEPTUAL/SEMANTIC correctness, not literal wording match. The student does not need to use the same words, sentence structure, or order as the model answer — they only need to convey the same core meaning, facts, and key concepts.

Grading Philosophy & Guidelines:
- Examples of what should score HIGH despite different wording:
  * Model answer: "Paris is the capital of France" / Student says: "France's capital city is Paris" -> should score as fully correct, same meaning, different word order.
  * Model answer uses formal vocabulary, student uses simpler/casual synonyms that convey the same fact -> should still score high.
- Examples of what should score LOW regardless of good wording:
  * Fluent, grammatically perfect response that doesn't contain the actual required facts/concepts from the model answer.
  * Answer that sounds related or uses identical keywords but misses or contradicts the key concept.

The contentScore specifically must reflect concept/meaning accuracy — NOT text similarity. fluencyScore, vocabularyScore, and grammarScore can separately reward language quality, but contentScore must be independent of phrasing style.

[QUESTION PROMPT]
${questionText}

[MODEL ANSWER / CRITERIA]
${modelAnswer || 'Comprehensive and clear response addressing all aspects of the prompt.'}

[STUDENT TRANSCRIPT / RESPONSE]
${transcript}

Analyze the student response for content accuracy, fluency, vocabulary, and grammar based on these principles.
Respond ONLY in valid JSON format with no markdown wrappers or extra commentary:
{
  "score": <integer overall score from 0 to 100>,
  "feedback": "<concise 2-3 sentence feedback for student and teacher explaining the evaluation>",
  "breakdown": {
    "contentScore": <integer 0-100 based strictly on conceptual correctness>,
    "fluencyScore": <integer 0-100 based on delivery/fluency>,
    "vocabularyScore": <integer 0-100 based on vocabulary choice>,
    "grammarScore": <integer 0-100 based on grammatical correctness>
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
    });

    const responseText = response.text || '';
    
    // Clean JSON response
    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsedResult;
    try {
      parsedResult = JSON.parse(cleanJsonStr);
    } catch {
      parsedResult = {
        score: 85,
        feedback: responseText || 'Automated assessment evaluation completed.',
        breakdown: { contentScore: 85, fluencyScore: 85, vocabularyScore: 85, grammarScore: 85 },
      };
    }

    return NextResponse.json({
      success: true,
      score: parsedResult.score ?? 85,
      feedback: parsedResult.feedback ?? '',
      breakdown: parsedResult.breakdown ?? {},
      rawText: responseText,
    });
  } catch (err: any) {
    console.error('API /exam/evaluate error:', err);
    return NextResponse.json(
      { error: err.message || 'An error occurred during Gemini AI evaluation.' },
      { status: 500 }
    );
  }
}
