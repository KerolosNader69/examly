/**
 * Wrong-language detection (lib/languageCheck.ts + questionPatchFromGrade).
 * Regression for production: an English exam (wrong_language_policy "review") where a
 * student answered in Arabic. Deepgram nova-3 with language=en returned English-looking
 * text ("Oh, I see.", "Meyer Barbein."), the grader said the language matched, and the
 * answers were auto-graded 0. They must go to teacher review instead.
 * Run with: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as LanguageCheckModule from '../../lib/languageCheck';
import type * as GradingModule from '../../lib/grading';
import type * as DeepgramModule from '../../lib/deepgram';

const lc: typeof LanguageCheckModule = await import(new URL('../../lib/languageCheck.ts', import.meta.url).href);
const g: typeof GradingModule = await import(new URL('../../lib/grading.ts', import.meta.url).href);
const dg: typeof DeepgramModule = await import(new URL('../../lib/deepgram.ts', import.meta.url).href);

/** A Deepgram /v1/listen response shaped like the real one. */
const deepgram = (transcript: string, confidence: number, wordConfidences: number[], extra: Record<string, unknown> = {}) => ({
  metadata: { duration: 3.2 },
  results: {
    channels: [
      {
        ...extra,
        alternatives: [
          {
            transcript,
            confidence,
            words: transcript
              .split(/\s+/)
              .filter(Boolean)
              .map((w, i) => ({ word: w.toLowerCase(), punctuated_word: w, start: i * 0.4, end: i * 0.4 + 0.3, confidence: wordConfidences[i] ?? confidence })),
          },
        ],
      },
    ],
  },
});

/** The grader as it behaved in production: "matches" and score 0 for the garbage transcript. */
const graderReply = (o: { matches?: boolean; coherent?: boolean; score?: number } = {}) =>
  g.parseGradingResponse(
    JSON.stringify({
      answerLanguageMatches: o.matches ?? true,
      ...(o.coherent === undefined ? {} : { transcriptCoherent: o.coherent }),
      score: o.score ?? 0,
      feedback: 'The answer does not address the question.',
      breakdown: { contentScore: o.score ?? 0, fluencyScore: 40, vocabularyScore: 30, grammarScore: 50 },
    })
  )!;

/** What /transcribe + /evaluate do with one Deepgram response. */
function gradeFromDeepgram(json: unknown, grade: GradingModule.GradeResult, policy: string, language = 'en') {
  const parsed = dg.parseDeepgramResult(json);
  const sttReasons = lc.assessTranscriptLanguage({
    transcript: parsed.transcript,
    language,
    confidence: parsed.confidence,
    words: parsed.words,
    detectedLanguage: parsed.detectedLanguage,
  });
  return { sttReasons, patch: g.questionPatchFromGrade(grade, policy, language, sttReasons) };
}

const assertReview = (patch: ReturnType<typeof g.questionPatchFromGrade>) => {
  assert.equal(patch.languageMismatch, true);
  assert.equal(patch.status, 'pending_review');
  assert.equal(patch.score, null, 'no automatic 0');
  assert.equal(patch.reviewReason, 'wrong_language');
};

// ── Arabic answer in an English exam ──

test('Arabic answer in an English exam: low-confidence English-looking transcript -> review, not 0', () => {
  const { sttReasons, patch } = gradeFromDeepgram(deepgram('Oh, I see.', 0.41, [0.32, 0.55, 0.29]), graderReply(), 'review');
  assert.deepEqual(sttReasons, ['low_confidence', 'low_word_confidence']);
  assertReview(patch);
  assert.equal(patch.suggestedScore, 0);
  assert.deepEqual(patch.languageReasons, ['low_confidence', 'low_word_confidence']);
});

test('Arabic answer in an English exam: Arabic script in the transcript -> foreign_script, review', () => {
  for (const t of ['خمسة وعشرين', 'ميه اربعة واربعين']) {
    const { sttReasons, patch } = gradeFromDeepgram(deepgram(t, 0.9, [0.9, 0.9, 0.9]), graderReply(), 'review');
    assert.ok(sttReasons.includes('foreign_script'), t);
    assertReview(patch);
  }
});

test('Arabic answer in an English exam: confident nonsense flagged by the grader as incoherent -> review', () => {
  const { sttReasons, patch } = gradeFromDeepgram(deepgram('Meyer Barbein.', 0.86, [0.84, 0.88]), graderReply({ coherent: false }), 'review');
  assert.deepEqual(sttReasons, []);
  assertReview(patch);
  assert.deepEqual(patch.languageReasons, ['grader_incoherent']);
});

test('Arabic answer in an English exam: Deepgram detected_language "ar" -> review', () => {
  const { sttReasons, patch } = gradeFromDeepgram(deepgram('Meyer Barbein.', 0.9, [0.9, 0.9], { detected_language: 'ar' }), graderReply(), 'review');
  assert.deepEqual(sttReasons, ['detected_language']);
  assertReview(patch);
});

test('penalize policy: low confidence alone goes to review (never zeroed); definitive signals score 0', () => {
  const lowConf = gradeFromDeepgram(deepgram('Oh, I see.', 0.41, [0.32, 0.55, 0.29]), graderReply({ score: 30 }), 'penalize').patch;
  assertReview(lowConf);
  const script = gradeFromDeepgram(deepgram('خمسة وعشرين', 0.9, [0.9, 0.9]), graderReply({ score: 30 }), 'penalize').patch;
  assert.equal(script.status, 'graded');
  assert.equal(script.score, 0);
  assert.equal(script.languageMismatch, true);
});

// ── English answer in an English exam (must not flag) ──

test('English answer in an English exam: confident transcript -> graded normally, no mismatch', () => {
  for (const policy of ['review', 'penalize', 'ignore']) {
    const { sttReasons, patch } = gradeFromDeepgram(
      deepgram('Five times five is twenty five.', 0.97, [0.99, 0.98, 0.99, 0.97, 0.96, 0.98]),
      graderReply({ score: 95, coherent: true }),
      policy
    );
    assert.deepEqual(sttReasons, [], policy);
    assert.equal(patch.languageMismatch, false);
    assert.equal(patch.status, 'graded');
    assert.equal(patch.score, 95);
    assert.equal(patch.reviewReason, undefined);
    assert.deepEqual(patch.languageReasons, []);
  }
});

test('English answer in an English exam: names/accents and one low word do not flag; Arabic exam allows Latin terms', () => {
  assert.deepEqual(
    lc.assessTranscriptLanguage({
      transcript: 'Café au lait is from Paris, says Müller.',
      language: 'en',
      confidence: 0.88,
      words: [{ confidence: 0.9 }, { confidence: 0.3 }, { confidence: 0.95 }, { confidence: 0.9 }],
    }),
    []
  );
  assert.deepEqual(lc.assessTranscriptLanguage({ transcript: 'الجواب هو DNA في الخلية', language: 'ar', confidence: 0.9 }), []);
  assert.deepEqual(lc.assessTranscriptLanguage({ transcript: 'The answer is twenty five', language: 'ar-EG', confidence: 0.9 }), ['foreign_script']);
  assert.deepEqual(lc.assessTranscriptLanguage({ transcript: 'Twenty five', language: 'en', confidence: 0.9, detectedLanguage: 'en-US' }), []);
});

// ── Empty transcript ──

test('empty transcript: no language signals (it is "no speech", handled before grading)', () => {
  const parsed = dg.parseDeepgramResult(deepgram('', 0, []));
  assert.equal(parsed.transcript, '');
  assert.deepEqual(parsed.words, []);
  for (const transcript of ['', '   ', 'a', 'ok']) {
    assert.deepEqual(lc.assessTranscriptLanguage({ transcript, language: 'en', confidence: 0, words: parsed.words }), [], JSON.stringify(transcript));
  }
  assert.deepEqual(lc.assessTranscriptLanguage({ transcript: undefined as unknown as string, language: 'en' }), []);
});

test('parseDeepgramResult: word confidences and detected_language are extracted and clamped', () => {
  const p = dg.parseDeepgramResult(deepgram('Oh, I see.', 0.4, [0.3, 1.7, -1], { detected_language: 'ar' }));
  assert.deepEqual(p.words, [{ confidence: 0.3 }, { confidence: 1 }, { confidence: 0 }]);
  assert.equal(p.detectedLanguage, 'ar');
  assert.deepEqual(lc.mergeReasons(['low_confidence', 'bogus', 'foreign_script', 'low_confidence']), ['foreign_script', 'low_confidence']);
});
