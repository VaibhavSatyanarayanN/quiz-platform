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
import { BulkSaveQuestionsDto } from './dto/bulk-save-questions.dto.js';
import { QuizAttempt } from './entities/quiz-attempt.entity.js';
import { AttemptStatus } from './enums/attempt-status.enum.js';
import { SaveAnswerDto } from './entities/save-answer.dto.js';
import { Answer } from './entities/answer.entity.js';
import { AnswerOption } from './entities/answer-option.entity.js';

import {
  AttemptOptionResponseDto,
  AttemptQuestionResponseDto,
  AttemptResponseDto,
} from './dto/attempt-response.dto.js';

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

  async saveQuestionsBulk(
    quizId: string,
    quizVersionId: string,
    dto: BulkSaveQuestionsDto,
    creatorId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership
        const quiz = await manager.findOne(Quiz, {
          where: {
            id: quizId,
            creatorId,
          },
        });

        if (!quiz) {
          throw new NotFoundException('Quiz not found');
        }

        // 2. Verify version belongs to this quiz
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
            'Questions can only be modified in a draft version',
          );
        }

        // 4. Validate the complete payload
        this.validateBulkQuestions(dto);

        // 5. Load existing questions
        const existingQuestions =
          await manager.find(Question, {
            where: {
              quizVersionId: version.id,
            },
          });

        const existingQuestionIds =
          new Set(
            existingQuestions.map(
              (question) => question.id,
            ),
          );

        const incomingQuestionIds =
          new Set(
            dto.questions
              .filter((question) => question.id)
              .map((question) => question.id!),
          );

        // 6. Delete questions removed from payload
        const questionsToDelete =
          existingQuestions.filter(
            (question) =>
              !incomingQuestionIds.has(question.id),
          );

        for (const question of questionsToDelete) {
          await manager.delete(Option, {
            questionId: question.id,
          });

          await manager.delete(Question, {
            id: question.id,
          });
        }

        // 7. Temporarily move existing question orders
        //    to avoid unique constraint conflicts during reorder
        const orderOffset =
          existingQuestions.length +
          dto.questions.length +
          1000;

        for (const question of existingQuestions) {
          if (
            incomingQuestionIds.has(question.id)
          ) {
            question.order += orderOffset;

            await manager.save(
              Question,
              question,
            );
          }
        }

        const savedQuestions: Question[] = [];

        const questionMap = new Map<
          string,
          Question
        >();

        // 8. Create/update questions
        for (const questionDto of dto.questions) {
          let question: Question;

          if (questionDto.id) {
            if (
              !existingQuestionIds.has(
                questionDto.id,
              )
            ) {
              throw new BadRequestException(
                `Question ${questionDto.id} does not belong to this quiz version`,
              );
            }

            question =
              existingQuestions.find(
                (item) =>
                  item.id === questionDto.id,
              )!;

            question.text = questionDto.text;
            question.questionType =
              questionDto.questionType;
            question.order =
              questionDto.order;
            question.marks =
              questionDto.marks;
          } else {
            question = manager.create(
              Question,
              {
                quizVersionId: version.id,
                text: questionDto.text,
                questionType:
                  questionDto.questionType,
                order: questionDto.order,
                marks: questionDto.marks,
              },
            );
          }

          const savedQuestion =
            await manager.save(
              Question,
              question,
            );

          savedQuestions.push(savedQuestion);

          const questionKey =
            questionDto.id ?? `new-${questionDto.order}`;

          questionMap.set(
            questionKey,
            savedQuestion,
          );
        }

        // 9. Process options for every question
        for (const questionDto of dto.questions) {
          const questionKey =
            questionDto.id ?? `new-${questionDto.order}`;

          const savedQuestion =
            questionMap.get(questionKey);

          if (!savedQuestion) {
            throw new BadRequestException(
              'Unable to resolve saved question',
            );
          }

          // Load existing options
          const existingOptions =
            await manager.find(Option, {
              where: {
                questionId: savedQuestion.id,
              },
            });

          const existingOptionIds = new Set(
            existingOptions.map(
              (option) => option.id,
            ),
          );

          const incomingOptionIds = new Set(
            questionDto.options
              .filter((option) => option.id)
              .map((option) => option.id!),
          );

          // Delete removed options
          const optionsToDelete =
            existingOptions.filter(
              (option) =>
                !incomingOptionIds.has(option.id),
            );

          for (const option of optionsToDelete) {
            await manager.delete(Option, {
              id: option.id,
            });
          }

          // Temporarily shift option orders
          const optionOrderOffset =
            existingOptions.length +
            questionDto.options.length +
            1000;

          for (const option of existingOptions) {
            if (incomingOptionIds.has(option.id)) {
              option.order += optionOrderOffset;

              await manager.save(
                Option,
                option,
              );
            }
          }

          // Create/update options
          for (const optionDto of questionDto.options) {
            let option: Option;

            if (optionDto.id) {
              if (
                !existingOptionIds.has(
                  optionDto.id,
                )
              ) {
                throw new BadRequestException(
                  `Option ${optionDto.id} does not belong to question ${savedQuestion.id}`,
                );
              }

              option =
                existingOptions.find(
                  (item) =>
                    item.id === optionDto.id,
                )!;

              option.text = optionDto.text;
              option.isCorrect =
                optionDto.isCorrect;
              option.order =
                optionDto.order;
            } else {
              option = manager.create(
                Option,
                {
                  questionId: savedQuestion.id,
                  text: optionDto.text,
                  isCorrect: optionDto.isCorrect,
                  order: optionDto.order,
                },
              );
            }

            await manager.save(
              Option,
              option,
            );
          }
        }

        return {
          quizId: quiz.id,
          quizVersionId: version.id,
          questions: savedQuestions,
        };
      },
    );
  }

  private validateBulkQuestions(
    dto: BulkSaveQuestionsDto,
  ) {
    const questionOrders = new Set<number>();
    const questionIds = new Set<string>();
    const optionIds = new Set<string>();

    for (const question of dto.questions) {
      // Question ID must not appear twice
      if (question.id) {
        if (questionIds.has(question.id)) {
          throw new BadRequestException(
            `Duplicate question ID: ${question.id}`,
          );
        }

        questionIds.add(question.id);
      }

      // Question order must be unique
      if (questionOrders.has(question.order)) {
        throw new BadRequestException(
          `Duplicate question order: ${question.order}`,
        );
      }

      questionOrders.add(question.order);

      // Validate options
      const optionOrders = new Set<number>();

      for (const option of question.options) {
        // Option ID must not appear twice
        if (option.id) {
          if (optionIds.has(option.id)) {
            throw new BadRequestException(
              `Duplicate option ID: ${option.id}`,
            );
          }

          optionIds.add(option.id);
        }

        // Option order must be unique
        if (optionOrders.has(option.order)) {
          throw new BadRequestException(
            `Duplicate option order in question ${question.order}`,
          );
        }

        optionOrders.add(option.order);
      }

      // Validate correct-answer rules
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

  async publishVersion(
    quizId: string,
    quizVersionId: string,
    creatorId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership
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

        // 2. Verify version belongs to quiz
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

        // 3. Version must be draft
        if (
          version.status !== QuizVersionStatus.DRAFT
        ) {
          throw new BadRequestException(
            'Only draft versions can be published',
          );
        }

        // 4. Load questions
        const questions =
          await manager.find(Question, {
            where: {
              quizVersionId: version.id,
            },
          });

        if (questions.length === 0) {
          throw new BadRequestException(
            'Cannot publish a quiz without questions',
          );
        }

        // 5. Validate that every question has options
        for (const question of questions) {
          const options =
            await manager.find(Option, {
              where: {
                questionId: question.id,
              },
            });

          if (options.length === 0) {
            throw new BadRequestException(
              `Question ${question.order} has no options`,
            );
          }
        }

        // 6. Publish version
        version.status =
          QuizVersionStatus.PUBLISHED;

        version.publishedAt = new Date();

        const publishedVersion =
          await manager.save(
            QuizVersion,
            version,
          );

        // 7. Mark quiz as published
        quiz.status = QuizStatus.PUBLISHED;

        await manager.save(
          Quiz,
          quiz,
        );

        return {
          quizId: quiz.id,
          quizVersionId: publishedVersion.id,
          version: publishedVersion.version,
          status: publishedVersion.status,
          publishedAt:
            publishedVersion.publishedAt,
        };
      },
    );
  }

  async createNewVersion(
    quizId: string,
    creatorId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership
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

        // 2. Find the latest version
        const latestVersion =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                quizId: quiz.id,
              },
              order: {
                version: 'DESC',
              },
            },
          );

        if (!latestVersion) {
          throw new NotFoundException(
            'Quiz version not found',
          );
        }

        // 3. Only create a new version
        //    from a published version
        if (
          latestVersion.status !==
          QuizVersionStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            'A new version can only be created from a published version',
          );
        }

        // 4. Create the new version
        const newVersion = manager.create(
          QuizVersion,
          {
            quizId: quiz.id,
            version:
              latestVersion.version + 1,
            status:
              QuizVersionStatus.DRAFT,
          },
        );

        const savedVersion =
          await manager.save(
            QuizVersion,
            newVersion,
          );

        // 5. Load questions from previous version
        const previousQuestions =
          await manager.find(Question, {
            where: {
              quizVersionId:
                latestVersion.id,
            },
            order: {
              order: 'ASC',
            },
          });

        // 6. Copy questions + options
        for (const previousQuestion of previousQuestions) {
          const newQuestion =
            manager.create(Question, {
              quizVersionId:
                savedVersion.id,
              text: previousQuestion.text,
              questionType:
                previousQuestion.questionType,
              order: previousQuestion.order,
              marks: previousQuestion.marks,
            });

          const savedQuestion =
            await manager.save(
              Question,
              newQuestion,
            );

          const previousOptions =
            await manager.find(Option, {
              where: {
                questionId:
                  previousQuestion.id,
              },
              order: {
                order: 'ASC',
              },
            });

          for (const previousOption of previousOptions) {
            const newOption =
              manager.create(Option, {
                questionId:
                  savedQuestion.id,
                text: previousOption.text,
                isCorrect:
                  previousOption.isCorrect,
                order: previousOption.order,
              });

            await manager.save(
              Option,
              newOption,
            );
          }
        }

        return {
          quizId: quiz.id,
          previousVersionId:
            latestVersion.id,
          version: savedVersion,
        };
      },
    );
  }

  async startAttempt(
    quizId: string,
    quizVersionId: string,
    userId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz exists
        const quiz = await manager.findOne(Quiz, {
          where: {
            id: quizId,
          },
        });

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Verify version belongs to quiz
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

        // 3. Only published versions can be attempted
        if (
          version.status !==
          QuizVersionStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            'Only published quiz versions can be attempted',
          );
        }

        const existingAttempt = await manager.findOne(
          QuizAttempt,
          {
            where: {
              userId,
              quizVersionId: version.id,
              status: AttemptStatus.IN_PROGRESS,
            },
          },
        );

        if (existingAttempt) {
          return {
            id: existingAttempt.id,
            quizId: existingAttempt.quizId,
            quizVersionId: existingAttempt.quizVersionId,
            status: existingAttempt.status,
            startedAt: existingAttempt.startedAt,
          };
        }

        // 4. Create attempt
        const attempt = manager.create(
          QuizAttempt,
          {
            userId,
            quizId: quiz.id,
            quizVersionId: version.id,
            status:
              AttemptStatus.IN_PROGRESS,
            startedAt: new Date(),
          },
        );

        const savedAttempt =
          await manager.save(
            QuizAttempt,
            attempt,
          );

        return {
          id: savedAttempt.id,
          quizId: savedAttempt.quizId,
          quizVersionId:
            savedAttempt.quizVersionId,
          status: savedAttempt.status,
          startedAt:
            savedAttempt.startedAt,
        };
      },
    );
  }

  async saveAnswer(
    attemptId: string,
    questionId: string,
    dto: SaveAnswerDto,
    userId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Find the attempt belonging to the current user
        const attempt = await manager.findOne(
          QuizAttempt,
          {
            where: {
              id: attemptId,
              userId,
            },
          },
        );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        // 2. Only an in-progress attempt can be answered
        if (
          attempt.status !==
          AttemptStatus.IN_PROGRESS
        ) {
          throw new BadRequestException(
            'Answers can only be saved for an in-progress attempt',
          );
        }

        // 3. Verify question belongs to the attempt's version
        const question = await manager.findOne(
          Question,
          {
            where: {
              id: questionId,
              quizVersionId:
                attempt.quizVersionId,
            },
          },
        );

        if (!question) {
          throw new NotFoundException(
            'Question not found',
          );
        }

        // 4. Remove duplicate option IDs
        const uniqueOptionIds = [
          ...new Set(dto.optionIds),
        ];

        // 5. Load the selected options
        const options = await manager.find(
          Option,
          {
            where: uniqueOptionIds.map(
              (optionId) => ({
                id: optionId,
                questionId: question.id,
              }),
            ),
          },
        );

        // 6. Every submitted option must belong
        //    to this question
        if (
          options.length !==
          uniqueOptionIds.length
        ) {
          throw new BadRequestException(
            'One or more selected options do not belong to this question',
          );
        }

        // 7. Validate number of selected options
        if (
          question.questionType ===
          QuestionType.SINGLE_CHOICE &&
          uniqueOptionIds.length !== 1
        ) {
          throw new BadRequestException(
            'Single-choice questions require exactly one option',
          );
        }

        if (
          question.questionType ===
          QuestionType.TRUE_FALSE &&
          uniqueOptionIds.length !== 1
        ) {
          throw new BadRequestException(
            'True/false questions require exactly one option',
          );
        }

        if (
          question.questionType ===
          QuestionType.MULTIPLE_CHOICE &&
          uniqueOptionIds.length < 1
        ) {
          throw new BadRequestException(
            'Multiple-choice questions require at least one option',
          );
        }

        // 8. Find existing answer
        let answer = await manager.findOne(
          Answer,
          {
            where: {
              attemptId: attempt.id,
              questionId: question.id,
            },
          },
        );

        // 9. Create answer if it doesn't exist
        if (!answer) {
          answer = manager.create(Answer, {
            attemptId: attempt.id,
            questionId: question.id,
            answeredAt: new Date(),
          });

          answer = await manager.save(
            Answer,
            answer,
          );
        } else {
          answer.answeredAt = new Date();

          answer = await manager.save(
            Answer,
            answer,
          );
        }

        // 10. Remove previously selected options
        await manager.delete(AnswerOption, {
          answerId: answer.id,
        });

        // 11. Save the new selected options
        const answerOptions = uniqueOptionIds.map(
          (optionId) =>
            manager.create(AnswerOption, {
              answerId: answer.id,
              optionId,
            }),
        );

        await manager.save(
          AnswerOption,
          answerOptions,
        );

        return {
          answerId: answer.id,
          attemptId: attempt.id,
          questionId: question.id,
          optionIds: uniqueOptionIds,
          answeredAt: answer.answeredAt,
        };
      },
    );
  }

  async submitAttempt(
    attemptId: string,
    userId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        // 1. Find the attempt belonging to the current user
        const attempt = await manager.findOne(
          QuizAttempt,
          {
            where: {
              id: attemptId,
              userId,
            },
          },
        );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        // 2. Attempt must still be in progress
        if (
          attempt.status !==
          AttemptStatus.IN_PROGRESS
        ) {
          throw new BadRequestException(
            'Only an in-progress attempt can be submitted',
          );
        }

        // 3. Load all questions from the exact quiz version
        const questions =
          await manager.find(Question, {
            where: {
              quizVersionId:
                attempt.quizVersionId,
            },
            order: {
              order: 'ASC',
            },
          });

        if (questions.length === 0) {
          throw new BadRequestException(
            'Quiz version has no questions',
          );
        }

        // 4. Load all answers for this attempt
        const answers =
          await manager.find(Answer, {
            where: {
              attemptId: attempt.id,
            },
          });

        // 5. Load selected options for those answers
        const answerOptions =
          answers.length > 0
            ? await manager.find(
              AnswerOption,
              {
                where: answers.map(
                  (answer) => ({
                    answerId: answer.id,
                  }),
                ),
              },
            )
            : [];

        // Evaluation will be added next
        let score = 0;
        let correctAnswers = 0;
        let wrongAnswers = 0;
        let unanswered = 0;

        const answerMap = new Map(
          answers.map((answer) => [
            answer.questionId,
            answer,
          ]),
        );

        const answerOptionMap = new Map<
          string,
          string[]
        >();

        for (const answer of answers) {
          const selectedOptionIds =
            answerOptions
              .filter(
                (answerOption) =>
                  answerOption.answerId === answer.id,
              )
              .map(
                (answerOption) =>
                  answerOption.optionId,
              );

          answerOptionMap.set(
            answer.id,
            selectedOptionIds,
          );
        }

        for (const question of questions) {
          const answer = answerMap.get(
            question.id,
          );

          // No answer submitted
          if (!answer) {
            unanswered++;
            continue;
          }

          const selectedOptionIds =
            answerOptionMap.get(answer.id) ?? [];

          // Load the correct options
          const correctOptions =
            await manager.find(Option, {
              where: {
                questionId: question.id,
                isCorrect: true,
              },
            });

          const correctOptionIds =
            correctOptions.map(
              (option) => option.id,
            );

          // Compare selected and correct options
          const selectedSet = new Set(
            selectedOptionIds,
          );

          const correctSet = new Set(
            correctOptionIds,
          );

          const sameLength =
            selectedSet.size === correctSet.size;

          const sameOptions =
            [...selectedSet].every((optionId) =>
              correctSet.has(optionId),
            );

          if (
            sameLength &&
            sameOptions
          ) {
            correctAnswers++;
            score += question.marks;
          } else {
            wrongAnswers++;
          }
        }

        const totalMarks =
          questions.reduce(
            (total, question) =>
              total + question.marks,
            0,
          );

        const percentage =
          totalMarks > 0
            ? Number(
              (
                (score / totalMarks) *
                100
              ).toFixed(2),
            )
            : 0;

        attempt.status =
          AttemptStatus.SUBMITTED;

        attempt.submittedAt = new Date();
        attempt.score = score;
        attempt.correctAnswers =
          correctAnswers;
        attempt.wrongAnswers =
          wrongAnswers;
        attempt.unanswered =
          unanswered;
        attempt.percentage =
          percentage;

        const submittedAttempt =
          await manager.save(
            QuizAttempt,
            attempt,
          );

        return {
          attemptId: submittedAttempt.id,
          status: submittedAttempt.status,
          score: submittedAttempt.score,
          totalMarks,
          correctAnswers:
            submittedAttempt.correctAnswers,
          wrongAnswers:
            submittedAttempt.wrongAnswers,
          unanswered:
            submittedAttempt.unanswered,
          percentage:
            submittedAttempt.percentage,
          submittedAt:
            submittedAttempt.submittedAt,
        };
      },
    );
  }

  async getAttempt(
    attemptId: string,
    userId: string,
  ): Promise<AttemptResponseDto> {
    return this.dataSource.transaction(
      async (manager) => {
        const attempt =
          await manager.findOne(
            QuizAttempt,
            {
              where: {
                id: attemptId,
                userId,
              },
            },
          );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        const questions =
          await manager.find(Question, {
            where: {
              quizVersionId:
                attempt.quizVersionId,
            },
            order: {
              order: 'ASC',
            },
          });

        const answers =
          await manager.find(Answer, {
            where: {
              attemptId: attempt.id,
            },
          });

        const answerIds: string[] =
          answers.map(
            (answer: Answer) =>
              answer.id,
          );

        const answerOptions: AnswerOption[] =
          answerIds.length > 0
            ? await manager.find(
              AnswerOption,
              {
                where: answerIds.map(
                  (
                    answerId: string,
                  ) => ({
                    answerId,
                  }),
                ),
              },
            )
            : [];

        const selectedOptionsMap =
          new Map<
            string,
            string[]
          >();

        for (
          const answer of answers
        ) {
          const selectedOptionIds: string[] =
            answerOptions
              .filter(
                (
                  answerOption: AnswerOption,
                ) =>
                  answerOption.answerId ===
                  answer.id,
              )
              .map(
                (
                  answerOption: AnswerOption,
                ) =>
                  answerOption.optionId,
              );

          selectedOptionsMap.set(
            answer.questionId,
            selectedOptionIds,
          );
        }

        const result: AttemptQuestionResponseDto[] = [];

        for (
          const question of questions
        ) {
          const options: Option[] =
            await manager.find(
              Option,
              {
                where: {
                  questionId:
                    question.id,
                },
                order: {
                  order: 'ASC',
                },
              },
            );

          result.push({
            id: question.id,
            text: question.text,
            questionType:
              question.questionType,
            order: question.order,
            marks: question.marks,

            options: options.map(
              (
                option: Option,
              ) => ({
                id: option.id,
                text: option.text,
                order: option.order,
              }),
            ),

            selectedOptionIds:
              selectedOptionsMap.get(
                question.id,
              ) ?? [],
          });
        }

        return {
          attemptId: attempt.id,
          quizId: attempt.quizId,
          quizVersionId:
            attempt.quizVersionId,
          status: attempt.status,
          startedAt: attempt.startedAt,
          submittedAt:
            attempt.submittedAt,
          score: attempt.score,
          correctAnswers:
            attempt.correctAnswers,
          wrongAnswers:
            attempt.wrongAnswers,
          unanswered:
            attempt.unanswered,
          percentage:
            attempt.percentage,
          questions: result,
        };
      },
    );
  }

  async getAttemptResult(
    attemptId: string,
    userId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        const attempt =
          await manager.findOne(
            QuizAttempt,
            {
              where: {
                id: attemptId,
                userId,
              },
            },
          );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        if (
          attempt.status !==
          AttemptStatus.SUBMITTED
        ) {
          throw new BadRequestException(
            'Result is available only after the attempt is submitted',
          );
        }

        return {
          attemptId: attempt.id,
          quizId: attempt.quizId,
          quizVersionId:
            attempt.quizVersionId,
          status: attempt.status,
          score: attempt.score,
          correctAnswers:
            attempt.correctAnswers,
          wrongAnswers:
            attempt.wrongAnswers,
          unanswered:
            attempt.unanswered,
          percentage:
            attempt.percentage,
          startedAt:
            attempt.startedAt,
          submittedAt:
            attempt.submittedAt,
        };
      },
    );
  }
}