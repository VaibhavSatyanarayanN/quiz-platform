import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
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
import { QuizAssignment } from '../quiz-assignments/entities/quiz-assignment.entity.js';
import { QuizAssignmentRecipient } from '../quiz-assignments/entities/quiz-assignment-recipient.entity.js';
import { QuizQuestionGeneration } from './entities/quiz-question-generation.entity.js';
import { GenerationStatus } from './enums/generation-status.enum.js';
import { UpdateQuizVersionDto } from './dto/update-quiz-version.dto.js';

import {
  AttemptOptionResponseDto,
  AttemptQuestionResponseDto,
  AttemptResponseDto,
  StartAttemptResponseDto,
} from './dto/attempt-response.dto.js';
import {
  AttemptQuestionReviewDto,
  AttemptResultResponseDto,
  AttemptReviewOptionDto,
} from './dto/attempt-result-response.dto.js';
import {
  AttemptHistoryItemDto,
  AttemptHistoryResponseDto,
} from './dto/attempt-history.dto.js';

import { AttemptHistoryQueryDto } from './dto/attempt-history-query.dto.js';
import { CreatorQuizQueryDto } from './dto/creator-quiz-query.dto.js';
import { CreatorQuizListItemDto, CreatorQuizListResponseDto } from './dto/creator-quiz-list.dto.js';
import { CreatorOptionResponseDto, CreatorQuestionResponseDto, CreatorQuizDetailsResponseDto, CreatorQuizVersionResponseDto } from './dto/creator-quiz-details.dto.js';
import { PublishedQuizListItemDto, PublishedQuizListResponseDto, PublishedQuizQueryDto } from './dto/published-quiz-list.dto.js';
import { UpdateQuizDto } from './dto/update-quiz.dto.js';
import { QuizResponseDto } from './dto/quiz-response.dto.js';
import { QuizVersionResponseDto } from './dto/version-response.dto.js';
import { TakerOptionResponseDto, TakerQuestionResponseDto, TakerQuizVersionResponseDto } from './dto/taker-quiz-response.dto.js';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type.js';
import { UserRole } from '../users/enums/user-role.enum.js';
import {
  AnalyticsVersionItemDto,
  OptionDistributionDto,
  QuestionAnalyticsDto,
  QuestionTypePerformanceDto,
  QuizAnalyticsResponseDto,
  ScoreDistributionDto,
  TopScorerDto,
  VersionAnalyticsSummaryDto,
} from './dto/quiz-analytics.dto.js';

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

  private validateTimeLimitSeconds(
    timeLimitSeconds: number | null | undefined,
  ): void {
    if (
      timeLimitSeconds !== null &&
      timeLimitSeconds !== undefined &&
      (!Number.isInteger(timeLimitSeconds) || timeLimitSeconds < 1)
    ) {
      throw new BadRequestException(
        'timeLimitSeconds must be a positive integer or null',
      );
    }
  }

  async createQuiz(
    title: string,
    description: string | null,
    timeLimitSeconds: number | null,
    creatorId: string,
  ) {
    this.validateTimeLimitSeconds(timeLimitSeconds);
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
    userOrCreatorId: AuthenticatedUser | string,
  ) {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;
    const organizationId = isAdmin ? null : await this.getCreatorOrganizationId(userId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership and acquire lock on Quiz first
        const quiz = await manager.findOne(
          Quiz,
          {
            where: isAdmin
              ? { id: quizId }
              : {
                  id: quizId,
                  creatorId: userId,
                  organizationId: organizationId === null ? IsNull() : organizationId,
                },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Lock QuizVersion second (deadlock-free ordering)
        const version =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                id: quizVersionId,
                quizId: quiz.id,
              },
              lock: { mode: 'pessimistic_write' },
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

  async updateQuizVersion(
    quizId: string,
    quizVersionId: string,
    userOrTimeLimit: AuthenticatedUser | string | number | null,
    dtoOrCreatorId?: UpdateQuizVersionDto | string,
  ): Promise<QuizVersionResponseDto> {
    let resolvedUser: AuthenticatedUser | string;
    let dto: UpdateQuizVersionDto;

    if (
      typeof userOrTimeLimit === 'number' ||
      userOrTimeLimit === null ||
      (typeof userOrTimeLimit === 'undefined' && typeof dtoOrCreatorId === 'string')
    ) {
      // Legacy signature: (quizId, quizVersionId, timeLimitSeconds, creatorId)
      this.validateTimeLimitSeconds(userOrTimeLimit as number | null | undefined);
      dto = { timeLimitSeconds: userOrTimeLimit as number | null };
      resolvedUser = (dtoOrCreatorId as string) || '';
    } else if (
      dtoOrCreatorId &&
      typeof dtoOrCreatorId === 'object' &&
      'timeLimitSeconds' in dtoOrCreatorId
    ) {
      // New signature: (quizId, quizVersionId, user, dto)
      resolvedUser = userOrTimeLimit as AuthenticatedUser | string;
      dto = dtoOrCreatorId;
    } else {
      resolvedUser = userOrTimeLimit as AuthenticatedUser | string;
      dto = (dtoOrCreatorId as UpdateQuizVersionDto) || {};
    }

    if (dto.timeLimitSeconds !== undefined) {
      this.validateTimeLimitSeconds(dto.timeLimitSeconds);
    }

    const principal = this.resolveUserPrincipal(resolvedUser);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;
    const organizationId = isAdmin ? null : await this.getCreatorOrganizationId(userId);

    return this.dataSource.transaction(async (manager) => {
      // 1. Lock Quiz first (deadlock-free hierarchy)
      const quiz = await manager.findOne(Quiz, {
        where: isAdmin
          ? { id: quizId }
          : {
              id: quizId,
              creatorId: userId,
              organizationId: organizationId === null ? IsNull() : organizationId,
            },
        lock: { mode: 'pessimistic_write' },
      });

      if (!quiz) {
        throw new NotFoundException('Quiz not found');
      }

      // 2. Lock QuizVersion second
      const version = await manager.findOne(QuizVersion, {
        where: {
          id: quizVersionId,
          quizId: quiz.id,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!version) {
        throw new NotFoundException('Quiz version not found');
      }

      // 3. Only draft versions can be modified
      if (version.status !== QuizVersionStatus.DRAFT) {
        throw new BadRequestException('Settings can only be modified in a draft version');
      }

      // 4. Validate and apply timeLimitSeconds
      if (dto.timeLimitSeconds !== undefined) {
        version.timeLimitSeconds = dto.timeLimitSeconds;
      }

      const savedVersion = await manager.save(QuizVersion, version);

      return {
        id: savedVersion.id,
        quizId: savedVersion.quizId,
        version: savedVersion.version,
        status: savedVersion.status,
        timeLimitSeconds: savedVersion.timeLimitSeconds,
        publishedAt: savedVersion.publishedAt,
        createdAt: savedVersion.createdAt,
        updatedAt: savedVersion.updatedAt,
      };
    });
  }

  private validateBulkQuestions(
    dto: BulkSaveQuestionsDto,
  ): void {
    const questionIds = new Set<string>();
    const optionIds = new Set<string>();

    for (let i = 0; i < dto.questions.length; i++) {
      const question = dto.questions[i];
      const qIndex = i + 1;

      // Validate question text
      if (!question.text || !question.text.trim()) {
        throw new BadRequestException(`Question ${qIndex} text cannot be empty`);
      }

      // Validate marks
      if (!question.marks || question.marks < 1) {
        throw new BadRequestException(`Question ${qIndex} marks must be at least 1`);
      }

      // Validate supported question types
      const supportedTypes = [
        QuestionType.SINGLE_CHOICE,
        QuestionType.MULTIPLE_CHOICE,
        QuestionType.TRUE_FALSE,
      ];
      if (!supportedTypes.includes(question.questionType)) {
        throw new BadRequestException(
          `Question ${qIndex} has unsupported question type "${question.questionType}". Quiz versions only support choice (single_choice, multiple_choice) and true_false questions.`,
        );
      }

      // Validate question IDs
      if (question.id) {
        if (questionIds.has(question.id)) {
          throw new BadRequestException(
            `Duplicate question ID: ${question.id}`,
          );
        }
        questionIds.add(question.id);
      }

      // Validate options count
      if (
        question.questionType === QuestionType.SINGLE_CHOICE ||
        question.questionType === QuestionType.MULTIPLE_CHOICE
      ) {
        if (!question.options || question.options.length < 2) {
          throw new BadRequestException(
            `Question ${qIndex} (${question.questionType}) must have at least 2 options`,
          );
        }
      } else if (question.questionType === QuestionType.TRUE_FALSE) {
        if (!question.options || question.options.length !== 2) {
          throw new BadRequestException(
            `Question ${qIndex} (true_false) must have exactly 2 options`,
          );
        }
      }

      // Validate options text & uniqueness within question
      const optionTexts = new Set<string>();
      for (let optIdx = 0; optIdx < question.options.length; optIdx++) {
        const option = question.options[optIdx];

        if (!option.text || !option.text.trim()) {
          throw new BadRequestException(
            `Option ${optIdx + 1} in question ${qIndex} cannot be empty`,
          );
        }

        const normalizedText = option.text.trim().toLowerCase();
        if (optionTexts.has(normalizedText)) {
          throw new BadRequestException(
            `Duplicate option text "${option.text.trim()}" in question ${qIndex}`,
          );
        }
        optionTexts.add(normalizedText);

        if (option.id) {
          if (optionIds.has(option.id)) {
            throw new BadRequestException(
              `Duplicate option ID: ${option.id}`,
            );
          }
          optionIds.add(option.id);
        }
      }

      // Validate correct-answer rules
      const correctOptions = question.options.filter(
        (option) => option.isCorrect,
      );

      switch (question.questionType) {
        case QuestionType.SINGLE_CHOICE:
          if (correctOptions.length !== 1) {
            throw new BadRequestException(
              `Single-choice question ${qIndex} must have exactly one correct option`,
            );
          }
          break;

        case QuestionType.MULTIPLE_CHOICE:
          if (correctOptions.length < 1) {
            throw new BadRequestException(
              `Multiple-choice question ${qIndex} must have at least one correct option`,
            );
          }
          break;

        case QuestionType.TRUE_FALSE:
          if (correctOptions.length !== 1) {
            throw new BadRequestException(
              `True/false question ${qIndex} must have exactly one correct option`,
            );
          }
          break;
      }
    }
  }

  async publishVersion(
    quizId: string,
    quizVersionId: string,
    userOrCreatorId: AuthenticatedUser | string,
  ) {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;
    const organizationId = isAdmin ? null : await this.getCreatorOrganizationId(userId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership and acquire lock on Quiz first
        const quiz = await manager.findOne(
          Quiz,
          {
            where: isAdmin
              ? { id: quizId }
              : {
                  id: quizId,
                  creatorId: userId,
                  organizationId: organizationId === null ? IsNull() : organizationId,
                },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Lock QuizVersion second (deadlock-free ordering)
        const version =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                id: quizVersionId,
                quizId: quiz.id,
              },
              lock: { mode: 'pessimistic_write' },
            },
          );

        if (!version) {
          throw new NotFoundException(
            'Quiz version not found',
          );
        }

        // 3. Handle version status idempotency and validation
        if (version.status === QuizVersionStatus.PUBLISHED) {
          // Idempotent return: version is already published
          if (quiz.status !== QuizStatus.PUBLISHED) {
            quiz.status = QuizStatus.PUBLISHED;
            await manager.save(Quiz, quiz);
          }
          return {
            quizId: quiz.id,
            quizVersionId: version.id,
            version: version.version,
            status: version.status,
            publishedAt: version.publishedAt,
          };
        }

        if (version.status === QuizVersionStatus.ARCHIVED) {
          throw new BadRequestException(
            'Cannot publish an archived version',
          );
        }

        if (
          version.status !==
          QuizVersionStatus.DRAFT
        ) {
          throw new BadRequestException(
            'Only draft versions can be published',
          );
        }

        // 4. In-flight AI generation check
        const inFlightGeneration = await manager.findOne(QuizQuestionGeneration, {
          where: {
            quizId: quiz.id,
            targetVersionId: version.id,
            status: In([GenerationStatus.PENDING, GenerationStatus.PROCESSING]),
          },
        });
        if (inFlightGeneration) {
          throw new BadRequestException(
            'Cannot publish version while AI question generation is in progress',
          );
        }

        // 5. Validate quiz title
        if (!quiz.title || !quiz.title.trim()) {
          throw new BadRequestException('Quiz title cannot be empty');
        }

        // 6. Validate version timeLimitSeconds
        this.validateTimeLimitSeconds(version.timeLimitSeconds);

        // 7. Load all questions
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

        // 8. Validate question ordering and fields
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

          if (!question.text || !question.text.trim()) {
            throw new BadRequestException(
              `Question ${question.order} text cannot be empty`,
            );
          }

          if (question.marks < 1) {
            throw new BadRequestException(
              `Question ${question.order} must have at least 1 mark`,
            );
          }

          const supportedTypes = [
            QuestionType.SINGLE_CHOICE,
            QuestionType.MULTIPLE_CHOICE,
            QuestionType.TRUE_FALSE,
          ];
          if (!supportedTypes.includes(question.questionType)) {
            throw new BadRequestException(
              `Question ${question.order} has unsupported question type "${question.questionType}". Quiz versions only support choice (single_choice, multiple_choice) and true_false questions.`,
            );
          }

          // Load options
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

          if (
            (question.questionType === QuestionType.SINGLE_CHOICE ||
              question.questionType === QuestionType.MULTIPLE_CHOICE) &&
            options.length < 2
          ) {
            throw new BadRequestException(
              `Question ${question.order} (${question.questionType}) must have at least 2 options`,
            );
          }

          if (
            question.questionType === QuestionType.TRUE_FALSE &&
            options.length !== 2
          ) {
            throw new BadRequestException(
              `Question ${question.order} must have exactly two options`,
            );
          }

          // Validate option ordering and non-empty text
          const optionTexts = new Set<string>();
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

            if (!option.text || !option.text.trim()) {
              throw new BadRequestException(
                `Option ${option.order} in question ${question.order} cannot be empty`,
              );
            }

            const normalizedText = option.text.trim().toLowerCase();
            if (optionTexts.has(normalizedText)) {
              throw new BadRequestException(
                `Duplicate option text "${option.text.trim()}" in question ${question.order}`,
              );
            }
            optionTexts.add(normalizedText);
          }

          // Validate correct-answer rules
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
    userOrCreatorId: AuthenticatedUser | string,
  ) {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;
    const organizationId = isAdmin ? null : await this.getCreatorOrganizationId(userId);

    return this.dataSource.transaction(async (manager) => {
      // 1. Lock Quiz first (deadlock-free hierarchy)
      const quiz = await manager.findOne(
        Quiz,
        {
          where: isAdmin
            ? { id: quizId }
            : {
                id: quizId,
                creatorId: userId,
                organizationId: organizationId === null ? IsNull() : organizationId,
              },
          lock: { mode: 'pessimistic_write' },
        },
      );

      if (!quiz) {
        throw new NotFoundException(
          'Quiz not found',
        );
      }

      // 2. Lock check for existing draft
      const existingDraft =
        await manager.findOne(
          QuizVersion,
          {
            where: {
              quizId: quiz.id,
              status: QuizVersionStatus.DRAFT,
            },
            lock: { mode: 'pessimistic_write' },
          },
        );

      if (existingDraft) {
        throw new BadRequestException(
          'A draft version already exists for this quiz',
        );
      }

      // 3. Lock latest published version
      const latestVersion =
        await manager.findOne(
          QuizVersion,
          {
            where: {
              quizId: quiz.id,
              status: QuizVersionStatus.PUBLISHED,
            },
            order: {
              version: 'DESC',
            },
            lock: { mode: 'pessimistic_write' },
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

  private resolveUserPrincipal(
    userOrUserId: AuthenticatedUser | string,
  ): { userId: string; role?: UserRole } {
    if (typeof userOrUserId === 'string') {
      return { userId: userOrUserId };
    }
    return {
      userId: userOrUserId.userId,
      role: userOrUserId.role as UserRole,
    };
  }

  private isUniqueActiveAttemptViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const err = error as { code?: string; constraint?: string; message?: string };
    return (
      err.code === '23505' ||
      err.constraint === 'UQ_active_attempt_user_version' ||
      Boolean(err.message && err.message.includes('UQ_active_attempt_user_version'))
    );
  }

  private isAttemptDeadlineReached(
    attempt: Pick<QuizAttempt, 'expiresAt'>,
    referenceNow: Date = new Date(),
  ): boolean {
    if (attempt.expiresAt === null || attempt.expiresAt === undefined) {
      return false;
    }
    return referenceNow.getTime() >= new Date(attempt.expiresAt).getTime();
  }

  private async expireAttemptInTransaction(
    manager: EntityManager,
    attempt: QuizAttempt,
    isAlreadyLocked = false,
  ): Promise<QuizAttempt> {
    let targetAttempt = attempt;

    if (!isAlreadyLocked) {
      const lockedAttempt = await manager.findOne(QuizAttempt, {
        where: { id: attempt.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (lockedAttempt) {
        targetAttempt = lockedAttempt;
      }
    }

    if (targetAttempt.status !== AttemptStatus.IN_PROGRESS) {
      return targetAttempt;
    }

    const result = await this.calculateAttemptScore(manager, targetAttempt);
    targetAttempt.status = AttemptStatus.EXPIRED;
    targetAttempt.submittedAt = targetAttempt.expiresAt
      ? new Date(targetAttempt.expiresAt)
      : new Date();
    targetAttempt.score = result.score;
    targetAttempt.correctAnswers = result.correctAnswers;
    targetAttempt.wrongAnswers = result.wrongAnswers;
    targetAttempt.unanswered = result.unanswered;
    targetAttempt.percentage = result.percentage;

    return manager.save(QuizAttempt, targetAttempt);
  }

  private buildStartAttemptResponse(
    attempt: QuizAttempt,
    quiz: Quiz,
    version: QuizVersion,
    totalQuestions: number,
    totalMarks: number,
    resumed: boolean,
  ): StartAttemptResponseDto {
    return {
      id: attempt.id,
      attemptId: attempt.id,
      quizId: attempt.quizId,
      quizVersionId: attempt.quizVersionId,
      version: version.version,
      quizTitle: quiz.title,
      status: attempt.status,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingTimeSeconds: this.getRemainingTimeSeconds(attempt),
      totalQuestions,
      totalMarks,
      resumed,
    };
  }

  async startAttempt(
    quizId: string,
    quizVersionOrUser?: string | AuthenticatedUser,
    userOrUserId?: AuthenticatedUser | string,
  ): Promise<StartAttemptResponseDto> {
    let quizVersionId: string | undefined;
    let actualUser: AuthenticatedUser | string;

    if (
      typeof quizVersionOrUser === 'string' &&
      quizVersionOrUser.length > 0 &&
      typeof userOrUserId !== 'undefined'
    ) {
      quizVersionId = quizVersionOrUser;
      actualUser = userOrUserId;
    } else if (
      typeof quizVersionOrUser === 'object' &&
      quizVersionOrUser !== null
    ) {
      quizVersionId = undefined;
      actualUser = quizVersionOrUser;
    } else {
      quizVersionId =
        typeof quizVersionOrUser === 'string'
          ? quizVersionOrUser
          : undefined;
      actualUser = userOrUserId!;
    }

    const { userId } = this.resolveUserPrincipal(actualUser);
    if (!userId) {
      throw new ForbiddenException('Authenticated learner identity is required');
    }

    let quizSnapshot: Quiz | null = null;
    let versionSnapshot: QuizVersion | null = null;
    let totalQuestionsSnapshot = 0;
    let totalMarksSnapshot = 0;

    try {
      return await this.dataSource.transaction(
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

          if (quiz.status !== QuizStatus.PUBLISHED) {
            throw new BadRequestException(
              'Only published quizzes can be attempted',
            );
          }

          let version: QuizVersion | null = null;
          if (quizVersionId && quizVersionId !== 'latest' && quizVersionId !== 'current') {
            version = await manager.findOne(
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

            if (version.quizId && version.quizId !== quiz.id) {
              throw new BadRequestException(
                'Quiz version does not belong to the specified quiz',
              );
            }
          } else {
            // Deterministically select latest published version
            version = await manager.findOne(
              QuizVersion,
              {
                where: {
                  quizId: quiz.id,
                  status: QuizVersionStatus.PUBLISHED,
                },
                order: {
                  version: 'DESC',
                },
              },
            );

            if (!version) {
              throw new BadRequestException(
                'Only published quizzes can be attempted',
              );
            }
          }

          if (
            version.status !==
            QuizVersionStatus.PUBLISHED
          ) {
            throw new BadRequestException(
              'Only published quiz versions can be attempted',
            );
          }

          // Validate that the published version contains eligible questions
          const questions = await manager.find(Question, {
            where: {
              quizVersionId: version.id,
            },
            order: {
              order: 'ASC',
            },
          });

          if (!questions || questions.length === 0) {
            throw new BadRequestException(
              'This quiz version has no eligible questions available for taking',
            );
          }

          const totalQuestions = questions.length;
          const totalMarks = questions.reduce(
            (sum, q) => sum + (q.marks || 1),
            0,
          );

          quizSnapshot = quiz;
          versionSnapshot = version;
          totalQuestionsSnapshot = totalQuestions;
          totalMarksSnapshot = totalMarks;

          // If quiz is owned by an organization, enforce assignment recipient rules
          if (quiz.organizationId) {
            const isCreatorOrAdmin =
              (actualUser as AuthenticatedUser)?.role === UserRole.ADMIN ||
              quiz.creatorId === userId;

            if (!isCreatorOrAdmin) {
              const assignments = await manager.find(
                QuizAssignment,
                {
                  where: {
                    quizId: quiz.id,
                    organizationId: quiz.organizationId,
                    isActive: true,
                  },
                },
              );

              if (assignments.length === 0) {
                throw new ForbiddenException('You are not assigned to take this quiz');
              }

              const recipientRecords = await manager.find(
                QuizAssignmentRecipient,
                {
                  where: {
                    studentId: userId,
                  },
                },
              );

              const hasRecipientAccess = assignments.some((a) =>
                recipientRecords.some((r) => r.assignmentId === a.id),
              );

              if (!hasRecipientAccess) {
                throw new ForbiddenException('You are not assigned to take this quiz');
              }

              const now = new Date();
              const validAssignment = assignments.find((a) => {
                const isRecipient = recipientRecords.some((r) => r.assignmentId === a.id);
                if (!isRecipient) return false;
                if (a.startsAt && new Date(a.startsAt) > now) return false;
                if (a.dueAt && new Date(a.dueAt) < now) return false;
                return true;
              });

              if (!validAssignment) {
                throw new BadRequestException('This quiz assignment is currently unavailable or has expired');
              }
            }
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
                lock: { mode: 'pessimistic_write' },
              },
            );

          if (existingAttempt) {
            const isExpired = this.isAttemptDeadlineReached(existingAttempt);

            if (isExpired) {
              await this.expireAttemptInTransaction(
                manager,
                existingAttempt,
                true,
              );
            } else {
              return this.buildStartAttemptResponse(
                existingAttempt,
                quiz,
                version,
                totalQuestions,
                totalMarks,
                true,
              );
            }
          }

          const startedAt =
            new Date();

          let expiresAt:
            | Date
            | null = null;

          if (
            version.timeLimitSeconds !==
            null &&
            version.timeLimitSeconds !== undefined &&
            version.timeLimitSeconds > 0
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

          return this.buildStartAttemptResponse(
            savedAttempt,
            quiz,
            version,
            totalQuestions,
            totalMarks,
            false,
          );
        },
      );
    } catch (error) {
      // Graceful recovery from concurrent start race hitting UQ_active_attempt_user_version
      if (
        this.isUniqueActiveAttemptViolation(error) &&
        quizSnapshot &&
        versionSnapshot &&
        typeof this.quizAttemptRepository?.findOne === 'function'
      ) {
        const concurrentActive = await this.quizAttemptRepository.findOne({
          where: {
            userId,
            quizVersionId: (versionSnapshot as QuizVersion).id,
            status: AttemptStatus.IN_PROGRESS,
          },
        });
        if (concurrentActive) {
          return this.buildStartAttemptResponse(
            concurrentActive,
            quizSnapshot,
            versionSnapshot,
            totalQuestionsSnapshot,
            totalMarksSnapshot,
            true,
          );
        }
      }
      throw error;
    }
  }

  async saveAnswer(
    attemptId: string,
    questionId: string,
    dto: SaveAnswerDto,
    userOrUserId: AuthenticatedUser | string,
  ) {
    const { userId } = this.resolveUserPrincipal(userOrUserId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Find the attempt and verify ownership
        const attempt = await manager.findOne(
          QuizAttempt,
          {
            where: {
              id: attemptId,
            },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        if (!userId || attempt.userId !== userId) {
          throw new ForbiddenException(
            'You do not have permission to modify this quiz attempt',
          );
        }

        // 2. Only an in-progress attempt can be answered
        if (
          attempt.status === AttemptStatus.IN_PROGRESS &&
          this.isAttemptDeadlineReached(attempt)
        ) {
          await this.expireAttemptInTransaction(manager, attempt, true);
          throw new BadRequestException(
            'This quiz attempt has expired',
          );
        }

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
          ...new Set(dto.optionIds ?? []),
        ];

        // 5. Validate number of selected options by question type
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

        // For multiple-choice questions, an empty optionIds array clears any previously saved answer
        if (
          question.questionType ===
          QuestionType.MULTIPLE_CHOICE &&
          uniqueOptionIds.length === 0
        ) {
          const existingAnswer = await manager.findOne(
            Answer,
            {
              where: {
                attemptId: attempt.id,
                questionId: question.id,
              },
            },
          );

          if (existingAnswer) {
            await manager.delete(AnswerOption, {
              answerId: existingAnswer.id,
            });
            await manager.delete(Answer, {
              id: existingAnswer.id,
            });
          }

          return {
            answerId: null,
            attemptId: attempt.id,
            questionId: question.id,
            optionIds: [],
            answeredAt: null,
          };
        }

        if (uniqueOptionIds.length < 1) {
          throw new BadRequestException(
            'At least one option must be selected',
          );
        }

        // 6. Load the selected options
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

        // 7. Every submitted option must belong
        //    to this question
        if (
          options.length !==
          uniqueOptionIds.length
        ) {
          throw new BadRequestException(
            'One or more selected options do not belong to this question',
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
    userOrUserId: AuthenticatedUser | string,
  ) {
    const { userId } = this.resolveUserPrincipal(userOrUserId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Find the attempt and verify ownership
        const attempt = await manager.findOne(
          QuizAttempt,
          {
            where: {
              id: attemptId,
            },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        if (!userId || attempt.userId !== userId) {
          throw new ForbiddenException(
            'You do not have permission to submit this quiz attempt',
          );
        }

        // 2. If already finalized (SUBMITTED or EXPIRED), return idempotently without re-grading
        if (
          attempt.status === AttemptStatus.SUBMITTED ||
          attempt.status === AttemptStatus.EXPIRED
        ) {
          const questions = await manager.find(Question, {
            where: {
              quizVersionId: attempt.quizVersionId,
            },
          });
          const totalMarks = questions.reduce(
            (sum, q) => sum + (q.marks || 0),
            0,
          );

          return {
            attemptId: attempt.id,
            status: attempt.status,
            score: attempt.score,
            totalMarks,
            totalScore: totalMarks,
            correctAnswers: attempt.correctAnswers,
            wrongAnswers: attempt.wrongAnswers,
            unanswered: attempt.unanswered,
            percentage:
              attempt.percentage !== null && attempt.percentage !== undefined
                ? Number(attempt.percentage)
                : null,
            submittedAt: attempt.submittedAt,
          };
        }

        // 3. Enforce deadline boundary: a submission arriving at or after expiresAt transitions to EXPIRED
        if (this.isAttemptDeadlineReached(attempt)) {
          const expiredAttempt = await this.expireAttemptInTransaction(
            manager,
            attempt,
            true,
          );
          const questions = await manager.find(Question, {
            where: {
              quizVersionId: expiredAttempt.quizVersionId,
            },
          });
          const totalMarks = questions.reduce(
            (sum, q) => sum + (q.marks || 0),
            0,
          );

          return {
            attemptId: expiredAttempt.id,
            status: expiredAttempt.status,
            score: expiredAttempt.score,
            totalMarks,
            totalScore: totalMarks,
            correctAnswers: expiredAttempt.correctAnswers,
            wrongAnswers: expiredAttempt.wrongAnswers,
            unanswered: expiredAttempt.unanswered,
            percentage:
              expiredAttempt.percentage !== null && expiredAttempt.percentage !== undefined
                ? Number(expiredAttempt.percentage)
                : null,
            submittedAt: expiredAttempt.submittedAt,
          };
        }

        // 4. Calculate the final score for an on-time submission
        const result =
          await this.calculateAttemptScore(
            manager,
            attempt,
          );

        // 5. Finalize the attempt as SUBMITTED
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

        // 6. Return final result
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
    userOrUserId: AuthenticatedUser | string,
    expectedQuizId?: string,
  ): Promise<AttemptResponseDto> {
    const { userId, role } = this.resolveUserPrincipal(userOrUserId);

    return this.dataSource.transaction(
      async (manager): Promise<AttemptResponseDto> => {
        // 1. Find the attempt by ID
        let attempt = await manager.findOne(
          QuizAttempt,
          {
            where: {
              id: attemptId,
            },
          },
        );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        if (expectedQuizId && attempt.quizId !== expectedQuizId) {
          throw new NotFoundException(
            'Attempt not found for this quiz',
          );
        }

        // 2. Enforce strict learner ownership (or ADMIN override)
        const isOwner = Boolean(userId && attempt.userId === userId);
        const isAdmin = role === UserRole.ADMIN;

        if (!isOwner && !isAdmin) {
          throw new ForbiddenException(
            'You do not have permission to access this quiz attempt',
          );
        }

        // 3. Reconcile overdue timed attempts to EXPIRED
        if (
          attempt.status === AttemptStatus.IN_PROGRESS &&
          attempt.expiresAt !== null &&
          new Date() >= new Date(attempt.expiresAt)
        ) {
          attempt = await this.expireAttemptInTransaction(manager, attempt);
        }

        // 4. Load quiz and exact quiz version metadata
        const quiz = await manager.findOne(Quiz, {
          where: { id: attempt.quizId },
        });
        const version = await manager.findOne(QuizVersion, {
          where: {
            id: attempt.quizVersionId,
            quizId: attempt.quizId,
          },
        });

        // 5. Load all questions strictly from the exact
        //    quiz version used by this attempt (with options eagerly attached to prevent N+1 queries)
        const questions = await manager.find(
          Question,
          {
            where: {
              quizVersionId:
                attempt.quizVersionId,
            },
            relations: {
              options: true,
            },
            order: {
              order: 'ASC',
            },
          },
        );

        // 6. Load all answers belonging
        //    to this attempt
        const answers = await manager.find(
          Answer,
          {
            where: {
              attemptId: attempt.id,
            },
          },
        );

        // 7. Get all answer IDs
        const answerIds: string[] =
          answers.map(
            (answer: Answer) => answer.id,
          );

        // 8. Load selected options for
        //    all answers
        const answerOptions: AnswerOption[] =
          answerIds.length > 0
            ? await manager.find(
              AnswerOption,
              {
                where: {
                  answerId: In(answerIds),
                },
              },
            )
            : [];

        // 9. Map question ID → selected option IDs
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

        // 10. Build frontend-safe question response
        const result: AttemptQuestionResponseDto[] =
          [];

        for (
          const question of questions
        ) {
          // Load options for this question
          const options: Option[] =
            Array.isArray(question.options) && question.options.length > 0
              ? [...question.options].sort((a, b) => a.order - b.order)
              : await manager.find(
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
          // Never expose isCorrect or grading metadata
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

          const selectedOptionIds =
            selectedOptionsMap.get(
              question.id,
            ) ?? [];

          result.push({
            id: question.id,
            text: question.text,
            questionType:
              question.questionType,
            order: question.order,
            marks: question.marks,
            options: optionResponse,
            selectedOptionIds,
            isAnswered: selectedOptionIds.length > 0,
          });
        }

        const totalQuestions = result.length;
        const answeredQuestions = result.filter(
          (q) => q.selectedOptionIds.length > 0,
        ).length;
        const unansweredQuestions = Math.max(
          0,
          totalQuestions - answeredQuestions,
        );
        const totalMarks = result.reduce(
          (sum, q) => sum + (q.marks || 0),
          0,
        );

        const isInProgress =
          attempt.status === AttemptStatus.IN_PROGRESS;

        const remainingTimeSeconds = isInProgress
          ? this.getRemainingTimeSeconds(attempt)
          : attempt.expiresAt !== null
            ? 0
            : null;

        // 11. Return the learner-safe API response
        return {
          id: attempt.id,
          attemptId: attempt.id,

          quizId: attempt.quizId,
          quizVersionId:
            attempt.quizVersionId,
          version: version?.version,
          quizTitle: quiz?.title,

          status: attempt.status,

          startedAt:
            attempt.startedAt,

          expiresAt:
            attempt.expiresAt,

          submittedAt:
            attempt.submittedAt,

          remainingTimeSeconds,

          totalQuestions,
          answeredQuestions,
          unansweredQuestions,
          totalMarks,

          score: isInProgress ? null : attempt.score,
          correctAnswers: isInProgress
            ? null
            : attempt.correctAnswers,
          wrongAnswers: isInProgress
            ? null
            : attempt.wrongAnswers,
          unanswered: isInProgress
            ? null
            : attempt.unanswered,
          percentage:
            isInProgress || attempt.percentage === null || attempt.percentage === undefined
              ? null
              : Number(attempt.percentage),

          questions: result,
        };
      },
    );
  }

  /**
   * Calculates the elapsed time in seconds for a finalized quiz attempt.
   *
   * Lifecycle semantics:
   * - SUBMITTED: uses the actual submission timestamp minus the start timestamp.
   * - EXPIRED: bounded by the attempt deadline (expiresAt - startedAt) or version time limit,
   *   preventing lazy finalization delays from inflating elapsed time.
   * - Untimed attempts: computes duration from startedAt to finalization (submittedAt).
   * - Defensively handles null, missing, or NaN timestamps, and clamps to >= 0.
   */
  public calculateAttemptElapsedTime(
    attempt: Pick<QuizAttempt, 'status' | 'startedAt' | 'submittedAt' | 'expiresAt'>,
    version?: Pick<QuizVersion, 'timeLimitSeconds'> | null,
  ): number | null {
    if (!attempt.startedAt) {
      return null;
    }

    const startMs = new Date(attempt.startedAt).getTime();
    if (Number.isNaN(startMs)) {
      return null;
    }

    if (attempt.status === AttemptStatus.EXPIRED) {
      if (attempt.expiresAt) {
        const expireMs = new Date(attempt.expiresAt).getTime();
        if (!Number.isNaN(expireMs)) {
          return Math.max(0, Math.round((expireMs - startMs) / 1000));
        }
      }

      if (version?.timeLimitSeconds != null && version.timeLimitSeconds > 0) {
        return Math.max(0, version.timeLimitSeconds);
      }

      if (attempt.submittedAt) {
        const submitMs = new Date(attempt.submittedAt).getTime();
        if (!Number.isNaN(submitMs)) {
          return Math.max(0, Math.round((submitMs - startMs) / 1000));
        }
      }

      return null;
    }

    if (attempt.status === AttemptStatus.SUBMITTED) {
      if (!attempt.submittedAt) {
        return null;
      }

      const submitMs = new Date(attempt.submittedAt).getTime();
      if (Number.isNaN(submitMs)) {
        return null;
      }

      return Math.max(0, Math.round((submitMs - startMs) / 1000));
    }

    return null;
  }

  async getAttemptResult(
    attemptId: string,
    userOrUserId: AuthenticatedUser | string,
  ): Promise<AttemptResultResponseDto> {
    const { userId, role } = this.resolveUserPrincipal(userOrUserId);

    return this.dataSource.transaction(
      async (
        manager,
      ): Promise<AttemptResultResponseDto> => {
        // 1. Find the attempt and verify ownership, creator, or admin role
        let attempt =
          await manager.findOne(
            QuizAttempt,
            {
              where: {
                id: attemptId,
              },
            },
          );

        if (!attempt) {
          throw new NotFoundException(
            'Attempt not found',
          );
        }

        const quiz = await manager.findOne(Quiz, {
          where: { id: attempt.quizId },
        });

        const isOwner = Boolean(userId && attempt.userId === userId);
        const isAdmin = role === UserRole.ADMIN;
        const isCreator = Boolean(quiz && userId && quiz.creatorId === userId);

        if (!isOwner && !isAdmin && !isCreator) {
          throw new ForbiddenException(
            'You do not have permission to access this quiz attempt result',
          );
        }

        // Reconcile overdue timed attempts to EXPIRED
        if (
          attempt.status === AttemptStatus.IN_PROGRESS &&
          attempt.expiresAt !== null &&
          new Date() >= new Date(attempt.expiresAt)
        ) {
          attempt = await this.expireAttemptInTransaction(manager, attempt);
        }

        // 2. Result is available only after submission or expiration
        if (
          attempt.status !== AttemptStatus.SUBMITTED &&
          attempt.status !== AttemptStatus.EXPIRED
        ) {
          throw new BadRequestException(
            'Result is available only after the attempt is submitted',
          );
        }

        const version = await manager.findOne(QuizVersion, {
          where: {
            id: attempt.quizVersionId,
            quizId: attempt.quizId,
          },
        });

        // 3. Load questions strictly from the exact quiz version used by this attempt
        const questions =
          await manager.find(
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

        // 4. Calculate total marks
        const totalMarks: number =
          questions.reduce(
            (
              total: number,
              question: Question,
            ): number =>
              total + (question.marks || 0),
            0,
          );

        // 5. Load answers and selected options for post-finalization review
        const answers = await manager.find(Answer, {
          where: { attemptId: attempt.id },
        });

        const answerIds = answers.map((a) => a.id);
        const answerOptions =
          answerIds.length > 0
            ? await manager.find(AnswerOption, {
                where: answerIds.map((answerId) => ({ answerId })),
              })
            : [];

        const questionIds = questions.map((q) => q.id);
        const allOptions =
          questionIds.length > 0
            ? await manager.find(Option, {
                where: questionIds.map((questionId) => ({ questionId })),
                order: { order: 'ASC' },
              })
            : [];

        // Map answerId -> selected option IDs
        const selectedOptionsMap = new Map<string, string[]>();
        for (const ao of answerOptions) {
          const cur = selectedOptionsMap.get(ao.answerId) ?? [];
          cur.push(ao.optionId);
          selectedOptionsMap.set(ao.answerId, cur);
        }

        // Map questionId -> Answer
        const questionAnswerMap = new Map<string, Answer>(
          answers.map((a) => [a.questionId, a]),
        );

        // Map questionId -> Option[]
        const optionsByQuestion = new Map<string, Option[]>();
        for (const opt of allOptions) {
          const cur = optionsByQuestion.get(opt.questionId) ?? [];
          cur.push(opt);
          optionsByQuestion.set(opt.questionId, cur);
        }

        const questionReviews: AttemptQuestionReviewDto[] = questions.map(
          (question) => {
            const qOpts = optionsByQuestion.get(question.id) ?? [];
            const ans = questionAnswerMap.get(question.id);
            const selectedOptionIds = ans
              ? (selectedOptionsMap.get(ans.id) ?? [])
              : [];
            const correctOptionIds = qOpts
              .filter((o) => o.isCorrect)
              .map((o) => o.id);

            const isUnanswered = selectedOptionIds.length === 0;
            let isCorrect = false;

            if (!isUnanswered) {
              const sameLength =
                selectedOptionIds.length === correctOptionIds.length;
              const allSelectedAreCorrect = selectedOptionIds.every((id) =>
                correctOptionIds.includes(id),
              );
              isCorrect = sameLength && allSelectedAreCorrect;
            }

            const marks = question.marks || 0;
            const marksAwarded = isCorrect ? marks : 0;

            const reviewOptions: AttemptReviewOptionDto[] = qOpts.map((opt) => ({
              id: opt.id,
              text: opt.text,
              order: opt.order,
              isCorrect: Boolean(opt.isCorrect),
            }));

            return {
              id: question.id,
              text: question.text,
              questionType: question.questionType,
              order: question.order,
              marks,
              marksAwarded,
              isCorrect,
              isUnanswered,
              selectedOptionIds,
              correctOptionIds,
              options: reviewOptions,
            };
          },
        );

        const elapsedSeconds = this.calculateAttemptElapsedTime(
          attempt,
          version,
        );

        // 6. Return the finalized result with authorized question review
        return {
          attemptId: attempt.id,
          quizId: attempt.quizId,
          quizVersionId:
            attempt.quizVersionId,
          quizTitle: quiz?.title,
          quizVersion: version?.version,
          status: attempt.status,
          score: attempt.score,
          totalMarks,
          totalScore: totalMarks,
          correctAnswers:
            attempt.correctAnswers,
          wrongAnswers:
            attempt.wrongAnswers,
          unanswered:
            attempt.unanswered,
          percentage:
            attempt.percentage !== null && attempt.percentage !== undefined
              ? Number(attempt.percentage)
              : null,
          startedAt:
            attempt.startedAt,
          submittedAt:
            attempt.submittedAt,
          timeLimitSeconds: version?.timeLimitSeconds ?? null,
          elapsedSeconds,
          questions: questionReviews,
        };
      },
    );
  }

  async getAttemptHistory(
    param1: string,
    param2?: AttemptHistoryQueryDto | string,
    param3?: AttemptHistoryQueryDto,
  ): Promise<AttemptHistoryResponseDto> {
    let userId: string;
    let query: AttemptHistoryQueryDto;

    if (typeof param2 === 'string') {
      // Called as (quizId, userId, query)
      const quizId = param1;
      userId = param2;
      query = { ...(param3 ?? new AttemptHistoryQueryDto()), quizId };
    } else {
      // Called as (userId, query)
      userId = param1;
      query = param2 ?? new AttemptHistoryQueryDto();
    }

    const page: number = query.page && query.page > 0 ? query.page : 1;
    const limit: number = query.limit && query.limit > 0 ? query.limit : 10;
    const skip: number = (page - 1) * limit;

    const qb = this.quizAttemptRepository
      .createQueryBuilder('attempt')
      .leftJoin(Quiz, 'quiz', 'quiz.id = attempt.quiz_id')
      .leftJoin(
        QuizVersion,
        'version',
        'version.id = attempt.quiz_version_id',
      )
      .where('attempt.user_id = :userId', { userId });

    if (query.quizId) {
      qb.andWhere('attempt.quiz_id = :quizId', { quizId: query.quizId });
    }

    qb.select([
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
      'attempt.expires_at',
      'attempt.submitted_at',
      'quiz.title',
      'version.version',
    ])
      .orderBy('attempt.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    const [attempts, total] = await Promise.all([
      qb.getRawMany(),
      qb.getCount(),
    ]);

    // Batch-query total marks for distinct quiz versions in this page to avoid N+1
    const versionIds = [
      ...new Set(
        attempts
          .map(
            (a) =>
              (a.attempt_quiz_version_id as string) ||
              (a.quiz_version_id as string),
          )
          .filter(Boolean),
      ),
    ];

    const versionMarksMap = new Map<string, number>();
    if (versionIds.length > 0) {
      const questions = await this.questionRepository.find({
        where: versionIds.map((quizVersionId) => ({ quizVersionId })),
        select: { quizVersionId: true, marks: true },
      });
      for (const q of questions) {
        const cur = versionMarksMap.get(q.quizVersionId) ?? 0;
        versionMarksMap.set(q.quizVersionId, cur + (q.marks || 0));
      }
    }

    const items: AttemptHistoryItemDto[] = attempts.map(
      (attempt: Record<string, unknown>): AttemptHistoryItemDto => {
        const status = (attempt.attempt_status || attempt.status) as AttemptStatus;
        const isInProgress = status === AttemptStatus.IN_PROGRESS;
        const versionId = (attempt.attempt_quiz_version_id || attempt.quiz_version_id) as string;
        const totalMarks = versionMarksMap.get(versionId) ?? 0;

        return {
          attemptId: (attempt.attempt_id || attempt.id) as string,
          quizId: (attempt.attempt_quiz_id || attempt.quiz_id) as string,
          quizVersionId: versionId,
          quizTitle:
            (attempt.quiz_title as string) ||
            (attempt.title as string) ||
            undefined,
          version: Number(attempt.version_version || attempt.version || 1),
          status,
          // Guard: Do not expose final scores for attempts still in progress
          score:
            isInProgress || attempt.attempt_score === null || attempt.score === null
              ? null
              : Number(attempt.attempt_score ?? attempt.score),
          totalMarks,
          totalScore: totalMarks,
          correctAnswers:
            isInProgress || attempt.attempt_correct_answers === null || attempt.correct_answers === null
              ? null
              : Number(attempt.attempt_correct_answers ?? attempt.correct_answers),
          wrongAnswers:
            isInProgress || attempt.attempt_wrong_answers === null || attempt.wrong_answers === null
              ? null
              : Number(attempt.attempt_wrong_answers ?? attempt.wrong_answers),
          unanswered:
            isInProgress || attempt.attempt_unanswered === null || attempt.unanswered === null
              ? null
              : Number(attempt.attempt_unanswered ?? attempt.unanswered),
          percentage:
            isInProgress || attempt.attempt_percentage === null || attempt.percentage === null
              ? null
              : Number(attempt.attempt_percentage ?? attempt.percentage),
          startedAt: (attempt.attempt_started_at || attempt.started_at) as Date,
          expiresAt:
            ((attempt.attempt_expires_at || attempt.expires_at) as Date | null) ?? null,
          submittedAt:
            ((attempt.attempt_submitted_at || attempt.submitted_at) as
              | Date
              | null) ?? null,
        };
      },
    );

    const totalPages: number = Math.ceil(total / limit);

    return {
      items,
      page,
      limit,
      total,
      totalPages,
    };
  }

  async getCreatorQuizzes(
    userOrCreatorId: AuthenticatedUser | string,
    queryDto?: CreatorQuizQueryDto,
  ): Promise<CreatorQuizListResponseDto> {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;

    const page: number = Math.max(1, queryDto?.page ? Number(queryDto.page) : 1);
    const limit: number = Math.min(50, Math.max(1, queryDto?.limit ? Number(queryDto.limit) : 10));
    const skip: number = (page - 1) * limit;

    const qb = this.quizRepository.createQueryBuilder('quiz');

    // Ownership & Admin Policy Enforcement:
    // If not admin, the creator can only view their own quizzes (derived from JWT userId)
    if (!isAdmin) {
      qb.where('quiz.creatorId = :creatorId', { creatorId: userId });
    } else if (queryDto?.creatorId) {
      qb.where('quiz.creatorId = :creatorId', { creatorId: queryDto.creatorId });
    }

    // Status filter
    if (queryDto?.status) {
      qb.andWhere('quiz.status = :status', { status: queryDto.status });
    }

    // Search filter: title and description
    if (queryDto?.search && queryDto.search.trim()) {
      qb.andWhere(
        '(LOWER(quiz.title) LIKE LOWER(:search) OR LOWER(quiz.description) LIKE LOWER(:search))',
        { search: `%${queryDto.search.trim()}%` },
      );
    }

    qb.orderBy('quiz.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [quizzes, total] = await qb.getManyAndCount();

    // Batch query quiz versions for this page to avoid N+1
    const quizIds = quizzes.map((q) => q.id);
    const versionsByQuizId = new Map<string, QuizVersion[]>();

    if (quizIds.length > 0) {
      const versions = await this.quizVersionRepository.find({
        where: { quizId: In(quizIds) },
        order: { version: 'DESC' },
      });

      for (const v of versions) {
        const existing = versionsByQuizId.get(v.quizId) ?? [];
        existing.push(v);
        versionsByQuizId.set(v.quizId, existing);
      }
    }

    const items: CreatorQuizListItemDto[] = quizzes.map((quiz: Quiz): CreatorQuizListItemDto => {
      const versions = versionsByQuizId.get(quiz.id) ?? [];
      const publishedVersionsCount = versions.filter((v) => v.status === QuizVersionStatus.PUBLISHED).length;
      const draftVersion = versions.find((v) => v.status === QuizVersionStatus.DRAFT);
      const latestVersion = versions[0];

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        status: quiz.status,
        publishedVersionsCount,
        hasDraft: Boolean(draftVersion),
        latestVersion: latestVersion ? latestVersion.version : 1,
        latestVersionId: latestVersion ? latestVersion.id : null,
        latestVersionStatus: latestVersion ? latestVersion.status : null,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
      };
    });

    const totalPages: number = Math.ceil(total / limit) || 1;

    return {
      items,
      page,
      limit,
      total,
      totalPages,
    };
  }

  async getCreatorQuizDetails(
    quizId: string,
    userOrCreatorId: AuthenticatedUser | string,
  ): Promise<CreatorQuizDetailsResponseDto> {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;

    let quiz: Quiz | null;
    if (isAdmin) {
      quiz = await this.quizRepository.findOne({
        where: { id: quizId },
      });
    } else {
      const organizationId = await this.getCreatorOrganizationId(userId);
      quiz = await this.quizRepository.findOne({
        where: {
          id: quizId,
          creatorId: userId,
          organizationId: organizationId === null ? IsNull() : organizationId,
        },
      });
    }

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
        timeLimitSeconds: version.timeLimitSeconds,
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
    userOrCreatorId: AuthenticatedUser | string,
    dto: UpdateQuizDto,
  ): Promise<QuizResponseDto> {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;

    let quiz: Quiz | null;
    if (isAdmin) {
      quiz = await this.quizRepository.findOne({
        where: { id: quizId },
      });
    } else {
      const organizationId = await this.getCreatorOrganizationId(userId);
      quiz = await this.quizRepository.findOne({
        where: {
          id: quizId,
          creatorId: userId,
          organizationId: organizationId === null ? IsNull() : organizationId,
        },
      });
    }

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
    userOrCreatorId: AuthenticatedUser | string,
  ): Promise<QuizVersionResponseDto> {
    const principal = this.resolveUserPrincipal(userOrCreatorId);
    const userId = principal.userId;
    const isAdmin = principal.role === UserRole.ADMIN;
    const organizationId = isAdmin ? null : await this.getCreatorOrganizationId(userId);

    return this.dataSource.transaction(
      async (manager) => {
        // 1. Verify quiz ownership and lock Quiz first
        const quiz = await manager.findOne(
          Quiz,
          {
            where: isAdmin
              ? { id: quizId }
              : {
                  id: quizId,
                  creatorId: userId,
                  organizationId: organizationId === null ? IsNull() : organizationId,
                },
            lock: { mode: 'pessimistic_write' },
          },
        );

        if (!quiz) {
          throw new NotFoundException(
            'Quiz not found',
          );
        }

        // 2. Lock the version belonging to this quiz
        const version =
          await manager.findOne(
            QuizVersion,
            {
              where: {
                id: quizVersionId,
                quizId: quiz.id,
              },
              lock: { mode: 'pessimistic_write' },
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

  async assertLearnerCanAccessQuiz(
    quiz: Quiz,
    _version?: QuizVersion | null,
    userOrUserId?: AuthenticatedUser | string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!quiz.organizationId) {
      return; // Public quizzes are open to all authenticated learners
    }

    if (!userOrUserId) {
      throw new ForbiddenException('You are not assigned to take this quiz');
    }

    const { userId, role } = this.resolveUserPrincipal(userOrUserId);
    if (!userId) {
      throw new ForbiddenException('You are not assigned to take this quiz');
    }

    if (role === UserRole.ADMIN || quiz.creatorId === userId) {
      return; // Admins and creator have access
    }

    const assignmentRepo = manager
      ? manager.getRepository(QuizAssignment)
      : this.dataSource.getRepository(QuizAssignment);
    const recipientRepo = manager
      ? manager.getRepository(QuizAssignmentRecipient)
      : this.dataSource.getRepository(QuizAssignmentRecipient);

    const assignments = await assignmentRepo.find({
      where: {
        quizId: quiz.id,
        organizationId: quiz.organizationId,
        isActive: true,
      },
    });

    if (assignments.length === 0) {
      throw new ForbiddenException('You are not assigned to take this quiz');
    }

    const recipientRecords = await recipientRepo.find({
      where: {
        studentId: userId,
      },
    });

    const isRecipient = assignments.some((a) =>
      recipientRecords.some((r) => r.assignmentId === a.id),
    );

    if (!isRecipient) {
      throw new ForbiddenException('You are not assigned to take this quiz');
    }
  }

  async getPublishedQuizVersion(
    quizId: string,
    quizVersionId: string,
    userOrUserId?: AuthenticatedUser | string,
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

    await this.assertLearnerCanAccessQuiz(quiz, null, userOrUserId);

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

    const questionIds = questions.map((q) => q.id);
    const options = questionIds.length > 0
      ? await this.optionRepository.find({
          where: {
            questionId: In(questionIds),
          },
          order: {
            order: 'ASC',
          },
        })
      : [];

    const optionsByQuestionId = new Map<string, Option[]>();
    for (const opt of options) {
      const qId = opt.questionId ?? (questions.length === 1 ? questions[0].id : undefined);
      if (qId) {
        const list = optionsByQuestionId.get(qId) ?? [];
        list.push(opt);
        optionsByQuestionId.set(qId, list);
      }
    }

    const questionResponses: TakerQuestionResponseDto[] =
      [];

    for (const question of questions) {
      const questionOptions = optionsByQuestionId.get(question.id) ?? [];
      const optionResponses: TakerOptionResponseDto[] =
        questionOptions.map(
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

    const totalMarks = questionResponses.reduce(
      (sum, q) => sum + (q.marks || 0),
      0,
    );

    return {
      quizId: quiz.id,
      quizVersionId: version.id,
      organizationId: quiz.organizationId ?? null,

      title: quiz.title,
      quizTitle: quiz.title,
      description: quiz.description,
      quizDescription: quiz.description,

      version: version.version,
      status: version.status,
      totalMarks,

      timeLimitSeconds:
        version.timeLimitSeconds,

      questions:
        questionResponses,
    };
  }

  async getLatestPublishedQuizVersion(
    quizId: string,
    userOrUserId?: AuthenticatedUser | string,
  ): Promise<TakerQuizVersionResponseDto> {
    const quiz = await this.quizRepository.findOne({
      where: {
        id: quizId,
        status: QuizStatus.PUBLISHED,
      },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    await this.assertLearnerCanAccessQuiz(quiz, null, userOrUserId);

    const latestPublishedVersion = await this.quizVersionRepository.findOne({
      where: {
        quizId: quiz.id,
        status: QuizVersionStatus.PUBLISHED,
      },
      order: {
        version: 'DESC',
      },
    });

    if (!latestPublishedVersion) {
      throw new NotFoundException('No published version found for this quiz');
    }

    return this.getPublishedQuizVersion(quiz.id, latestPublishedVersion.id, userOrUserId);
  }

  async getPublishedQuizzes(
    queryDto?: PublishedQuizQueryDto,
    userOrUserId?: AuthenticatedUser | string,
  ): Promise<PublishedQuizListResponseDto> {
    const page: number = Math.max(1, queryDto?.page ? Number(queryDto.page) : 1);
    const limit: number = Math.min(50, Math.max(1, queryDto?.limit ? Number(queryDto.limit) : 10));
    const skip: number = (page - 1) * limit;

    const qb = this.quizRepository.createQueryBuilder('quiz')
      .where('quiz.status = :status', { status: QuizStatus.PUBLISHED });

    if (userOrUserId) {
      const principal = this.resolveUserPrincipal(userOrUserId);
      const isAdmin = principal.role === UserRole.ADMIN;

      if (!isAdmin) {
        let assignedQuizIds: string[] = [];
        if (principal.userId) {
          try {
            const recipientRepo = this.dataSource.getRepository(QuizAssignmentRecipient);
            const recipientRecords = await recipientRepo.find({
              where: { studentId: principal.userId },
              relations: { assignment: true },
            });
            assignedQuizIds = recipientRecords
              .filter((r) => r.assignment && r.assignment.isActive)
              .map((r) => r.assignment.quizId);
          } catch {
            assignedQuizIds = [];
          }
        }

        if (assignedQuizIds.length > 0) {
          qb.andWhere(
            '(quiz.organizationId IS NULL OR quiz.creatorId = :currentUserId OR quiz.id IN (:...assignedQuizIds))',
            { currentUserId: principal.userId, assignedQuizIds },
          );
        } else {
          qb.andWhere(
            '(quiz.organizationId IS NULL OR quiz.creatorId = :currentUserId)',
            { currentUserId: principal.userId },
          );
        }
      }
    } else {
      qb.andWhere('quiz.organizationId IS NULL');
    }

    if (queryDto?.search && queryDto.search.trim()) {
      qb.andWhere(
        '(LOWER(quiz.title) LIKE LOWER(:search) OR LOWER(quiz.description) LIKE LOWER(:search))',
        { search: `%${queryDto.search.trim()}%` },
      );
    }

    if (queryDto?.timing === 'timed') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM quiz_versions pv
          WHERE pv.quiz_id = quiz.id
            AND pv.status = :pubVersionStatus
            AND pv.time_limit_seconds IS NOT NULL
            AND pv.time_limit_seconds > 0
            AND pv.version = (
              SELECT MAX(pv2.version) FROM quiz_versions pv2
              WHERE pv2.quiz_id = quiz.id AND pv2.status = :pubVersionStatus
            )
        )`,
        { pubVersionStatus: QuizVersionStatus.PUBLISHED },
      );
    } else if (queryDto?.timing === 'untimed') {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM quiz_versions pv
          WHERE pv.quiz_id = quiz.id
            AND pv.status = :pubVersionStatus
            AND (pv.time_limit_seconds IS NULL OR pv.time_limit_seconds = 0)
            AND pv.version = (
              SELECT MAX(pv2.version) FROM quiz_versions pv2
              WHERE pv2.quiz_id = quiz.id AND pv2.status = :pubVersionStatus
            )
        )`,
        { pubVersionStatus: QuizVersionStatus.PUBLISHED },
      );
    }

    qb.orderBy('quiz.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [quizzes, total] = await qb.getManyAndCount();

    const quizIds = quizzes.map((q) => q.id);
    const publishedVersionsByQuizId = new Map<string, QuizVersion>();

    if (quizIds.length > 0) {
      const versions = await this.quizVersionRepository.find({
        where: {
          quizId: In(quizIds),
          status: QuizVersionStatus.PUBLISHED,
        },
        order: { version: 'DESC' },
      });

      for (const v of versions) {
        if (!publishedVersionsByQuizId.has(v.quizId)) {
          publishedVersionsByQuizId.set(v.quizId, v);
        }
      }
    }

    let eligibleQuizzes = quizzes.filter((q) => publishedVersionsByQuizId.has(q.id));

    if (queryDto?.timing === 'timed') {
      eligibleQuizzes = eligibleQuizzes.filter((q) => {
        const v = publishedVersionsByQuizId.get(q.id);
        return v && v.timeLimitSeconds && v.timeLimitSeconds > 0;
      });
    } else if (queryDto?.timing === 'untimed') {
      eligibleQuizzes = eligibleQuizzes.filter((q) => {
        const v = publishedVersionsByQuizId.get(q.id);
        return v && (!v.timeLimitSeconds || v.timeLimitSeconds === 0);
      });
    }

    const latestVersionIds = eligibleQuizzes.map((q) => publishedVersionsByQuizId.get(q.id)!.id);
    const questionsByVersionId = new Map<string, Question[]>();

    if (latestVersionIds.length > 0) {
      const questions = await this.questionRepository.find({
        where: { quizVersionId: In(latestVersionIds) },
      });

      for (const q of questions) {
        const list = questionsByVersionId.get(q.quizVersionId) ?? [];
        list.push(q);
        questionsByVersionId.set(q.quizVersionId, list);
      }
    }

    const items: PublishedQuizListItemDto[] = eligibleQuizzes.map((quiz) => {
      const version = publishedVersionsByQuizId.get(quiz.id)!;
      const questions = questionsByVersionId.get(version.id) ?? [];
      const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        organizationId: quiz.organizationId ?? null,
        latestPublishedVersionId: version.id,
        latestPublishedVersionNumber: version.version,
        timeLimitSeconds: version.timeLimitSeconds,
        totalQuestions: questions.length,
        totalMarks,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
        publishedAt: version.publishedAt,
      };
    });

    const effectiveTotal = Math.min(total, eligibleQuizzes.length) || total;

    return {
      items,
      total: effectiveTotal,
      page,
      limit,
      totalPages: Math.ceil(effectiveTotal / limit) || 1,
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
        attempt.status === AttemptStatus.EXPIRED
          ? 'This quiz attempt has expired'
          : 'This attempt is no longer active',
      );
    }

    if (this.isAttemptDeadlineReached(attempt)) {
      await this.expireAttemptInTransaction(manager, attempt, true);
      throw new BadRequestException(
        'This quiz attempt has expired',
      );
    }
  }

  private getRemainingTimeSeconds(
    attempt: QuizAttempt,
  ): number | null {
    if (attempt.expiresAt === null || attempt.expiresAt === undefined) {
      return null;
    }

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      return 0;
    }

    const remainingMilliseconds =
      new Date(attempt.expiresAt).getTime() -
      Date.now();

    if (remainingMilliseconds <= 0) {
      return 0;
    }

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
          total + (question.marks || 0),
        0,
      );

    let score = 0;
    let correctAnswers = 0;
    let wrongAnswers = 0;
    let unanswered = 0;

    // 9. Evaluate every question in memory
    // Established scoring policy:
    // - Unanswered: no Answer record OR empty selected options set (selectedSet.size === 0).
    // - Correct: exact set equality between selected options and correct options (all-or-nothing, no partial credit).
    // - Wrong: non-empty selection that does not match the correct options set exactly.
    for (const question of questions) {
      const answer = answerMap.get(
        question.id,
      );

      // No answer record
      if (!answer) {
        unanswered++;
        continue;
      }

      const selectedSet =
        selectedOptionsMap.get(
          answer.id,
        ) ?? new Set<string>();

      // Empty selection is treated consistently as unanswered
      if (selectedSet.size === 0) {
        unanswered++;
        continue;
      }

      const correctSet =
        correctOptionsMap.get(
          question.id,
        ) ?? new Set<string>();

      // Both sets must contain exactly the same option IDs (all-or-nothing policy).
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
        score += (question.marks || 0);
      } else {
        wrongAnswers++;
      }
    }

    // Percentage calculation: (score / totalMarks) * 100 rounded to 2 decimal places.
    // When totalMarks === 0 (zero possible marks), percentage safely evaluates to 0.
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

  async getQuizAnalytics(
    quizId: string,
    versionId?: string,
    user?: AuthenticatedUser,
  ): Promise<QuizAnalyticsResponseDto> {
    if (!user || !user.userId) {
      throw new ForbiddenException('Authenticated user identity is required');
    }

    const quiz = await this.quizRepository.findOne({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new NotFoundException('Quiz not found');
    }

    // Access authorization check:
    // Only administrators and the quiz creator can view analytics.
    // Cross-creator inspection by changing quizId is strictly forbidden.
    const isAdmin = user.role === UserRole.ADMIN;
    const isCreator = user.userId === quiz.creatorId;

    if (!isAdmin && !isCreator) {
      throw new ForbiddenException('You do not have permission to view analytics for this quiz');
    }

    if (!isAdmin && quiz.organizationId) {
      const membership = await this.organizationService.getPrimaryMembership(user.userId);
      if (!membership || membership.organizationId !== quiz.organizationId) {
        throw new ForbiddenException('You do not have permission to view analytics for this organization quiz');
      }
    }

    // Fetch all versions for version selector and version summaries
    const versions = await this.quizVersionRepository.find({
      where: { quizId: quiz.id },
      order: { version: 'DESC' },
    });

    if (versions.length === 0) {
      throw new NotFoundException('No versions found for this quiz');
    }

    let targetVersion = versions[0];
    if (versionId) {
      const found = versions.find((v) => v.id === versionId);
      if (!found) {
        throw new NotFoundException('Quiz version not found');
      }
      targetVersion = found;
    } else {
      const published = versions.find((v) => v.status === QuizVersionStatus.PUBLISHED);
      if (published) {
        targetVersion = published;
      }
    }

    const publishedVersionsCount = versions.filter(
      (v) => v.status === QuizVersionStatus.PUBLISHED,
    ).length;

    const availableVersions: AnalyticsVersionItemDto[] = versions.map((v) => ({
      id: v.id,
      versionNumber: v.version,
      status: v.status,
    }));

    // Multi-version summaries breakdown
    const allVersionIds = versions.map((v) => v.id);
    const allAttempts = await this.quizAttemptRepository.find({
      where: { quizVersionId: In(allVersionIds) },
      select: {
        id: true,
        quizVersionId: true,
        status: true,
        score: true,
        percentage: true,
      },
    });

    const allQuestions = await this.questionRepository.find({
      where: { quizVersionId: In(allVersionIds) },
      select: {
        id: true,
        quizVersionId: true,
        marks: true,
      },
    });

    const questionsByVersion = new Map<string, typeof allQuestions>();
    for (const q of allQuestions) {
      const list = questionsByVersion.get(q.quizVersionId) ?? [];
      list.push(q);
      questionsByVersion.set(q.quizVersionId, list);
    }

    const versionSummaries: VersionAnalyticsSummaryDto[] = versions.map((v) => {
      const vAttempts = allAttempts.filter((a) => a.quizVersionId === v.id);
      const vQuestions = questionsByVersion.get(v.id) ?? [];
      const vTotalMarks = vQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);
      const vSubmitted = vAttempts.filter((a) => a.status === AttemptStatus.SUBMITTED).length;
      const vExpired = vAttempts.filter((a) => a.status === AttemptStatus.EXPIRED).length;
      const vInProgress = vAttempts.filter((a) => a.status === AttemptStatus.IN_PROGRESS).length;
      const vFinalized = vAttempts.filter(
        (a) => a.status === AttemptStatus.SUBMITTED || a.status === AttemptStatus.EXPIRED,
      );
      const vScored = vFinalized.filter((a) => a.score !== null && a.score !== undefined);
      const vPercent = vFinalized.filter((a) => a.percentage !== null && a.percentage !== undefined);

      const avgScore =
        vScored.length > 0
          ? Math.round((vScored.reduce((sum, a) => sum + Number(a.score), 0) / vScored.length) * 100) / 100
          : 0;
      const avgPercentage =
        vPercent.length > 0
          ? Math.round((vPercent.reduce((sum, a) => sum + Number(a.percentage), 0) / vPercent.length) * 100) / 100
          : 0;
      const highestPercentage =
        vPercent.length > 0 ? Math.max(...vPercent.map((a) => Number(a.percentage))) : 0;
      const lowestPercentage =
        vPercent.length > 0 ? Math.min(...vPercent.map((a) => Number(a.percentage))) : 0;

      return {
        versionId: v.id,
        versionNumber: v.version,
        status: v.status,
        totalQuestions: vQuestions.length,
        totalMarks: vTotalMarks,
        timeLimitSeconds: v.timeLimitSeconds,
        totalAttempts: vAttempts.length,
        submittedAttempts: vSubmitted,
        expiredAttempts: vExpired,
        inProgressAttempts: vInProgress,
        avgScore,
        avgPercentage,
        highestPercentage,
        lowestPercentage,
      };
    });

    // Detailed metrics for targetVersion
    const targetAttempts = await this.quizAttemptRepository.find({
      where: { quizVersionId: targetVersion.id },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    const totalAttempts = targetAttempts.length;
    const submittedAttempts = targetAttempts.filter((a) => a.status === AttemptStatus.SUBMITTED).length;
    const expiredAttempts = targetAttempts.filter((a) => a.status === AttemptStatus.EXPIRED).length;
    const inProgressAttempts = targetAttempts.filter((a) => a.status === AttemptStatus.IN_PROGRESS).length;
    const completedAttemptsList = targetAttempts.filter(
      (a) => a.status === AttemptStatus.SUBMITTED || a.status === AttemptStatus.EXPIRED,
    );
    const completedAttempts = completedAttemptsList.length;

    const completionRate =
      totalAttempts > 0 ? Math.round((submittedAttempts / totalAttempts) * 10000) / 100 : 0;
    const finalizedRate =
      totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 10000) / 100 : 0;

    const questions = await this.questionRepository.find({
      where: { quizVersionId: targetVersion.id },
      relations: { options: true },
      order: { order: 'ASC' },
    });

    const totalQuestions = questions.length;
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

    const scoredAttempts = completedAttemptsList.filter(
      (a) => a.score !== null && a.score !== undefined,
    );
    const percentAttempts = completedAttemptsList.filter(
      (a) => a.percentage !== null && a.percentage !== undefined,
    );

    const avgScore =
      scoredAttempts.length > 0
        ? Math.round((scoredAttempts.reduce((sum, a) => sum + Number(a.score), 0) / scoredAttempts.length) * 100) / 100
        : 0;
    const avgPercentage =
      percentAttempts.length > 0
        ? Math.round((percentAttempts.reduce((sum, a) => sum + Number(a.percentage), 0) / percentAttempts.length) * 100) / 100
        : 0;
    const highestScore =
      scoredAttempts.length > 0 ? Math.max(...scoredAttempts.map((a) => Number(a.score))) : 0;
    const lowestScore =
      scoredAttempts.length > 0 ? Math.min(...scoredAttempts.map((a) => Number(a.score))) : 0;
    const highestPercentage =
      percentAttempts.length > 0 ? Math.max(...percentAttempts.map((a) => Number(a.percentage))) : 0;
    const lowestPercentage =
      percentAttempts.length > 0 ? Math.min(...percentAttempts.map((a) => Number(a.percentage))) : 0;

    let totalDuration = 0;
    let durationCount = 0;
    let totalCorrectAnswers = 0;
    let totalWrongAnswers = 0;
    let totalUnanswered = 0;

    const scoreBuckets = {
      range90To100: 0,
      range80To89: 0,
      range70To79: 0,
      range60To69: 0,
      rangeBelow60: 0,
    };

    for (const attempt of completedAttemptsList) {
      if (attempt.startedAt) {
        const endTime =
          attempt.status === AttemptStatus.EXPIRED && attempt.expiresAt
            ? new Date(attempt.expiresAt).getTime()
            : attempt.submittedAt
              ? new Date(attempt.submittedAt).getTime()
              : 0;
        if (endTime > 0) {
          const dur = Math.max(0, Math.round((endTime - new Date(attempt.startedAt).getTime()) / 1000));
          totalDuration += dur;
          durationCount++;
        }
      }

      totalCorrectAnswers += attempt.correctAnswers ?? 0;
      totalWrongAnswers += attempt.wrongAnswers ?? 0;
      totalUnanswered += attempt.unanswered ?? 0;

      const p = Number(attempt.percentage ?? 0);
      if (p >= 90) scoreBuckets.range90To100++;
      else if (p >= 80) scoreBuckets.range80To89++;
      else if (p >= 70) scoreBuckets.range70To79++;
      else if (p >= 60) scoreBuckets.range60To69++;
      else scoreBuckets.rangeBelow60++;
    }

    const avgDurationSeconds = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    const calcBucket = (count: number) => ({
      count,
      percentage: completedAttempts > 0 ? Math.round((count / completedAttempts) * 10000) / 100 : 0,
    });

    const scoreDistribution: ScoreDistributionDto = {
      range90To100: calcBucket(scoreBuckets.range90To100),
      range80To89: calcBucket(scoreBuckets.range80To89),
      range70To79: calcBucket(scoreBuckets.range70To79),
      range60To69: calcBucket(scoreBuckets.range60To69),
      rangeBelow60: calcBucket(scoreBuckets.rangeBelow60),
    };

    // Mask email for learner privacy safety: u***@domain.com
    const maskEmail = (email: string) => {
      if (!email || !email.includes('@')) return email || '';
      const [local, domain] = email.split('@');
      if (local.length <= 2) return `${local[0]}***@${domain}`;
      return `${local.slice(0, 2)}***@${domain}`;
    };

    // Top Scorers Leaderboard (finalized attempts only)
    const sortedCompleted = [...completedAttemptsList].sort((a, b) => {
      const pA = Number(a.percentage ?? 0);
      const pB = Number(b.percentage ?? 0);
      if (pB !== pA) return pB - pA;
      const sA = Number(a.score ?? 0);
      const sB = Number(b.score ?? 0);
      if (sB !== sA) return sB - sA;
      return new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime();
    });

    const topScorers: TopScorerDto[] = sortedCompleted.slice(0, 10).map((a) => {
      let dur = 0;
      if (a.startedAt) {
        const endTime =
          a.status === AttemptStatus.EXPIRED && a.expiresAt
            ? new Date(a.expiresAt).getTime()
            : a.submittedAt
              ? new Date(a.submittedAt).getTime()
              : 0;
        if (endTime > 0) {
          dur = Math.max(0, Math.round((endTime - new Date(a.startedAt).getTime()) / 1000));
        }
      }
      return {
        attemptId: a.id,
        userId: a.userId,
        username: a.user?.username ?? (a.user?.email ? a.user.email.split('@')[0] : 'Learner'),
        email: a.user?.email ? maskEmail(a.user.email) : '',
        score: Number(a.score ?? 0),
        totalMarks,
        percentage: Number(a.percentage ?? 0),
        durationSeconds: dur,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : new Date().toISOString(),
      };
    });

    // Question analytics & option selection breakdown
    const completedAttemptIds = completedAttemptsList.map((a) => a.id);
    const questionAnalytics: QuestionAnalyticsDto[] = [];

    if (completedAttemptIds.length > 0 && questions.length > 0) {
      const answers = await this.dataSource.getRepository(Answer).find({
        where: { attemptId: In(completedAttemptIds) },
      });
      const answerIds = answers.map((ans) => ans.id);

      let answerOptions: AnswerOption[] = [];
      if (answerIds.length > 0) {
        answerOptions = await this.dataSource.getRepository(AnswerOption).find({
          where: { answerId: In(answerIds) },
        });
      }

      const answerOptionMap = new Map<string, string[]>();
      for (const ao of answerOptions) {
        const list = answerOptionMap.get(ao.answerId) ?? [];
        list.push(ao.optionId);
        answerOptionMap.set(ao.answerId, list);
      }

      const questionAnswersMap = new Map<string, Map<string, string[]>>();
      for (const ans of answers) {
        let qMap = questionAnswersMap.get(ans.questionId);
        if (!qMap) {
          qMap = new Map();
          questionAnswersMap.set(ans.questionId, qMap);
        }
        const selectedOptionIds = answerOptionMap.get(ans.id) ?? [];
        qMap.set(ans.attemptId, selectedOptionIds);
      }

      for (const q of questions) {
        const qAnswers = questionAnswersMap.get(q.id) ?? new Map<string, string[]>();
        const correctOptionIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));

        let qCorrectCount = 0;
        let qWrongCount = 0;
        let qUnansweredCount = 0;

        const optionSelectionCounts = new Map<string, number>();
        q.options.forEach((o) => optionSelectionCounts.set(o.id, 0));

        for (const attemptId of completedAttemptIds) {
          const selected = qAnswers.get(attemptId);
          if (!selected || selected.length === 0) {
            qUnansweredCount++;
          } else {
            for (const optId of selected) {
              const current = optionSelectionCounts.get(optId) ?? 0;
              optionSelectionCounts.set(optId, current + 1);
            }

            // All-or-nothing grading rule: exact set equality between selected and correct options
            const isSetEqual =
              selected.length === correctOptionIds.size &&
              selected.every((id) => correctOptionIds.has(id));

            if (isSetEqual) {
              qCorrectCount++;
            } else {
              qWrongCount++;
            }
          }
        }

        const calcPct = (cnt: number) =>
          completedAttempts > 0 ? Math.round((cnt / completedAttempts) * 10000) / 100 : 0;

        const correctPercentage = calcPct(qCorrectCount);
        const wrongPercentage = calcPct(qWrongCount);
        const unansweredPercentage = calcPct(qUnansweredCount);

        let difficultyEstimate: 'EASY' | 'MEDIUM' | 'HARD' = 'MEDIUM';
        if (completedAttempts > 0) {
          if (correctPercentage >= 75) {
            difficultyEstimate = 'EASY';
          } else if (correctPercentage < 40) {
            difficultyEstimate = 'HARD';
          } else {
            difficultyEstimate = 'MEDIUM';
          }
        }

        const optionDtos: OptionDistributionDto[] = q.options.map((opt) => {
          const count = optionSelectionCounts.get(opt.id) ?? 0;
          return {
            optionId: opt.id,
            optionText: opt.text,
            isCorrect: opt.isCorrect,
            selectionCount: count,
            selectionPercentage: calcPct(count),
          };
        });

        questionAnalytics.push({
          questionId: q.id,
          questionText: q.text,
          questionType: q.questionType,
          marks: q.marks,
          order: q.order,
          attemptCount: completedAttempts,
          correctCount: qCorrectCount,
          correctPercentage,
          wrongCount: qWrongCount,
          wrongPercentage,
          unansweredCount: qUnansweredCount,
          unansweredPercentage,
          difficultyEstimate,
          observedAccuracy: correctPercentage,
          options: optionDtos,
        });
      }
    } else {
      for (const q of questions) {
        questionAnalytics.push({
          questionId: q.id,
          questionText: q.text,
          questionType: q.questionType,
          marks: q.marks,
          order: q.order,
          attemptCount: 0,
          correctCount: 0,
          correctPercentage: 0,
          wrongCount: 0,
          wrongPercentage: 0,
          unansweredCount: 0,
          unansweredPercentage: 0,
          difficultyEstimate: 'MEDIUM',
          observedAccuracy: 0,
          options: q.options.map((opt) => ({
            optionId: opt.id,
            optionText: opt.text,
            isCorrect: opt.isCorrect,
            selectionCount: 0,
            selectionPercentage: 0,
          })),
        });
      }
    }

    // Question Type Breakdown
    const questionTypeBreakdown: Record<string, QuestionTypePerformanceDto> = {};
    for (const q of questions) {
      const typeKey = q.questionType;
      if (!questionTypeBreakdown[typeKey]) {
        questionTypeBreakdown[typeKey] = {
          questionType: typeKey,
          questionCount: 0,
          totalResponses: 0,
          correctResponses: 0,
          accuracyPercentage: 0,
        };
      }
      questionTypeBreakdown[typeKey].questionCount += 1;
      const qa = questionAnalytics.find((item) => item.questionId === q.id);
      if (qa) {
        questionTypeBreakdown[typeKey].totalResponses += qa.attemptCount;
        questionTypeBreakdown[typeKey].correctResponses += qa.correctCount;
      }
    }
    for (const key of Object.keys(questionTypeBreakdown)) {
      const grp = questionTypeBreakdown[key];
      grp.accuracyPercentage =
        grp.totalResponses > 0
          ? Math.round((grp.correctResponses / grp.totalResponses) * 10000) / 100
          : 0;
    }

    return {
      quizId: quiz.id,
      quizTitle: quiz.title,
      versionId: targetVersion.id,
      versionNumber: targetVersion.version,
      publishedVersionsCount,
      availableVersions,
      versionSummaries,
      summary: {
        totalAttempts,
        submittedAttempts,
        expiredAttempts,
        inProgressAttempts,
        completedAttempts,
        completionRate,
        finalizedRate,
        avgScore,
        avgPercentage,
        highestScore,
        lowestScore,
        highestPercentage,
        lowestPercentage,
        avgDurationSeconds,
        totalQuestions,
        totalMarks,
        totalCorrectAnswers,
        totalWrongAnswers,
        totalUnanswered,
        publishedVersionsCount,
      },
      questionTypeBreakdown,
      scoreDistribution,
      topScorers,
      questionAnalytics,
    };
  }
}