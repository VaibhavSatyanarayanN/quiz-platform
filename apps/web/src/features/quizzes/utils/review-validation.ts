import { QuestionType } from '../types/quiz.types.ts';
import type { ReviewQuestionItem } from '../types/quiz.types.ts';

export interface ReviewValidationResult {
  isValid: boolean;
  globalError: string | null;
  questionErrors: Record<string, string[]>;
}

export function validateReviewQuestion(
  question: ReviewQuestionItem,
  index: number,
): string[] {
  const errors: string[] = [];
  const label = `Question ${index + 1}`;

  const trimmedText = (question.text ?? '').trim();
  if (!trimmedText) {
    errors.push(`${label}: Question text cannot be empty.`);
  } else if (trimmedText.length > 2000) {
    errors.push(`${label}: Question text cannot exceed 2000 characters.`);
  }

  const marks = Number(question.marks);
  if (!Number.isInteger(marks) || marks < 1 || marks > 100) {
    errors.push(`${label}: Marks must be a whole number between 1 and 100.`);
  }

  const qType = question.questionType as string;

  if (qType === 'open_ended') {
    errors.push(
      `${label}: Open-ended questions are not supported in QuizVersion assessments. Use single_choice, multiple_choice, or true_false.`,
    );
    return errors;
  }

  const options = Array.isArray(question.options) ? question.options : [];

  if (qType === QuestionType.TRUE_FALSE) {
    if (options.length !== 2) {
      errors.push(`${label}: True/False questions must have exactly 2 options (True and False).`);
    } else {
      const hasTrue = options.some((o) => o.text.trim().toLowerCase() === 'true');
      const hasFalse = options.some((o) => o.text.trim().toLowerCase() === 'false');
      if (!hasTrue || !hasFalse) {
        errors.push(`${label}: True/False options must be "True" and "False".`);
      }
      const correctCount = options.filter((o) => o.isCorrect).length;
      if (correctCount !== 1) {
        errors.push(`${label}: Exactly 1 True/False option must be marked correct.`);
      }
    }
    return errors;
  }

  if (qType === QuestionType.SINGLE_CHOICE || qType === QuestionType.MULTIPLE_CHOICE) {
    if (options.length < 2) {
      errors.push(`${label}: Choice questions must have at least 2 options.`);
    } else if (options.length > 8) {
      errors.push(`${label}: Choice questions cannot have more than 8 options.`);
    }

    const seenTexts = new Set<string>();
    options.forEach((opt, optIdx) => {
      const optText = (opt.text ?? '').trim();
      if (!optText) {
        errors.push(`${label}: Option ${optIdx + 1} text cannot be empty.`);
      } else {
        const lower = optText.toLowerCase();
        if (seenTexts.has(lower)) {
          errors.push(`${label}: Duplicate option text "${optText}" is not allowed.`);
        }
        seenTexts.add(lower);
      }
    });

    const correctCount = options.filter((o) => o.isCorrect).length;
    if (qType === QuestionType.SINGLE_CHOICE && correctCount !== 1) {
      errors.push(
        `${label}: Single-choice questions must have exactly 1 correct option (currently ${correctCount}).`,
      );
    } else if (qType === QuestionType.MULTIPLE_CHOICE && correctCount < 1) {
      errors.push(`${label}: Multiple-choice questions must have at least 1 correct option.`);
    }

    return errors;
  }

  errors.push(`${label}: Unsupported question type "${String(qType)}".`);
  return errors;
}

export function validateReviewQuestionSet(
  questions: ReviewQuestionItem[],
  requireNonEmptyForApply = false,
): ReviewValidationResult {
  const questionErrors: Record<string, string[]> = {};
  let hasErrors = false;
  let globalError: string | null = null;

  if (requireNonEmptyForApply && questions.length === 0) {
    return {
      isValid: false,
      globalError: 'At least one question is required to apply to the draft quiz version.',
      questionErrors: {},
    };
  }

  questions.forEach((q, idx) => {
    const errs = validateReviewQuestion(q, idx);
    if (errs.length > 0) {
      questionErrors[q.id] = errs;
      hasErrors = true;
    }
  });

  if (hasErrors) {
    globalError = 'Please fix the highlighted validation issues before proceeding.';
  }

  return {
    isValid: !hasErrors,
    globalError,
    questionErrors,
  };
}

export function reorderQuestions(
  questions: ReviewQuestionItem[],
  fromIndex: number,
  toIndex: number,
): ReviewQuestionItem[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= questions.length ||
    toIndex >= questions.length ||
    fromIndex === toIndex
  ) {
    return questions;
  }

  const next = [...questions];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next.map((q, idx) => ({
    ...q,
    order: idx + 1,
  }));
}

export function areQuestionSetsEqual(
  a: ReviewQuestionItem[],
  b: ReviewQuestionItem[],
): boolean {
  if (a.length !== b.length) return false;

  const normalize = (list: ReviewQuestionItem[]) =>
    list.map((q, idx) => ({
      id: q.id,
      text: (q.text ?? '').trim(),
      questionType: q.questionType,
      marks: Number(q.marks),
      order: idx + 1,
      explanation: (q.explanation ?? '').trim() || null,
      difficulty: (q.difficulty ?? '').trim().toLowerCase() || null,
      correctAnswer: (q.correctAnswer ?? '').trim() || null,
      options: (q.options ?? []).map((o, oIdx) => ({
        id: o.id,
        text: (o.text ?? '').trim(),
        isCorrect: Boolean(o.isCorrect),
        order: oIdx + 1,
      })),
    }));

  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
