import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      console.warn('DEEPGRAM_API_KEY is not configured on server in .env.local.');
      return NextResponse.json({
        success: true,
        transcript: '',
        confidence: 0,
        languageUsed: 'en',
        modelUsed: 'none',
      });
    }

    const urlParams = new URL(request.url).searchParams;
    let language = urlParams.get('language') || 'ar';

    const contentType = request.headers.get('content-type') || '';
    let audioBuffer: Buffer;
    let mimeType = 'audio/wav';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('audio') as File | null;
      const langForm = formData.get('language') as string | null;
      if (langForm) {
        language = langForm;
      }
      if (!file) {
        return NextResponse.json({
          success: true,
          transcript: '',
          confidence: 0,
        });
      }
      if (file.type) {
        mimeType = file.type;
      }
      const arrayBuffer = await file.arrayBuffer();
      audioBuffer = Buffer.from(arrayBuffer);
    } else {
      const body = await request.json();
      if (!body.audioBase64) {
        return NextResponse.json({
          success: true,
          transcript: '',
          confidence: 0,
        });
      }
      audioBuffer = Buffer.from(body.audioBase64, 'base64');
      if (body.mimeType) {
        mimeType = body.mimeType;
      }
      if (body.language) {
        language = body.language;
      }
    }

    // Attempt Nova-3 first with specified language
    let dgUrl = `https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`;

    let deepgramResponse = await fetch(dgUrl, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeType,
      },
      body: new Uint8Array(audioBuffer),
    });

    // Fallback to nova-2 if nova-3 is unavailable
    if (!deepgramResponse.ok && deepgramResponse.status !== 401 && deepgramResponse.status !== 403) {
      console.warn(`Nova-3 call returned status ${deepgramResponse.status}, retrying with nova-2...`);
      dgUrl = `https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`;
      deepgramResponse = await fetch(dgUrl, {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': mimeType,
        },
        body: new Uint8Array(audioBuffer),
      });
    }

    if (!deepgramResponse.ok) {
      const errText = await deepgramResponse.text();
      console.error('Deepgram API HTTP Error:', deepgramResponse.status, errText);
      return NextResponse.json({
        success: true,
        transcript: '',
        confidence: 0,
        error: `Deepgram API error (${deepgramResponse.status})`,
      });
    }

    const result = await deepgramResponse.json();

    const transcript =
      result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const confidence =
      result?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    return NextResponse.json({
      success: true,
      transcript,
      confidence,
      languageUsed: language,
      modelUsed: result?.metadata?.model_info ? Object.values(result.metadata.model_info)[0] : 'nova-3',
      raw: result,
    });
  } catch (err: any) {
    console.error('API /exam/transcribe exception:', err);
    return NextResponse.json({
      success: true,
      transcript: '',
      confidence: 0,
    });
  }
}
