import { QuestionType } from '../enums/question-type.enum.js';
import { QuizVersionStatus } from '../enums/quiz-version-status.enum.js';

export class TakerOptionResponseDto {
  id: string;
  text: string;
  order: number;
}

export class TakerQuestionResponseDto {
  id: string;
  text: string;
  questionType: QuestionType;
  order: number;
  marks: number;
  options: TakerOptionResponseDto[];
}

export class TakerQuizVersionResponseDto {
  quizId: string;
  quizVersionId: string;

  title: string;
  quizTitle: string;
  description: string | null;
  quizDescription: string | null;

  version: number;
  status: QuizVersionStatus;
  totalMarks: number;

  timeLimitSeconds: number | null;

  questions: TakerQuestionResponseDto[];
}
