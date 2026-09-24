import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { OrganizationService } from '../organizations/organization.service.js';

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
import { AttemptResultResponseDto } from './dto/attempt-result-response.dto.js';
import {
  AttemptHistoryItemDto,
  AttemptHistoryResponseDto,
} from './dto/attempt-history.dto.js';

import { AttemptHistoryQueryDto } from './dto/attempt-history-query.dto.js';
import { CreatorQuizListItemDto, CreatorQuizListResponseDto } from './dto/creator-quiz-list.dto.js';
import { CreatorOptionResponseDto, CreatorQuestionResponseDto, CreatorQuizDetailsResponseDto, CreatorQuizVersionResponseDto } from './dto/creator-quiz-details.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { QuizResponseDto } from './dto/quiz-response.dto.js';
import { QuizVersionResponseDto } from './dto/version-response.dto.js';
import { TakerOptionResponseDto, TakerQuestionResponseDto, TakerQuizVersionResponseDto } from './dto/taker-quiz-response.dto.js';

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

    @InjectRepository(QuizAttempt)
    private readonly quizAttemptRepository: Repository<QuizAttempt>,

    private readonly organizationService: OrganizationService,
  ) { }

  private async getCreatorOrganizationId(creatorId: string): Promise<string | null> {
    const membership = await this.organizationService.getPrimaryMembership(creatorId);
    return membership?.organizationId ?? null;
  }

  async createQuiz(
    title: string,
    description: string | null,
    timeLimitSeconds: number | null,
    creatorId: string,
  ) {
    const organizationId = await this.getCreatorOrganizationId(creatorId);

    return this.dataSource.transaction(async (manager) => {
      const quiz = manager.create(Quiz, {
        title,
        description,
        creatorId,
        organizationId,
        status: QuizStatus.DRAFT,
      });

      const savedQuiz = await manager.save(
        Quiz,
        quiz,
      );

      const version = manager.create(QuizVersion, {
        quizId: savedQuiz.id,
        version: 1,
        status: QuizVersionStatus.DRAFT,
        timeLimitSeconds,
      });

      const savedVersion = await manager.save(
        QuizVersion,
        version,
      );

      return {
        quizId: savedQuiz.id,
        quizVersionId: savedVersion.id,
        version: savedVersion.version,
        status: savedVersion.status,
        timeLimitSeconds:
          savedVersion.timeLimitSeconds,
      };
    });
  }

  async saveQuestionsBulk(
    quizId: string,
    quizVersionId: string,
    dto: BulkSaveQuestionsDto,
    creatorId: string,
  ) {
    const organizationId = await this.getCreatorOrganizationId(creatorId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership
        const quiz = await manager.findOne(
          Quiz,
          {
            where: {
              id: quizId,
              creatorId,
              organizationId: organizationId === null ? IsNull() : organizationId,
            },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Verify version belongs
        //    to this quiz
        const version =
          await manager.findOne(
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

        // 3. Only draft versions
        //    can be modified
        if (
          version.status !==
          QuizVersionStatus.DRAFT
        ) {
          throw new BadRequestException(
            'Questions can only be modified in a draft version',
          );
        }

        // 4. Validate payload
        this.validateBulkQuestions(dto);

        // 5. Load existing questions
        const existingQuestions =
          await manager.find(
            Question,
            {
              where: {
                quizVersionId:
                  version.id,
              },
            },
          );

        const existingQuestionIds =
          new Set(
            existingQuestions.map(
              (
                question,
              ) => question.id,
            ),
          );

        const incomingQuestionIds =
          new Set(
            dto.questions
              .filter(
                (question) =>
                  question.id,
              )
              .map(
                (question) =>
                  question.id!,
              ),
          );

        // 6. Validate that every
        //    supplied question ID belongs
        //    to this version
        for (
          const question of dto.questions
        ) {
          if (
            question.id &&
            !existingQuestionIds.has(
              question.id,
            )
          ) {
            throw new BadRequestException(
              `Question ${question.id} does not belong to this quiz version`,
            );
          }
        }

        // 7. Delete questions removed
        //    from the payload
        const questionsToDelete =
          existingQuestions.filter(
            (question) =>
              !incomingQuestionIds.has(
                question.id,
              ),
          );

        for (
          const question of
          questionsToDelete
        ) {
          await manager.delete(
            Option,
            {
              questionId:
                question.id,
            },
          );

          await manager.delete(
            Question,
            {
              id: question.id,
            },
          );
        }

        // 8. Temporarily move existing
        //    question orders
        //
        // This prevents conflicts with
        // the unique (quizVersionId, order)
        // constraint while reordering.
        const orderOffset =
          existingQuestions.length +
          dto.questions.length +
          1000;

        for (
          const question of
          existingQuestions
        ) {
          if (
            incomingQuestionIds.has(
              question.id,
            )
          ) {
            question.order +=
              orderOffset;

            await manager.save(
              Question,
              question,
            );
          }
        }

        const savedQuestions: Question[] =
          [];

        const questionMap =
          new Map<
            string,
            Question
          >();

        // 9. Create/update questions
        //
        // IMPORTANT:
        // Array position becomes
        // the authoritative order.
        for (
          let index = 0;
          index < dto.questions.length;
          index++
        ) {
          const questionDto =
            dto.questions[index];

          const normalizedOrder =
            index + 1;

          let question: Question;

          if (questionDto.id) {
            question =
              existingQuestions.find(
                (
                  item,
                ) =>
                  item.id ===
                  questionDto.id,
              )!;

            question.text =
              questionDto.text;

            question.questionType =
              questionDto.questionType;

            question.order =
              normalizedOrder;

            question.marks =
              questionDto.marks;
          } else {
            question =
              manager.create(
                Question,
                {
                  quizVersionId:
                    version.id,

                  text:
                    questionDto.text,

                  questionType:
                    questionDto.questionType,

                  order:
                    normalizedOrder,

                  marks:
                    questionDto.marks,
                },
              );
          }

          const savedQuestion =
            await manager.save(
              Question,
              question,
            );

          savedQuestions.push(
            savedQuestion,
          );

          const questionKey =
            questionDto.id ??
            `new-${index}`;

          questionMap.set(
            questionKey,
            savedQuestion,
          );
        }

        // 10. Process options
        for (
          let questionIndex = 0;
          questionIndex <
          dto.questions.length;
          questionIndex++
        ) {
          const questionDto =
            dto.questions[
            questionIndex
            ];

          const questionKey =
            questionDto.id ??
            `new-${questionIndex}`;

          const savedQuestion =
            questionMap.get(
              questionKey,
            );

          if (!savedQuestion) {
            throw new BadRequestException(
              'Unable to resolve saved question',
            );
          }

          // Load existing options
          const existingOptions =
            await manager.find(
              Option,
              {
                where: {
                  questionId:
                    savedQuestion.id,
                },
              },
            );

          const existingOptionIds =
            new Set(
              existingOptions.map(
                (
                  option,
                ) => option.id,
              ),
            );

          const incomingOptionIds =
            new Set(
              questionDto.options
                .filter(
                  (option) =>
                    option.id,
                )
                .map(
                  (option) =>
                    option.id!,
                ),
            );

          // Validate option ownership
          for (
            const option of
            questionDto.options
          ) {
            if (
              option.id &&
              !existingOptionIds.has(
                option.id,
              )
            ) {
              throw new BadRequestException(
                `Option ${option.id} does not belong to question ${savedQuestion.id}`,
              );
            }
          }

          // Delete removed options
          const optionsToDelete =
            existingOptions.filter(
              (option) =>
                !incomingOptionIds.has(
                  option.id,
                ),
            );

          for (
            const option of
            optionsToDelete
          ) {
            await manager.delete(
              Option,
              {
                id: option.id,
              },
            );
          }

          // Temporarily move existing
          // option orders
          const optionOrderOffset =
            existingOptions.length +
            questionDto.options.length +
            1000;

          for (
            const option of
            existingOptions
          ) {
            if (
              incomingOptionIds.has(
                option.id,
              )
            ) {
              option.order +=
                optionOrderOffset;

              await manager.save(
                Option,
                option,
              );
            }
          }

          // Create/update options
          //
          // Array position becomes
          // the authoritative order.
          for (
            let optionIndex = 0;
            optionIndex <
            questionDto.options.length;
            optionIndex++
          ) {
            const optionDto =
              questionDto.options[
              optionIndex
              ];

            const normalizedOrder =
              optionIndex + 1;

            let option: Option;

            if (optionDto.id) {
              option =
                existingOptions.find(
                  (
                    item,
                  ) =>
                    item.id ===
                    optionDto.id,
                )!;

              option.text =
                optionDto.text;

              option.isCorrect =
                optionDto.isCorrect;

              option.order =
                normalizedOrder;
            } else {
              option =
                manager.create(
                  Option,
                  {
                    questionId:
                      savedQuestion.id,

                    text:
                      optionDto.text,

                    isCorrect:
                      optionDto.isCorrect,

                    order:
                      normalizedOrder,
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
          quizVersionId:
            version.id,
          questions:
            savedQuestions,
        };
      },
    );
  }

  private validateBulkQuestions(
    dto: BulkSaveQuestionsDto,
  ): void {
    const questionIds = new Set<string>();
    const optionIds = new Set<string>();

    for (
      const question of dto.questions
    ) {
      // Validate question IDs
      if (question.id) {
        if (
          questionIds.has(question.id)
        ) {
          throw new BadRequestException(
            `Duplicate question ID: ${question.id}`,
          );
        }

        questionIds.add(question.id);
      }

      // Validate options
      for (
        const option of question.options
      ) {
        if (option.id) {
          if (
            optionIds.has(option.id)
          ) {
            throw new BadRequestException(
              `Duplicate option ID: ${option.id}`,
            );
          }

          optionIds.add(option.id);
        }
      }

      // Validate correct-answer rules
      const correctOptions =
        question.options.filter(
          (option) => option.isCorrect,
        );

      switch (
      question.questionType
      ) {
        case QuestionType.SINGLE_CHOICE:
          if (
            correctOptions.length !== 1
          ) {
            throw new BadRequestException(
              'Single-choice questions must have exactly one correct option',
            );
          }
          break;

        case QuestionType.MULTIPLE_CHOICE:
          if (
            correctOptions.length < 1
          ) {
            throw new BadRequestException(
              'Multiple-choice questions must have at least one correct option',
            );
          }
          break;

        case QuestionType.TRUE_FALSE:
          if (
            question.options.length !== 2
          ) {
            throw new BadRequestException(
              'True/false questions must have exactly two options',
            );
          }

          if (
            correctOptions.length !== 1
          ) {
            throw new BadRequestException(
              'True/false questions must have exactly one correct option',
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
        const quiz = await manager.findOne(
          Quiz,
          {
            where: {
              id: quizId,
              creatorId,
            },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Find the version
        const version =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                id: quizVersionId,
                quizId: quiz.id,
              },
            },
          );

        if (!version) {
          throw new NotFoundException(
            'Quiz version not found',
          );
        }

        // 3. Only drafts can be published
        if (
          version.status !==
          QuizVersionStatus.DRAFT
        ) {
          throw new BadRequestException(
            'Only draft versions can be published',
          );
        }

        // 4. Load all questions
        const questions =
          await manager.find(
            Question,
            {
              where: {
                quizVersionId:
                  version.id,
              },
              order: {
                order: 'ASC',
              },
            },
          );

        if (questions.length === 0) {
          throw new BadRequestException(
            'Cannot publish a quiz without questions',
          );
        }

        // 5. Validate question ordering
        for (
          let index = 0;
          index < questions.length;
          index++
        ) {
          const question =
            questions[index];

          const expectedOrder =
            index + 1;

          if (
            question.order !==
            expectedOrder
          ) {
            throw new BadRequestException(
              `Question ordering is invalid. Expected order ${expectedOrder}`,
            );
          }

          if (question.marks < 1) {
            throw new BadRequestException(
              `Question ${question.order} must have at least 1 mark`,
            );
          }

          // 6. Load options
          const options =
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

          if (options.length === 0) {
            throw new BadRequestException(
              `Question ${question.order} has no options`,
            );
          }

          // 7. Validate option ordering
          for (
            let optionIndex = 0;
            optionIndex < options.length;
            optionIndex++
          ) {
            const option =
              options[optionIndex];

            const expectedOptionOrder =
              optionIndex + 1;

            if (
              option.order !==
              expectedOptionOrder
            ) {
              throw new BadRequestException(
                `Option ordering is invalid in question ${question.order}`,
              );
            }
          }

          // 8. Validate correct-answer rules
          const correctOptions =
            options.filter(
              (option) =>
                option.isCorrect,
            );

          switch (
          question.questionType
          ) {
            case QuestionType.SINGLE_CHOICE:
              if (
                correctOptions.length !==
                1
              ) {
                throw new BadRequestException(
                  `Question ${question.order} must have exactly one correct option`,
                );
              }
              break;

            case QuestionType.MULTIPLE_CHOICE:
              if (
                correctOptions.length <
                1
              ) {
                throw new BadRequestException(
                  `Question ${question.order} must have at least one correct option`,
                );
              }
              break;

            case QuestionType.TRUE_FALSE:
              if (
                options.length !== 2
              ) {
                throw new BadRequestException(
                  `Question ${question.order} must have exactly two options`,
                );
              }

              if (
                correctOptions.length !==
                1
              ) {
                throw new BadRequestException(
                  `Question ${question.order} must have exactly one correct option`,
                );
              }
              break;
          }
        }

        // 9. Publish version
        version.status =
          QuizVersionStatus.PUBLISHED;

        version.publishedAt =
          new Date();

        const publishedVersion =
          await manager.save(
            QuizVersion,
            version,
          );

        // 10. Update quiz status
        quiz.status =
          QuizStatus.PUBLISHED;

        await manager.save(
          Quiz,
          quiz,
        );

        return {
          quizId: quiz.id,
          quizVersionId:
            publishedVersion.id,
          version:
            publishedVersion.version,
          status:
            publishedVersion.status,
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
    return this.dataSource.transaction(async (manager) => {
      const quiz = await manager.findOne(
        Quiz,
        {
          where: {
            id: quizId,
            creatorId,
          },
        },
      );

      if (!quiz) {
        throw new NotFoundException(
          'Quiz not found',
        );
      }

      const existingDraft =
        await manager.findOne(
          QuizVersion,
          {
            where: {
              quizId,
              status: QuizVersionStatus.DRAFT,
            },
          },
        );

      if (existingDraft) {
        throw new BadRequestException(
          'A draft version already exists for this quiz',
        );
      }

      const latestVersion =
        await manager.findOne(
          QuizVersion,
          {
            where: {
              quizId,
              status: QuizVersionStatus.PUBLISHED,
            },
            order: {
              version: 'DESC',
            },
          },
        );

      if (!latestVersion) {
        throw new BadRequestException(
          'A published version is required before creating a new version',
        );
      }

      const newVersion = manager.create(
        QuizVersion,
        {
          quizId: quiz.id,
          version: latestVersion.version + 1,
          status: QuizVersionStatus.DRAFT,
          timeLimitSeconds:
            latestVersion.timeLimitSeconds,
          publishedAt: null,
        },
      );

      const savedVersion =
        await manager.save(
          QuizVersion,
          newVersion,
        );

      const questions =
        await manager.find(Question, {
          where: {
            quizVersionId:
              latestVersion.id,
          },
          order: {
            order: 'ASC',
          },
        });

      for (const question of questions) {
        const newQuestion =
          manager.create(Question, {
            quizVersionId:
              savedVersion.id,
            text: question.text,
            questionType:
              question.questionType,
            order: question.order,
            marks: question.marks,
          });

        const savedQuestion =
          await manager.save(
            Question,
            newQuestion,
          );

        const options =
          await manager.find(Option, {
            where: {
              questionId: question.id,
            },
            order: {
              order: 'ASC',
            },
          });

        for (const option of options) {
          const newOption =
            manager.create(Option, {
              questionId:
                savedQuestion.id,
              text: option.text,
              isCorrect:
                option.isCorrect,
              order: option.order,
            });

          await manager.save(
            Option,
            newOption,
          );
        }
      }

      return {
        quizId: quiz.id,
        quizVersionId:
          savedVersion.id,
        version:
          savedVersion.version,
        status:
          savedVersion.status,
        timeLimitSeconds:
          savedVersion.timeLimitSeconds,
      };
    });
  }

  async startAttempt(
    quizId: string,
    quizVersionId: string,
    userId: string,
  ) {
    return this.dataSource.transaction(
      async (manager) => {
        const quiz = await manager.findOne(
          Quiz,
          {
            where: {
              id: quizId,
            },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        const version =
          await manager.findOne(
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

        if (
          version.status !==
          QuizVersionStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            'Only published quiz versions can be attempted',
          );
        }

        const existingAttempt =
          await manager.findOne(
            QuizAttempt,
            {
              where: {
                userId,
                quizVersionId:
                  version.id,
                status:
                  AttemptStatus.IN_PROGRESS,
              },
            },
          );

        if (existingAttempt) {
          return {
            id: existingAttempt.id,
            quizId:
              existingAttempt.quizId,
            quizVersionId:
              existingAttempt.quizVersionId,
            status:
              existingAttempt.status,
            startedAt:
              existingAttempt.startedAt,
            expiresAt:
              existingAttempt.expiresAt,
          };
        }

        const startedAt =
          new Date();

        let expiresAt:
          | Date
          | null = null;

        if (
          version.timeLimitSeconds !==
          null
        ) {
          expiresAt =
            new Date(
              startedAt.getTime() +
              version.timeLimitSeconds *
              1000,
            );
        }

        const attempt =
          manager.create(
            QuizAttempt,
            {
              userId,
              quizId: quiz.id,
              quizVersionId:
                version.id,
              status:
                AttemptStatus.IN_PROGRESS,
              startedAt,
              expiresAt,
            },
          );

        const savedAttempt =
          await manager.save(
            QuizAttempt,
            attempt,
          );

        return {
          id: savedAttempt.id,
          quizId:
            savedAttempt.quizId,
          quizVersionId:
            savedAttempt.quizVersionId,
          status:
            savedAttempt.status,
          startedAt:
            savedAttempt.startedAt,
          expiresAt:
            savedAttempt.expiresAt,
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
        await this.ensureAttemptActive(
          manager,
          attempt,
        );

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
        // 1. Find the attempt belonging
        //    to the current user
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

        /*
         * We intentionally do not reject an
         * expired timed attempt here.
         *
         * Answers saved before the deadline
         * are still graded.
         *
         * saveAnswer() prevents new answers
         * after the deadline.
         */

        // 3. Calculate the final score
        const result =
          await this.calculateAttemptScore(
            manager,
            attempt,
          );

        // 4. Finalize the attempt
        attempt.status =
          AttemptStatus.SUBMITTED;

        attempt.submittedAt =
          new Date();

        attempt.score =
          result.score;

        attempt.correctAnswers =
          result.correctAnswers;

        attempt.wrongAnswers =
          result.wrongAnswers;

        attempt.unanswered =
          result.unanswered;

        attempt.percentage =
          result.percentage;

        const submittedAttempt =
          await manager.save(
            QuizAttempt,
            attempt,
          );

        // 5. Return final result
        return {
          attemptId:
            submittedAttempt.id,

          status:
            submittedAttempt.status,

          score:
            submittedAttempt.score,

          totalMarks:
            result.totalMarks,

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
      async (manager): Promise<AttemptResponseDto> => {
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

        // 2. Load all questions from the exact
        //    quiz version used by this attempt
        const questions = await manager.find(
          Question,
          {
            where: {
              quizVersionId:
                attempt.quizVersionId,
            },
            order: {
              order: 'ASC',
            },
          },
        );

        // 3. Load all answers belonging
        //    to this attempt
        const answers = await manager.find(
          Answer,
          {
            where: {
              attemptId: attempt.id,
            },
          },
        );

        // 4. Get all answer IDs
        const answerIds: string[] =
          answers.map(
            (answer: Answer) => answer.id,
          );

        // 5. Load selected options for
        //    all answers
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

        // 6. Map question ID → selected option IDs
        const selectedOptionsMap =
          new Map<string, string[]>();

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

        // 7. Build frontend-safe question response
        const result: AttemptQuestionResponseDto[] =
          [];

        for (
          const question of questions
        ) {
          // Load options for this question
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

          // IMPORTANT:
          // Do NOT expose isCorrect
          const optionResponse: AttemptOptionResponseDto[] =
            options.map(
              (
                option: Option,
              ): AttemptOptionResponseDto => ({
                id: option.id,
                text: option.text,
                order: option.order,
              }),
            );

          result.push({
            id: question.id,
            text: question.text,
            questionType:
              question.questionType,
            order: question.order,
            marks: question.marks,
            options: optionResponse,
            selectedOptionIds:
              selectedOptionsMap.get(
                question.id,
              ) ?? [],
          });
        }

        const remainingTimeSeconds =
          this.getRemainingTimeSeconds(
            attempt,
          );

        // 8. Return the API response
        return {
          attemptId: attempt.id,

          quizId: attempt.quizId,
          quizVersionId:
            attempt.quizVersionId,

          status: attempt.status,

          startedAt:
            attempt.startedAt,

          expiresAt:
            attempt.expiresAt,

          submittedAt:
            attempt.submittedAt,

          remainingTimeSeconds,

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
  ): Promise<AttemptResultResponseDto> {
    return this.dataSource.transaction(
      async (
        manager,
      ): Promise<AttemptResultResponseDto> => {
        // 1. Find the attempt belonging
        //    to the current user
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

        // 2. Result is available only
        //    after submission
        if (
          attempt.status !==
          AttemptStatus.SUBMITTED
        ) {
          throw new BadRequestException(
            'Result is available only after the attempt is submitted',
          );
        }

        // 3. Load questions from the exact
        //    quiz version used by this attempt
        const questions =
          await manager.find(
            Question,
            {
              where: {
                quizVersionId:
                  attempt.quizVersionId,
              },
            },
          );

        // 4. Calculate total marks
        const totalMarks: number =
          questions.reduce(
            (
              total: number,
              question: Question,
            ): number =>
              total + question.marks,
            0,
          );

        // 5. Return the final result
        return {
          attemptId: attempt.id,
          quizId: attempt.quizId,
          quizVersionId:
            attempt.quizVersionId,
          status: attempt.status,
          score: attempt.score,
          totalMarks,
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

  async getAttemptHistory(
    quizId: string,
    userId: string,
    query: AttemptHistoryQueryDto,
  ): Promise<AttemptHistoryResponseDto> {
    const page: number = query.page;
    const limit: number = query.limit;

    const skip: number =
      (page - 1) * limit;

    const [attempts, total] =
      await this.quizAttemptRepository
        .createQueryBuilder('attempt')
        .innerJoin(
          QuizVersion,
          'version',
          'version.id = attempt.quiz_version_id',
        )
        .where(
          'attempt.quiz_id = :quizId',
          {
            quizId,
          },
        )
        .andWhere(
          'attempt.user_id = :userId',
          {
            userId,
          },
        )
        .select([
          'attempt.id',
          'attempt.quiz_id',
          'attempt.quiz_version_id',
          'attempt.status',
          'attempt.score',
          'attempt.correct_answers',
          'attempt.wrong_answers',
          'attempt.unanswered',
          'attempt.percentage',
          'attempt.started_at',
          'attempt.submitted_at',
          'version.version',
        ])
        .orderBy(
          'attempt.created_at',
          'DESC',
        )
        .skip(skip)
        .take(limit)
        .getRawMany();

    const items: AttemptHistoryItemDto[] =
      attempts.map(
        (
          attempt: Record<string, unknown>,
        ): AttemptHistoryItemDto => ({
          attemptId:
            attempt.attempt_id as string,

          quizId:
            attempt.attempt_quiz_id as string,

          quizVersionId:
            attempt.attempt_quiz_version_id as string,

          version:
            Number(attempt.version_version),

          status:
            attempt.attempt_status as AttemptStatus,

          score:
            attempt.attempt_score !== null
              ? Number(attempt.attempt_score)
              : null,

          correctAnswers:
            attempt.attempt_correct_answers !==
              null
              ? Number(
                attempt.attempt_correct_answers,
              )
              : null,

          wrongAnswers:
            attempt.attempt_wrong_answers !== null
              ? Number(
                attempt.attempt_wrong_answers,
              )
              : null,

          unanswered:
            attempt.attempt_unanswered !== null
              ? Number(
                attempt.attempt_unanswered,
              )
              : null,

          percentage:
            attempt.attempt_percentage !== null
              ? Number(
                attempt.attempt_percentage,
              )
              : null,

          startedAt:
            attempt.attempt_started_at as Date,

          submittedAt:
            attempt.attempt_submitted_at as
            | Date
            | null,
        }),
      );

    const totalPages: number =
      Math.ceil(total / limit);

    return {
      items,
      page,
      limit,
      total,
      totalPages,
    };
  }

  async getCreatorQuizzes(
    creatorId: string,
  ): Promise<CreatorQuizListResponseDto> {
    const organizationId = await this.getCreatorOrganizationId(creatorId);

    const quizzes = await this.quizRepository.find({
      where: {
        creatorId,
        organizationId: organizationId === null ? IsNull() : organizationId,
      },
      order: {
        updatedAt: 'DESC',
      },
    });

    const items: CreatorQuizListItemDto[] =
      quizzes.map(
        (
          quiz: Quiz,
        ): CreatorQuizListItemDto => ({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          status: quiz.status,
          createdAt: quiz.createdAt,
          updatedAt: quiz.updatedAt,
        }),
      );

    return {
      items,
    };
  }

  async getCreatorQuizDetails(
    quizId: string,
    creatorId: string,
  ): Promise<CreatorQuizDetailsResponseDto> {
    const organizationId = await this.getCreatorOrganizationId(creatorId);

    const quiz = await this.quizRepository.findOne({
      where: {
        id: quizId,
        creatorId,
        organizationId: organizationId === null ? IsNull() : organizationId,
      },
    });

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found',
      );
    }

    const versions =
      await this.quizVersionRepository.find({
        where: {
          quizId: quiz.id,
        },
        order: {
          version: 'DESC',
        },
      });

    const versionResponses: CreatorQuizVersionResponseDto[] =
      [];

    for (const version of versions) {
      const questions =
        await this.questionRepository.find({
          where: {
            quizVersionId: version.id,
          },
          order: {
            order: 'ASC',
          },
        });

      const questionResponses: CreatorQuestionResponseDto[] =
        [];

      for (const question of questions) {
        const options =
          await this.optionRepository.find({
            where: {
              questionId: question.id,
            },
            order: {
              order: 'ASC',
            },
          });

        const optionResponses: CreatorOptionResponseDto[] =
          options.map(
            (
              option: Option,
            ): CreatorOptionResponseDto => ({
              id: option.id,
              text: option.text,
              isCorrect: option.isCorrect,
              order: option.order,
            }),
          );

        questionResponses.push({
          id: question.id,
          text: question.text,
          questionType:
            question.questionType,
          order: question.order,
          marks: question.marks,
          options: optionResponses,
        });
      }

      versionResponses.push({
        id: version.id,
        version: version.version,
        status: version.status,
        publishedAt: version.publishedAt,
        createdAt: version.createdAt,
        updatedAt: version.updatedAt,
        questions: questionResponses,
      });
    }

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
      creatorId: quiz.creatorId,
      createdAt: quiz.createdAt,
      updatedAt: quiz.updatedAt,
      versions: versionResponses,
    };
  }

  async updateQuiz(
    quizId: string,
    creatorId: string,
    dto: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    const organizationId = await this.getCreatorOrganizationId(creatorId);

    const quiz = await this.quizRepository.findOne({
      where: {
        id: quizId,
        creatorId,
        organizationId: organizationId === null ? IsNull() : organizationId,
      },
    });

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found',
      );
    }

    if (dto.title !== undefined) {
      quiz.title = dto.title;
    }

    if (dto.description !== undefined) {
      quiz.description =
        dto.description;
    }

    const savedQuiz =
      await this.quizRepository.save(quiz);

    return {
      id: savedQuiz.id,
      title: savedQuiz.title,
      description:
        savedQuiz.description,
      status: savedQuiz.status,
      creatorId:
        savedQuiz.creatorId,
      createdAt:
        savedQuiz.createdAt,
      updatedAt:
        savedQuiz.updatedAt,
    };
  }

  async discardVersion(
    quizId: string,
    quizVersionId: string,
    creatorId: string,
  ): Promise<QuizVersionResponseDto> {
    const organizationId = await this.getCreatorOrganizationId(creatorId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership
        const quiz = await manager.findOne(
          Quiz,
          {
            where: {
              id: quizId,
              creatorId,
              organizationId: organizationId === null ? IsNull() : organizationId,
            },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Find the version belonging
        //    to this quiz
        const version =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                id: quizVersionId,
                quizId: quiz.id,
              },
            },
          );

        if (!version) {
          throw new NotFoundException(
            'Quiz version not found',
          );
        }

        // 3. Only drafts can be discarded
        if (
          version.status !==
          QuizVersionStatus.DRAFT
        ) {
          throw new BadRequestException(
            'Only draft versions can be discarded',
          );
        }

        // 4. If this is the only version
        //    and there is no published version,
        //    do not allow it to be discarded.
        const publishedVersion =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                quizId: quiz.id,
                status:
                  QuizVersionStatus.PUBLISHED,
              },
            },
          );

        if (!publishedVersion) {
          throw new BadRequestException(
            'The initial draft version cannot be discarded before the quiz is published',
          );
        }

        // 5. Archive the draft
        version.status =
          QuizVersionStatus.ARCHIVED;

        const archivedVersion =
          await manager.save(
            QuizVersion,
            version,
          );

        // 6. Return a safe response DTO
        return {
          id: archivedVersion.id,
          quizId: archivedVersion.quizId,
          version:
            archivedVersion.version,
          status:
            archivedVersion.status,
          publishedAt:
            archivedVersion.publishedAt,
          createdAt:
            archivedVersion.createdAt,
          updatedAt:
            archivedVersion.updatedAt,
          timeLimitSeconds:
            archivedVersion.timeLimitSeconds,
        };
      },
    );
  }

  async getPublishedQuizVersion(
    quizId: string,
    quizVersionId: string,
  ): Promise<TakerQuizVersionResponseDto> {
    const quiz = await this.quizRepository.findOne({
      where: {
        id: quizId,
        status: QuizStatus.PUBLISHED,
      },
    });

    if (!quiz) {
      throw new NotFoundException(
        'Quiz not found',
      );
    }

    const version =
      await this.quizVersionRepository.findOne({
        where: {
          id: quizVersionId,
          quizId: quiz.id,
          status:
            QuizVersionStatus.PUBLISHED,
        },
      });

    if (!version) {
      throw new NotFoundException(
        'Published quiz version not found',
      );
    }

    const questions =
      await this.questionRepository.find({
        where: {
          quizVersionId: version.id,
        },
        order: {
          order: 'ASC',
        },
      });

    const questionResponses: TakerQuestionResponseDto[] =
      [];

    for (const question of questions) {
      const options =
        await this.optionRepository.find({
          where: {
            questionId: question.id,
          },
          order: {
            order: 'ASC',
          },
        });

      const optionResponses: TakerOptionResponseDto[] =
        options.map(
          (
            option: Option,
          ): TakerOptionResponseDto => ({
            id: option.id,
            text: option.text,
            order: option.order,
          }),
        );

      questionResponses.push({
        id: question.id,
        text: question.text,
        questionType:
          question.questionType,
        order: question.order,
        marks: question.marks,
        options: optionResponses,
      });
    }

    return {
      quizId: quiz.id,
      quizVersionId: version.id,

      title: quiz.title,
      description: quiz.description,

      version: version.version,

      timeLimitSeconds:
        version.timeLimitSeconds,

      questions:
        questionResponses,
    };
  }

  private async ensureAttemptActive(
    manager: EntityManager,
    attempt: QuizAttempt,
  ): Promise<void> {
    if (
      attempt.status !==
      AttemptStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        'This attempt is no longer active',
      );
    }

    if (
      attempt.expiresAt !== null &&
      new Date() >= attempt.expiresAt
    ) {
      throw new BadRequestException(
        'This quiz attempt has expired',
      );
    }
  }

  private getRemainingTimeSeconds(
    attempt: QuizAttempt,
  ): number | null {
    if (attempt.expiresAt === null) {
      return null;
    }

    const remainingMilliseconds =
      attempt.expiresAt.getTime() -
      Date.now();

    return Math.max(
      0,
      Math.ceil(
        remainingMilliseconds / 1000,
      ),
    );
  }

  private async calculateAttemptScore(
    manager: EntityManager,
    attempt: QuizAttempt,
  ): Promise<{
    score: number;
    totalMarks: number;
    correctAnswers: number;
    wrongAnswers: number;
    unanswered: number;
    percentage: number;
  }> {
    // 1. Load all questions from the exact quiz version
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

    // 2. Load all answers for this attempt
    const answers =
      await manager.find(Answer, {
        where: {
          attemptId: attempt.id,
        },
      });

    // 3. Load all selected options for this attempt
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

    // 4. Load ALL options for the quiz version
    const questionIds =
      questions.map(
        (question) => question.id,
      );

    const options =
      questionIds.length > 0
        ? await manager.find(
          Option,
          {
            where: questionIds.map(
              (questionId) => ({
                questionId,
              }),
            ),
          },
        )
        : [];

    // 5. Map questionId -> answer
    const answerMap = new Map<
      string,
      Answer
    >(
      answers.map((answer) => [
        answer.questionId,
        answer,
      ]),
    );

    // 6. Map answerId -> selected option IDs
    const selectedOptionsMap =
      new Map<string, Set<string>>();

    for (const answerOption of answerOptions) {
      const existing =
        selectedOptionsMap.get(
          answerOption.answerId,
        );

      if (existing) {
        existing.add(
          answerOption.optionId,
        );
      } else {
        selectedOptionsMap.set(
          answerOption.answerId,
          new Set([
            answerOption.optionId,
          ]),
        );
      }
    }

    // 7. Map questionId -> correct option IDs
    const correctOptionsMap =
      new Map<string, Set<string>>();

    for (const option of options) {
      if (!option.isCorrect) {
        continue;
      }

      const existing =
        correctOptionsMap.get(
          option.questionId,
        );

      if (existing) {
        existing.add(option.id);
      } else {
        correctOptionsMap.set(
          option.questionId,
          new Set([option.id]),
        );
      }
    }

    // 8. Calculate total marks
    const totalMarks =
      questions.reduce(
        (total, question) =>
          total + question.marks,
        0,
      );

    let score = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unanswered = 0;

    // 9. Evaluate every question in memory
    for (const question of questions) {
      const answer = answerMap.get(
        question.id,
      );

      // No answer
      if (!answer) {
        unanswered++;
        continue;
      }

      const selectedSet =
        selectedOptionsMap.get(
          answer.id,
        ) ?? new Set<string>();

      const correctSet =
        correctOptionsMap.get(
          question.id,
        ) ?? new Set<string>();

      // Both sets must contain exactly
      // the same option IDs.
      const sameLength =
        selectedSet.size ===
        correctSet.size;

      const sameOptions =
        [...selectedSet].every(
          (optionId) =>
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

    const percentage =
      totalMarks > 0
        ? Number(
          (
            (score / totalMarks) *
            100
          ).toFixed(2),
        )
        : 0;

    return {
      score,
      totalMarks,
      correctAnswers,
      wrongAnswers,
      unanswered,
      percentage,
    };
  }

  async updateQuizVersion(
    quizId: string,
    quizVersionId: string,
    timeLimitSeconds: number | null | undefined,
    creatorId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const quiz = await manager.findOne(
        Quiz,
        {
          where: {
            id: quizId,
            creatorId,
          },
        },
      );

      if (!quiz) {
        throw new NotFoundException(
          'Quiz not found',
        );
      }

      const version =
        await manager.findOne(
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

      if (
        version.status !==
        QuizVersionStatus.DRAFT
      ) {
        throw new BadRequestException(
          'Only draft versions can be updated',
        );
      }

      if (
        timeLimitSeconds !== undefined
      ) {
        version.timeLimitSeconds =
          timeLimitSeconds;
      }

      const savedVersion =
        await manager.save(
          QuizVersion,
          version,
        );

      return {
        quizId: savedVersion.quizId,
        quizVersionId:
          savedVersion.id,
        version:
          savedVersion.version,
        status:
          savedVersion.status,
        timeLimitSeconds:
          savedVersion.timeLimitSeconds,
        updatedAt:
          savedVersion.updatedAt,
      };
    });
  }
}