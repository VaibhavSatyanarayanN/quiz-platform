import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Quiz } from './entities/quiz.entity.js';
import { QuizVersion } from './entities/quiz-version.entity.js';
import { QuizStatus } from './enums/quiz-status.enum.js';
import { QuizVersionStatus } from './enums/quiz-version-status.enum.js';

import { Question } from './entities/question.entity.js';
import { Option } from './entities/option.entity.js';

import { QuestionType } from './enums/question-type.enum.js';
import type { CreateQuestionDto } from './dto/create-question.dto.js';
import { CreateBulkQuestionsDto } from './dto/create-bulk-questions.dto.js';

@Injectable()
export class QuizService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,

    @InjectRepository(QuizVersion)
    private readonly quizVersionRepository: Repository<QuizVersion>,

    private readonly dataSource: DataSource,

    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,

    @InjectRepository(Option)
    private readonly optionRepository: Repository<Option>,
  ) { }

  async createQuiz(
    title: string,
    description: string | null,
    creatorId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        const quiz = manager.create(Quiz, {
          title,
          description,
          creatorId,
          status: QuizStatus.DRAFT,
        });

        const savedQuiz = await manager.save(
          Quiz,
          quiz,
        );

        const version = manager.create(
          QuizVersion,
          {
            quizId: savedQuiz.id,
            version: 1,
            status: QuizVersionStatus.DRAFT,
          },
        );

        const savedVersion = await manager.save(
          QuizVersion,
          version,
        );

        return {
          quiz: savedQuiz,
          version: savedVersion,
        };
      },
    );
  }

  async createQuestionsBulk(
    quizId: string,
    quizVersionId: string,
    dto: CreateBulkQuestionsDto,
    creatorId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify that the quiz belongs to the creator
        const quiz = await manager.findOne(Quiz, {
          where: {
            id: quizId,
            creatorId,
          },
        });

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Verify that the version belongs to this quiz
        const version = await manager.findOne(
          QuizVersion,
          {
            where: {
              id: quizVersionId,
              quizId,
            },
          },
        );

        if (!version) {
          throw new NotFoundException(
            'Quiz version not found',
          );
        }

        // 3. Only draft versions can be modified
        if (
          version.status !== QuizVersionStatus.DRAFT
        ) {
          throw new BadRequestException(
            'Questions can only be added to a draft version',
          );
        }

        // 4. Validate the complete question set
        this.validateBulkQuestions(dto);

        // 5. Create questions
        const savedQuestions: Question[] = [];
        const savedOptions: Option[] = [];

        for (const questionDto of dto.questions) {
          const question = manager.create(Question, {
            quizVersionId: version.id,
            text: questionDto.text,
            questionType: questionDto.questionType,
            order: questionDto.order,
            marks: questionDto.marks,
          });

          const savedQuestion = await manager.save(
            Question,
            question,
          );

          savedQuestions.push(savedQuestion);

          const options = questionDto.options.map(
            (optionDto) =>
              manager.create(Option, {
                questionId: savedQuestion.id,
                text: optionDto.text,
                isCorrect: optionDto.isCorrect,
                order: optionDto.order,
              }),
          );

          const savedQuestionOptions =
            await manager.save(Option, options);

          savedOptions.push(...savedQuestionOptions);
        }

        // 7. Return the complete result
        return {
          quizId: quiz.id,
          quizVersionId: version.id,
          questions: savedQuestions,
          options: savedOptions,
        };
      },
    );
  }

  private validateBulkQuestions(
    dto: CreateBulkQuestionsDto,
  ) {
    const questionOrders = new Set<number>();

    for (const question of dto.questions) {
      // Question order must be unique
      if (questionOrders.has(question.order)) {
        throw new BadRequestException(
          `Duplicate question order: ${question.order}`,
        );
      }

      questionOrders.add(question.order);

      // Option orders must be unique within a question
      const optionOrders = new Set<number>();

      for (const option of question.options) {
        if (optionOrders.has(option.order)) {
          throw new BadRequestException(
            `Duplicate option order in question ${question.order}`,
          );
        }

        optionOrders.add(option.order);
      }

      // Question-type-specific validation
      const correctOptions =
        question.options.filter(
          (option) => option.isCorrect,
        );

      switch (question.questionType) {
        case QuestionType.SINGLE_CHOICE:
          if (correctOptions.length !== 1) {
            throw new BadRequestException(
              `Question ${question.order} must have exactly one correct option`,
            );
          }
          break;

        case QuestionType.MULTIPLE_CHOICE:
          if (correctOptions.length < 1) {
            throw new BadRequestException(
              `Question ${question.order} must have at least one correct option`,
            );
          }
          break;

        case QuestionType.TRUE_FALSE:
          if (question.options.length !== 2) {
            throw new BadRequestException(
              `Question ${question.order} must have exactly two options`,
            );
          }

          if (correctOptions.length !== 1) {
            throw new BadRequestException(
              `Question ${question.order} must have exactly one correct option`,
            );
          }
          break;
      }
    }
  }
}