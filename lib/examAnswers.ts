/**
 * Builds the student's MCQ / essay answers for /api/exam/submit from the exam room's
 * in-memory state. Pure (tests/unit/examSession.test.ts), shared by the normal final
 * submit and the tab-switch termination (which must keep answers already given,
 * including the question currently on screen).
 */

export interface AnswerQuestion {
  id: string;
  text: string;
  options?: string[];
}

export interface MCQSubmissionItem {
  questionIndex: number;
  questionId?: string;
  questionText: string;
  selectedOptionIndex: number | null;
  selectedOptionLetter: string;
  selectedOptionText: string;
  options: string[];
}

export interface CompiledAnswers {
  mcqItems?: MCQSubmissionItem[];
  essayAnswers?: { questionId: string; text: string }[];
  /** Human-readable summary (legacy transcript text). */
  summary: string;
}

/**
 * @param essayTexts   question index -> essay text typed so far
 * @param mcqSelected  question index -> selected option index (null = none)
 * @param current      the question on screen and its not-yet-committed answer
 */
export function compileAnswers(
  questions: AnswerQuestion[],
  examType: string,
  essayTexts: Record<number, string>,
  mcqSelected: Record<number, number | null>,
  current?: { index: number; essayText?: string; selectedOption?: number | null }
): CompiledAnswers {
  const texts = { ...essayTexts };
  const selections = { ...mcqSelected };
  if (current) {
    if (current.essayText !== undefined) texts[current.index] = current.essayText;
    if (current.selectedOption !== undefined) selections[current.index] = current.selectedOption;
  }

  if (examType === 'mcq') {
    const mcqItems = questions.map((q, idx) => {
      const sel = selections[idx];
      const opts = q.options && q.options.length >= 2 ? q.options : ['', '', '', ''];
      const selIdx = Number.isInteger(sel) && (sel as number) >= 0 && (sel as number) < opts.length ? (sel as number) : null;
      const letter = selIdx !== null ? String.fromCharCode(65 + selIdx) : 'None';
      return {
        questionIndex: idx,
        questionId: q.id,
        questionText: q.text,
        selectedOptionIndex: selIdx,
        selectedOptionLetter: letter,
        selectedOptionText: selIdx !== null ? opts[selIdx] || `Option ${letter}` : 'No option selected',
        options: opts,
      };
    });
    const summary = mcqItems.map((m, i) => `Question ${i + 1} (${m.questionText}): ${m.selectedOptionText}`).join('\n\n');
    return { mcqItems, summary };
  }

  if (examType === 'essay') {
    const essayAnswers = questions.map((q, idx) => ({ questionId: q.id, text: (texts[idx] || '').trim() }));
    const summary = essayAnswers
      .map((a, i) => `Question ${i + 1} (${questions[i].text}): ${a.text || 'No written response'}`)
      .join('\n\n');
    return { essayAnswers, summary };
  }

  return { summary: '' };
}
