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
}