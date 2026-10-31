import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import net from 'node:net';
import { config } from 'dotenv';
import { resolve } from 'path';

// Entities
import { User } from '../src/modules/users/entities/user.entity.js';
import { Organization } from '../src/modules/organizations/entities/organization.entity.js';
import { OrganizationMember } from '../src/modules/organizations/entities/organization-member.entity.js';
import { Quiz } from '../src/modules/quizzes/entities/quiz.entity.js';
import { QuizVersion } from '../src/modules/quizzes/entities/quiz-version.entity.js';
import { Question } from '../src/modules/quizzes/entities/question.entity.js';
import { Option } from '../src/modules/quizzes/entities/option.entity.js';
import { QuizAttempt } from '../src/modules/quizzes/entities/quiz-attempt.entity.js';
import { Answer } from '../src/modules/quizzes/entities/answer.entity.js';
import { AnswerOption } from '../src/modules/quizzes/entities/answer-option.entity.js';
import { QuizQuestionGeneration } from '../src/modules/quizzes/entities/quiz-question-generation.entity.js';
import { Classroom } from '../src/modules/classrooms/entities/classroom.entity.js';
import { ClassroomStudent } from '../src/modules/classrooms/entities/classroom-student.entity.js';
import { ClassroomTeacher } from '../src/modules/classrooms/entities/classroom-teacher.entity.js';
import { QuizAssignment } from '../src/modules/quiz-assignments/entities/quiz-assignment.entity.js';
import { QuizAssignmentRecipient } from '../src/modules/quiz-assignments/entities/quiz-assignment-recipient.entity.js';
import { Session } from '../src/modules/auth/entities/session.entity.js';

// Services & Enums
import { QuizService } from '../src/modules/quizzes/quizzes.service.js';
import { OrganizationService } from '../src/modules/organizations/organization.service.js';
import { AttemptStatus } from '../src/modules/quizzes/enums/attempt-status.enum.js';
import { QuestionType } from '../src/modules/quizzes/enums/question-type.enum.js';
import { QuizStatus } from '../src/modules/quizzes/enums/quiz-status.enum.js';
import { QuizVersionStatus } from '../src/modules/quizzes/enums/quiz-version-status.enum.js';
import { UserRole } from '../src/modules/users/enums/user-role.enum.js';

// Load environment variables from apps/api/.env
config({ path: resolve(process.cwd(), '.env') });

function checkPortOpen(host: string, port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((res) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      res(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      res(false);
    });
    socket.once('error', () => {
      socket.destroy();
      res(false);
    });
    socket.connect(port, host);
  });
}

describe('Phase 6.6 — Live PostgreSQL Integration Test Suite', () => {
  let dataSource: DataSource;
  let quizService: QuizService;
  let isDbAvailable = false;
  let isRedisAvailable = false;

  const testId = `integ_${Date.now()}`;
  let testUser: User;
  let testOrg: Organization;
  let testQuiz: Quiz;
  let version1: QuizVersion;
  let version2: QuizVersion;
  let q1: Question;
  let q1OptA: Option;
  let _q1OptB: Option;
  let q2: Question;
  let q2OptA: Option;
  let q2OptB: Option;

  beforeAll(async () => {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = Number(process.env.DB_PORT || 5432);
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = Number(process.env.REDIS_PORT || 6379);

    isDbAvailable = await checkPortOpen(dbHost, dbPort);
    isRedisAvailable = await checkPortOpen(redisHost, redisPort);

    if (!isDbAvailable) {
      console.warn(
        `\n[Phase 6.6 Integration Test Notice] PostgreSQL is offline at ${dbHost}:${dbPort}.\n` +
          `Live database tests are skipped. Run 'docker compose up -d' to start quiz-postgres.\n`,
      );
      return;
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: dbHost,
      port: dbPort,
      username: process.env.DB_USERNAME || 'TestUser',
      password: process.env.DB_PASSWORD || 'Test@1234',
      database: process.env.DB_DATABASE || 'quiz_platform',
      entities: [
        User,
        Organization,
        OrganizationMember,
        Quiz,
        QuizVersion,
        Question,
        Option,
        QuizAttempt,
        Answer,
        AnswerOption,
        QuizQuestionGeneration,
        Classroom,
        ClassroomStudent,
        ClassroomTeacher,
        QuizAssignment,
        QuizAssignmentRecipient,
        Session,
      ],
      synchronize: false,
    });

    await dataSource.initialize();

    const orgService = new OrganizationService(
      dataSource.getRepository(Organization),
      dataSource.getRepository(OrganizationMember),
    );

    quizService = new QuizService(
      dataSource.getRepository(Quiz),
      dataSource.getRepository(QuizVersion),
      dataSource,
      dataSource.getRepository(Question),
      dataSource.getRepository(Option),
      dataSource.getRepository(QuizAttempt),
      orgService,
    );

    // Seed isolated test fixture
    const userRepo = dataSource.getRepository(User);
    testUser = await userRepo.save(
      userRepo.create({
        email: `${testId}@example.com`,
        username: testId,
        passwordHash: 'hashed_password_for_integration_testing',
        role: UserRole.CREATOR,
      }),
    );

    const orgRepo = dataSource.getRepository(Organization);
    testOrg = await orgRepo.save(
      orgRepo.create({
        name: `Integ Org ${testId}`,
        slug: `org-${testId}`,
      }),
    );

    const quizRepo = dataSource.getRepository(Quiz);
    testQuiz = await quizRepo.save(
      quizRepo.create({
        title: `Integration Quiz ${testId}`,
        description: 'Quiz created for Phase 6.6 integration tests',
        status: QuizStatus.PUBLISHED,
        creatorId: testUser.id,
        organizationId: testOrg.id,
      }),
    );

    const versionRepo = dataSource.getRepository(QuizVersion);
    version1 = await versionRepo.save(
      versionRepo.create({
        quizId: testQuiz.id,
        version: 1,
        status: QuizVersionStatus.PUBLISHED,
        timeLimitSeconds: 1800,
        publishedAt: new Date(),
      }),
    );

    version2 = await versionRepo.save(
      versionRepo.create({
        quizId: testQuiz.id,
        version: 2,
        status: QuizVersionStatus.PUBLISHED,
        timeLimitSeconds: 3600,
        publishedAt: new Date(),
      }),
    );

    // Questions for Version 1 (2 questions, 5 marks each = 10 marks total)
    const questionRepo = dataSource.getRepository(Question);
    q1 = await questionRepo.save(
      questionRepo.create({
        quizVersionId: version1.id,
        text: 'V1 Q1: Single Choice Question',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 1,
        marks: 5,
      }),
    );

    q2 = await questionRepo.save(
      questionRepo.create({
        quizVersionId: version1.id,
        text: 'V1 Q2: Multiple Choice Question',
        questionType: QuestionType.MULTIPLE_CHOICE,
        order: 2,
        marks: 5,
      }),
    );

    const optionRepo = dataSource.getRepository(Option);
    q1OptA = await optionRepo.save(
      optionRepo.create({ questionId: q1.id, text: 'Correct Option A', order: 1, isCorrect: true }),
    );
    _q1OptB = await optionRepo.save(
      optionRepo.create({ questionId: q1.id, text: 'Wrong Option B', order: 2, isCorrect: false }),
    );

    q2OptA = await optionRepo.save(
      optionRepo.create({ questionId: q2.id, text: 'Correct Option A', order: 1, isCorrect: true }),
    );
    q2OptB = await optionRepo.save(
      optionRepo.create({ questionId: q2.id, text: 'Correct Option B', order: 2, isCorrect: true }),
    );

    // Questions for Version 2 (3 questions, 5 marks each = 15 marks total)
    await questionRepo.save([
      questionRepo.create({
        quizVersionId: version2.id,
        text: 'V2 Q1',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 1,
        marks: 5,
      }),
      questionRepo.create({
        quizVersionId: version2.id,
        text: 'V2 Q2',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 2,
        marks: 5,
      }),
      questionRepo.create({
        quizVersionId: version2.id,
        text: 'V2 Q3',
        questionType: QuestionType.SINGLE_CHOICE,
        order: 3,
        marks: 5,
      }),
    ]);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      // Clean up isolated test data in reverse foreign-key order
      try {
        const qr = dataSource.createQueryRunner();
        await qr.query(`DELETE FROM "answer_options" WHERE "answer_id" IN (SELECT "id" FROM "answers" WHERE "attempt_id" IN (SELECT "id" FROM "quiz_attempts" WHERE "user_id" = $1))`, [testUser.id]);
        await qr.query(`DELETE FROM "answers" WHERE "attempt_id" IN (SELECT "id" FROM "quiz_attempts" WHERE "user_id" = $1)`, [testUser.id]);
        await qr.query(`DELETE FROM "quiz_attempts" WHERE "user_id" = $1`, [testUser.id]);
        await qr.query(`DELETE FROM "options" WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "quiz_version_id" IN (SELECT "id" FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" = $1 OR "id" = $2)))`, [testUser.id, testQuiz.id]);
        await qr.query(`DELETE FROM "questions" WHERE "quiz_version_id" IN (SELECT "id" FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" = $1 OR "id" = $2))`, [testUser.id, testQuiz.id]);
        await qr.query(`DELETE FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" = $1 OR "id" = $2)`, [testUser.id, testQuiz.id]);
        await qr.query(`DELETE FROM "quizzes" WHERE "creator_id" = $1 OR "id" = $2`, [testUser.id, testQuiz.id]);
        await qr.query(`DELETE FROM "organizations" WHERE "id" = $1`, [testOrg.id]);
        await qr.query(`DELETE FROM "users" WHERE "id" = $1`, [testUser.id]);
        await qr.release();
      } catch (err) {
        console.warn('Cleanup warning during integration teardown:', err);
      }
      await dataSource.destroy();
    }
  });

  // 1. Database connection and repository operations
  it('1. Database connection and repository operations', async () => {
    if (!isDbAvailable) return;
    const rawResult = await dataSource.query('SELECT 1 as connected');
    expect(rawResult).toBeDefined();
    expect(Number(rawResult[0].connected)).toBe(1);

    const userInDb = await dataSource.getRepository(User).findOne({ where: { id: testUser.id } });
    expect(userInDb).toBeDefined();
    expect(userInDb?.username).toBe(testId);
  });

  // 2. Attempt creation and answer persistence
  it('2. Attempt creation and answer persistence', async () => {
    if (!isDbAvailable) return;

    const started = await quizService.startAttempt(testQuiz.id, version1.id, {
      userId: testUser.id,
      email: testUser.email,
      role: 'user',
    });
    expect(started.attemptId).toBeDefined();
    expect(started.status).toBe(AttemptStatus.IN_PROGRESS);

    // Save answer to Q1
    const savedQ1 = await quizService.saveAnswer(
      started.attemptId,
      q1.id,
      { optionIds: [q1OptA.id] },
      testUser.id,
    );
    expect(savedQ1.optionIds).toEqual([q1OptA.id]);

    // Save answer to Q2 (multiple-choice)
    const savedQ2 = await quizService.saveAnswer(
      started.attemptId,
      q2.id,
      { optionIds: [q2OptA.id, q2OptB.id] },
      testUser.id,
    );
    expect(savedQ2.optionIds).toEqual(expect.arrayContaining([q2OptA.id, q2OptB.id]));

    // Query Answer and AnswerOption directly from PostgreSQL
    const answerRepo = dataSource.getRepository(Answer);
    const answers = await answerRepo.find({ where: { attemptId: started.attemptId } });
    expect(answers).toHaveLength(2);

    const aoRepo = dataSource.getRepository(AnswerOption);
    const optionsQ2 = await aoRepo.find({ where: { answerId: savedQ2.answerId } });
    expect(optionsQ2).toHaveLength(2);
  });

  // 3. Concurrent submission using pessimistic row locking
  it('3. Concurrent submission using pessimistic row locking', async () => {
    if (!isDbAvailable) return;

    const attempt = await dataSource.getRepository(QuizAttempt).findOne({
      where: { userId: testUser.id, status: AttemptStatus.IN_PROGRESS },
    });
    expect(attempt).toBeDefined();

    // Fire two concurrent submissions on the active attempt
    const [sub1, sub2] = await Promise.all([
      quizService.submitAttempt(attempt!.id, { userId: testUser.id, role: 'user' }),
      quizService.submitAttempt(attempt!.id, { userId: testUser.id, role: 'user' }),
    ]);

    expect(sub1.status).toBe(AttemptStatus.SUBMITTED);
    expect(sub2.status).toBe(AttemptStatus.SUBMITTED);
    expect(sub1.score).toBe(10); // 5 + 5 = 10
    expect(sub2.score).toBe(10);
    expect(sub1.percentage).toBe(100);
  });

  // 4. Idempotent submission
  it('4. Idempotent submission', async () => {
    if (!isDbAvailable) return;

    const attempt = await dataSource.getRepository(QuizAttempt).findOne({
      where: { userId: testUser.id, status: AttemptStatus.SUBMITTED },
    });
    expect(attempt).toBeDefined();

    const reSubmit = await quizService.submitAttempt(attempt!.id, {
      userId: testUser.id,
      role: 'user',
    });

    expect(reSubmit.status).toBe(AttemptStatus.SUBMITTED);
    expect(reSubmit.score).toBe(attempt!.score);
    expect(reSubmit.percentage).toBe(Number(attempt!.percentage));
  });

  // 5. Deadline-based expiration
  it('5. Deadline-based expiration', async () => {
    if (!isDbAvailable) return;

    // Create a new attempt specifically for testing deadline expiration
    const attemptRepo = dataSource.getRepository(QuizAttempt);
    const expiredAttempt = await attemptRepo.save(
      attemptRepo.create({
        quizId: testQuiz.id,
        quizVersionId: version1.id,
        userId: testUser.id,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: new Date(Date.now() - 3600000), // 1 hour ago
        expiresAt: new Date(Date.now() - 10000), // expired 10s ago
      }),
    );

    // Retrieving the attempt should reconcile it to EXPIRED in database
    const retrieved = await quizService.getAttempt(expiredAttempt.id, {
      userId: testUser.id,
      role: 'user',
    });

    expect(retrieved.status).toBe(AttemptStatus.EXPIRED);

    // Verify row in database
    const refreshed = await attemptRepo.findOne({ where: { id: expiredAttempt.id } });
    expect(refreshed?.status).toBe(AttemptStatus.EXPIRED);
  });

  // 6. Result retrieval and attempt-history queries
  it('6. Result retrieval and attempt-history queries', async () => {
    if (!isDbAvailable) return;

    const finalizedAttempt = await dataSource.getRepository(QuizAttempt).findOne({
      where: { userId: testUser.id, status: AttemptStatus.SUBMITTED },
    });
    expect(finalizedAttempt).toBeDefined();

    const result = await quizService.getAttemptResult(finalizedAttempt!.id, {
      userId: testUser.id,
      role: 'user',
    });

    expect(result.attemptId).toBe(finalizedAttempt!.id);
    expect(result.totalMarks).toBe(10);
    expect(result.totalScore).toBe(10);
    expect(result.questions).toHaveLength(2);

    const history = await quizService.getAttemptHistory(testUser.id, { page: 1, limit: 10 });
    expect(history.items.length).toBeGreaterThanOrEqual(1);
    expect(history.items[0].quizTitle).toBe(testQuiz.title);
    expect(history.items[0].totalMarks).toBe(10);
    expect(history.items[0].totalScore).toBe(10);
  });

  // 7. Quiz-version isolation
  it('7. Quiz-version isolation', async () => {
    if (!isDbAvailable) return;

    // Attempt for Version 1
    const v1Attempt = await dataSource.getRepository(QuizAttempt).findOne({
      where: { userId: testUser.id, quizVersionId: version1.id, status: AttemptStatus.SUBMITTED },
    });

    const v1Result = await quizService.getAttemptResult(v1Attempt!.id, {
      userId: testUser.id,
      role: 'user',
    });
    expect(v1Result.totalMarks).toBe(10); // V1 has 2 questions * 5 marks = 10

    // Attempt for Version 2 (untimed, starting fresh)
    const v2Started = await quizService.startAttempt(testQuiz.id, version2.id, {
      userId: testUser.id,
      email: testUser.email,
      role: 'user',
    });
    expect(v2Started.quizVersionId).toBe(version2.id);
    expect(v2Started.totalMarks).toBe(15); // V2 has 3 questions * 5 marks = 15
  });

  // 8. BullMQ integration with Redis
  it('8. BullMQ integration with Redis', async () => {
    if (!isRedisAvailable) {
      console.warn('[Phase 6.6 Integration Test Notice] Redis is offline at localhost:6379. Skipping BullMQ integration test.');
      return;
    }

    // Dynamic import to avoid Redis connection errors when Redis is offline
    const { Queue } = await import('bullmq');
    const queue = new Queue('test-integration-queue', {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
      },
    });

    const job = await queue.add('test-generation-job', {
      generationId: 'test-gen-id',
      prompt: 'Test prompt',
    });

    expect(job.id).toBeDefined();
    const retrieved = await queue.getJob(job.id!);
    expect(retrieved).toBeDefined();
    expect(retrieved?.data.generationId).toBe('test-gen-id');

    await queue.close();
  });

  it('9. Creator dashboard quiz listing, ownership isolation, and version metrics', async () => {
    if (!isDbAvailable) return;

    // 1. Create a second creator user to test cross-creator isolation
    const creator2 = dataSource.getRepository(User).create({
      email: `creator2-${Date.now()}@example.com`,
      username: `creator2_${Date.now()}`,
      passwordHash: 'hash',
      role: UserRole.CREATOR,
      firstName: 'Other',
      lastName: 'Creator',
    });
    await dataSource.getRepository(User).save(creator2);

    // 2. Create Quiz for Creator 2
    const otherQuiz = dataSource.getRepository(Quiz).create({
      title: 'Creator 2 Private Quiz',
      description: 'Private draft',
      status: QuizStatus.DRAFT,
      creatorId: creator2.id,
    });
    await dataSource.getRepository(Quiz).save(otherQuiz);

    // 3. Creator 1 queries creator quizzes
    const creator1User = {
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.CREATOR,
    };

    const creator1Quizzes = await quizService.getCreatorQuizzes(creator1User, {
      page: 1,
      limit: 10,
    });

    // 4. Verify Creator 1 does NOT see Creator 2's quiz (strict ownership enforcement)
    const creator2QuizFound = creator1Quizzes.items.some((q) => q.id === otherQuiz.id);
    expect(creator2QuizFound).toBe(false);

    // 5. Verify Creator 1 sees their own quiz with accurate publishedVersionsCount and version metrics
    const creator1Quiz = creator1Quizzes.items.find((q) => q.id === testQuiz.id);
    expect(creator1Quiz).toBeDefined();
    expect(creator1Quiz?.title).toBe(testQuiz.title);
    expect(creator1Quiz?.publishedVersionsCount).toBeGreaterThanOrEqual(1);

    // 6. Test search filter
    const searchResult = await quizService.getCreatorQuizzes(creator1User, {
      search: 'Integration Quiz',
    });
    expect(searchResult.items.length).toBeGreaterThanOrEqual(1);
    expect(searchResult.items[0].id).toBe(testQuiz.id);

    // 7. Test status filter
    const draftOnlyResult = await quizService.getCreatorQuizzes(creator1User, {
      status: QuizStatus.DRAFT,
    });
    expect(draftOnlyResult.items.every((q) => q.status === QuizStatus.DRAFT)).toBe(true);

    // 8. Test admin can view quizzes across creators
    const adminUser = {
      userId: 'platform-admin',
      email: 'admin@platform.com',
      role: UserRole.ADMIN,
    };
    const adminQuizzes = await quizService.getCreatorQuizzes(adminUser, {
      page: 1,
      limit: 50,
    });
    expect(adminQuizzes.items.some((q) => q.id === otherQuiz.id)).toBe(true);
    expect(adminQuizzes.items.some((q) => q.id === testQuiz.id)).toBe(true);
  });

  it('10. Quiz editing, version immutability, branching, and historical attempt isolation', async () => {
    if (!isDbAvailable) return;

    // 1. Creator creates a new quiz with initial draft v1 (time limit 1200s)
    const creatorUser = {
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.CREATOR,
    };

    const learnerUser = {
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.TAKER,
    };

    const createdQuiz = await quizService.createQuiz(
      'Phase 7.2 Integration Quiz ' + Date.now(),
      'Testing safe quiz editing and version integrity',
      1200,
      creatorUser.userId,
    );
    expect(createdQuiz.quizId).toBeDefined();
    expect(createdQuiz.version).toBe(1);
    expect(createdQuiz.status).toBe(QuizVersionStatus.DRAFT);
    expect(createdQuiz.timeLimitSeconds).toBe(1200);

    const v1Id = createdQuiz.quizVersionId;

    // 2. Creator updates draft v1 settings (time limit to 1800s)
    const updatedV1 = await quizService.updateQuizVersion(
      createdQuiz.quizId,
      v1Id,
      creatorUser,
      { timeLimitSeconds: 1800 },
    );
    expect(updatedV1.timeLimitSeconds).toBe(1800);

    // 3. Creator saves Q1 to draft v1
    await quizService.saveQuestionsBulk(
      createdQuiz.quizId,
      v1Id,
      {
        questions: [
          {
            text: 'What does ACID stand for?',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 2,
            options: [
              { text: 'Atomicity, Consistency, Isolation, Durability', isCorrect: true },
              { text: 'Asynchronous, Concurrent, Isolated, Distributed', isCorrect: false },
            ],
          },
        ],
      },
      creatorUser,
    );

    // 4. Creator publishes v1
    const pubV1 = await quizService.publishVersion(createdQuiz.quizId, v1Id, creatorUser);
    expect(pubV1.status).toBe(QuizVersionStatus.PUBLISHED);

    // 5. Immutability checks on published v1
    await expect(
      quizService.saveQuestionsBulk(
        createdQuiz.quizId,
        v1Id,
        {
          questions: [
            {
              text: 'Mutated Question?',
              questionType: QuestionType.SINGLE_CHOICE,
              marks: 5,
              options: [
                { text: 'Yes', isCorrect: true },
                { text: 'No', isCorrect: false },
              ],
            },
          ],
        },
        creatorUser,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      quizService.updateQuizVersion(
        createdQuiz.quizId,
        v1Id,
        creatorUser,
        { timeLimitSeconds: 600 },
      ),
    ).rejects.toThrow(BadRequestException);

    // 6. Learner starts attempt on v1, answers Q1 correctly, and submits
    const v1Attempt = await quizService.startAttempt(createdQuiz.quizId, v1Id, learnerUser);
    const v1Details = await quizService.getAttempt(v1Attempt.attemptId, learnerUser);
    expect(v1Details.questions).toHaveLength(1);
    const q1Id = v1Details.questions[0].id;
    const optAId = v1Details.questions[0].options[0].id;

    await quizService.saveAnswer(
      v1Attempt.attemptId,
      q1Id,
      { optionIds: [optAId] },
      learnerUser,
    );

    const v1Submit = await quizService.submitAttempt(v1Attempt.attemptId, learnerUser);
    expect(v1Submit.status).toBe(AttemptStatus.SUBMITTED);
    expect(v1Submit.score).toBe(2);
    expect(v1Submit.percentage).toBe(100);

    // 7. Creator branches new version v2 from published v1
    const v2Draft = await quizService.createNewVersion(createdQuiz.quizId, creatorUser);
    expect(v2Draft.version).toBe(2);
    expect(v2Draft.status).toBe(QuizVersionStatus.DRAFT);
    expect(v2Draft.timeLimitSeconds).toBe(1800);

    const v2Id = v2Draft.id || v2Draft.quizVersionId;

    // 8. Single-draft rule: attempting to create another version while v2 draft exists is rejected
    await expect(
      quizService.createNewVersion(createdQuiz.quizId, creatorUser),
    ).rejects.toThrow(BadRequestException);

    // 9. Creator updates v2 settings (changes time limit to 2400s)
    const updatedV2 = await quizService.updateQuizVersion(
      createdQuiz.quizId,
      v2Id,
      creatorUser,
      { timeLimitSeconds: 2400 },
    );
    expect(updatedV2.timeLimitSeconds).toBe(2400);

    // 10. Creator modifies questions on v2 (keeps Q1, adds Q2)
    const v2Questions = await dataSource.getRepository(Question).find({
      where: { quizVersionId: v2Id },
      relations: { options: true },
      order: { order: 'ASC' },
    });
    expect(v2Questions).toHaveLength(1);

    await quizService.saveQuestionsBulk(
      createdQuiz.quizId,
      v2Id,
      {
        questions: [
          {
            id: v2Questions[0].id,
            text: v2Questions[0].text,
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 2,
            options: v2Questions[0].options.map((opt) => ({
              id: opt.id,
              text: opt.text,
              isCorrect: opt.isCorrect,
            })),
          },
          {
            text: 'Which patterns are architectural patterns?',
            questionType: QuestionType.MULTIPLE_CHOICE,
            marks: 3,
            options: [
              { text: 'Event-driven Architecture', isCorrect: true },
              { text: 'CQRS', isCorrect: true },
              { text: 'Bubble Sort', isCorrect: false },
            ],
          },
        ],
      },
      creatorUser,
    );

    // 11. Publish v2
    const pubV2 = await quizService.publishVersion(createdQuiz.quizId, v2Id, creatorUser);
    expect(pubV2.status).toBe(QuizVersionStatus.PUBLISHED);

    // 12. Version Isolation verification: historical v1 attempt remains completely unaffected
    const historicalResult = await quizService.getAttemptResult(v1Attempt.attemptId, learnerUser);
    expect(historicalResult.totalMarks).toBe(2);
    expect(historicalResult.score).toBe(2);
    expect(historicalResult.percentage).toBe(100);
    expect(historicalResult.questions).toHaveLength(1);
    expect(historicalResult.questions[0].text).toBe('What does ACID stand for?');

    // 13. New attempt on v2 gets both questions and 5 total marks
    const v2Attempt = await quizService.startAttempt(createdQuiz.quizId, v2Id, learnerUser);
    const v2Details = await quizService.getAttempt(v2Attempt.attemptId, learnerUser);
    expect(v2Details.questions).toHaveLength(2);
    expect(v2Details.questions.reduce((sum, q) => sum + q.marks, 0)).toBe(5);
  });

  // 11. Phase 7.3 Publishing Workflow Hardening: Concurrency, Atomic Rollback & Learner Access
  it('11. Publishing Workflow Hardening: Concurrency, Atomic Rollback & Learner Access', async () => {
    if (!isDbAvailable) return;

    const quizRepo = dataSource.getRepository(Quiz);
    const quizVersionRepo = dataSource.getRepository(QuizVersion);
    const questionRepo = dataSource.getRepository(Question);
    const optionRepo = dataSource.getRepository(Option);

    const creatorUser = {
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.CREATOR,
    };
    const learnerUser = {
      userId: testUser.id,
      email: testUser.email,
      role: UserRole.TAKER,
    };

    // 1. Create a quiz for concurrent publishing verification
    const quiz1 = await quizService.createQuiz(
      'Concurrent Hardening Quiz ' + testId,
      'Integration test for Phase 7.3 publishing safety',
      600,
      testUser.id,
    );
    const v1Id = quiz1.quizVersionId;

    // 2. Populate v1 with valid questions
    await quizService.saveQuestionsBulk(
      quiz1.quizId,
      v1Id,
      {
        questions: [
          {
            text: 'What is idempotency in distributed systems?',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 3,
            options: [
              { text: 'An operation that produces the same result when executed multiple times', isCorrect: true },
              { text: 'An operation that always executes randomly', isCorrect: false },
            ],
          },
        ],
      },
      creatorUser,
    );

    // 3. Concurrent publication requests: simulate two simultaneous publishVersion requests
    const [publishResA, publishResB] = await Promise.all([
      quizService.publishVersion(quiz1.quizId, v1Id, creatorUser),
      quizService.publishVersion(quiz1.quizId, v1Id, creatorUser),
    ]);

    expect(publishResA.status).toBe(QuizVersionStatus.PUBLISHED);
    expect(publishResB.status).toBe(QuizVersionStatus.PUBLISHED);
    expect(publishResA.quizVersionId).toBe(v1Id);
    expect(publishResB.quizVersionId).toBe(v1Id);

    // Verify DB state in PostgreSQL: exactly 1 version with status published
    const v1InDb = await quizVersionRepo.findOne({ where: { id: v1Id } });
    expect(v1InDb?.status).toBe(QuizVersionStatus.PUBLISHED);
    expect(v1InDb?.publishedAt).toBeInstanceOf(Date);

    const quizInDb = await quizRepo.findOne({ where: { id: quiz1.quizId } });
    expect(quizInDb?.status).toBe(QuizStatus.PUBLISHED);

    // 4. Atomic Rollback Verification: Create another quiz and attempt publishing with invalid question data
    const quiz2 = await quizService.createQuiz(
      'Invalid Question Quiz ' + testId,
      'Tests transaction rollback on publishing failure',
      300,
      testUser.id,
    );
    const quiz2V1Id = quiz2.quizVersionId;

    // Save questions
    await quizService.saveQuestionsBulk(
      quiz2.quizId,
      quiz2V1Id,
      {
        questions: [
          {
            text: 'Valid Question Text',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 2,
            options: [
              { text: 'Duplicate Option', isCorrect: true },
              { text: 'Different Option', isCorrect: false },
            ],
          },
        ],
      },
      creatorUser,
    );

    // Directly corrupt one option in DB to test publishing validation catch & rollback
    const savedQuestions = await questionRepo.find({ where: { quizVersionId: quiz2V1Id } });
    const savedOpts = await optionRepo.find({ where: { questionId: savedQuestions[0].id } });
    savedOpts[1].text = 'Duplicate Option'; // Force duplicate text
    await optionRepo.save(savedOpts[1]);

    // Attempt publish: must reject with BadRequestException
    await expect(
      quizService.publishVersion(quiz2.quizId, quiz2V1Id, creatorUser),
    ).rejects.toThrow(BadRequestException);

    // Verify rollback: quiz2 and quiz2V1 remain in DRAFT status
    const quiz2Db = await quizRepo.findOne({ where: { id: quiz2.quizId } });
    const quiz2V1Db = await quizVersionRepo.findOne({ where: { id: quiz2V1Id } });
    expect(quiz2Db?.status).toBe(QuizStatus.DRAFT);
    expect(quiz2V1Db?.status).toBe(QuizVersionStatus.DRAFT);
    expect(quiz2V1Db?.publishedAt).toBeNull();

    // 5. Learner Discovery: Learner searches for published quizzes
    const catalog = await quizService.getPublishedQuizzes({ search: 'Concurrent Hardening' });
    expect(catalog.items.length).toBeGreaterThanOrEqual(1);
    const foundQuiz = catalog.items.find((item) => item.id === quiz1.quizId);
    expect(foundQuiz).toBeDefined();
    expect(foundQuiz?.latestPublishedVersionNumber).toBe(1);
    expect(foundQuiz?.totalQuestions).toBe(1);
    expect(foundQuiz?.totalMarks).toBe(3);

    // Draft quiz2 must NOT appear in published catalog
    const draftInCatalog = catalog.items.find((item) => item.id === quiz2.quizId);
    expect(draftInCatalog).toBeUndefined();

    // 6. Learner Details: getLatestPublishedQuizVersion
    const takerVersion = await quizService.getLatestPublishedQuizVersion(quiz1.quizId);
    expect(takerVersion.quizVersionId).toBe(v1Id);
    expect(takerVersion.questions[0].options[0]).not.toHaveProperty('isCorrect');

    // 7. Learner Access Denied to Draft Versions
    await expect(
      quizService.getPublishedQuizVersion(quiz2.quizId, quiz2V1Id),
    ).rejects.toThrow(NotFoundException);

    await expect(
      quizService.startAttempt(quiz2.quizId, quiz2V1Id, learnerUser),
    ).rejects.toThrow(BadRequestException);

    // 8. Learner Starts Attempt with ONLY quizId (resolves latest published version)
    const directAttempt = await quizService.startAttempt(quiz1.quizId, learnerUser);
    expect(directAttempt.quizVersionId).toBe(v1Id);
    expect(directAttempt.totalQuestions).toBe(1);
    expect(directAttempt.totalMarks).toBe(3);

    // 9. Version Branching & Historical Attempt Isolation
    // Learner answers and submits v1 attempt
    const attemptDetails = await quizService.getAttempt(directAttempt.attemptId, learnerUser);
    const optToSelect = attemptDetails.questions[0].options[0];
    await quizService.saveAnswer(
      directAttempt.attemptId,
      attemptDetails.questions[0].id,
      { optionIds: [optToSelect.id] },
      learnerUser,
    );
    const submissionResult = await quizService.submitAttempt(directAttempt.attemptId, learnerUser);
    expect(submissionResult.score).toBe(3);
    expect(submissionResult.status).toBe(AttemptStatus.SUBMITTED);

    // Creator branches into v2
    const v2 = await quizService.createNewVersion(quiz1.quizId, creatorUser);
    expect(v2.version).toBe(2);

    // Add extra question to v2 (marks = 5)
    await quizService.saveQuestionsBulk(
      quiz1.quizId,
      v2.quizVersionId,
      {
        questions: [
          {
            text: 'Question 1',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 3,
            options: [
              { text: 'A', isCorrect: true },
              { text: 'B', isCorrect: false },
            ],
          },
          {
            text: 'Question 2',
            questionType: QuestionType.SINGLE_CHOICE,
            marks: 5,
            options: [
              { text: 'C', isCorrect: true },
              { text: 'D', isCorrect: false },
            ],
          },
        ],
      },
      creatorUser,
    );

    // Publish v2
    await quizService.publishVersion(quiz1.quizId, v2.quizVersionId, creatorUser);

    // Re-verify historical attempt: remains strictly bound to v1 (1 question, 3 marks)
    const recheckedV1 = await quizService.getAttemptResult(directAttempt.attemptId, learnerUser);
    expect(recheckedV1.quizVersionId).toBe(v1Id);
    expect(recheckedV1.totalMarks).toBe(3);
    expect(recheckedV1.score).toBe(3);
    expect(recheckedV1.questions).toHaveLength(1);

    // New attempt with only quizId now automatically binds to v2 (2 questions, 8 marks)
    const newAttemptOnV2 = await quizService.startAttempt(quiz1.quizId, learnerUser);
    expect(newAttemptOnV2.quizVersionId).toBe(v2.quizVersionId);
    expect(newAttemptOnV2.totalQuestions).toBe(2);
    expect(newAttemptOnV2.totalMarks).toBe(8);
  });

  it('12. Learner Discovery, Tenant Isolation, Organization Access & Idempotent Resume', async () => {
    if (!isDbAvailable) return;

    const userRepo = dataSource.getRepository(User);
    const orgRepo = dataSource.getRepository(Organization);
    const quizRepo = dataSource.getRepository(Quiz);
    const versionRepo = dataSource.getRepository(QuizVersion);
    const questionRepo = dataSource.getRepository(Question);
    const optionRepo = dataSource.getRepository(Option);
    const assignmentRepo = dataSource.getRepository(QuizAssignment);
    const recipientRepo = dataSource.getRepository(QuizAssignmentRecipient);

    const testRunId = Date.now().toString();

    // 1. Fixtures: Org, Creator, Assigned Learner, Unassigned Learner
    const testOrg12 = await orgRepo.save(
      orgRepo.create({
        name: `Org 12 ${testRunId}`,
        slug: `org-12-${testRunId}`,
      }),
    );

    const creator12 = await userRepo.save(
      userRepo.create({
        username: `creator12_${testRunId}`,
        email: `creator-12-${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.CREATOR,
      }),
    );
    const _creator12User = { userId: creator12.id, role: UserRole.CREATOR, email: creator12.email };

    const assignedLearner12 = await userRepo.save(
      userRepo.create({
        username: `assigned12_${testRunId}`,
        email: `assigned-12-${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.LEARNER,
      }),
    );
    const assignedUser12 = { userId: assignedLearner12.id, role: UserRole.LEARNER, email: assignedLearner12.email };

    const unassignedLearner12 = await userRepo.save(
      userRepo.create({
        username: `unassigned12_${testRunId}`,
        email: `unassigned-12-${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.LEARNER,
      }),
    );
    const unassignedUser12 = { userId: unassignedLearner12.id, role: UserRole.LEARNER, email: unassignedLearner12.email };

    try {
      // 2. Create Public Quiz (untimed)
      const publicQuiz = await quizRepo.save(
        quizRepo.create({
          title: `Public Discovery Quiz ${testRunId}`,
          description: 'Open to all authenticated learners',
          status: QuizStatus.PUBLISHED,
          creatorId: creator12.id,
          organizationId: null,
        }),
      );
      const publicV1 = await versionRepo.save(
        versionRepo.create({
          quizId: publicQuiz.id,
          version: 1,
          status: QuizVersionStatus.PUBLISHED,
          timeLimitSeconds: null,
          publishedAt: new Date(),
        }),
      );
      const publicQ1 = await questionRepo.save(
        questionRepo.create({
          quizVersionId: publicV1.id,
          text: 'Public Q1',
          questionType: QuestionType.SINGLE_CHOICE,
          order: 1,
          marks: 5,
        }),
      );
      await optionRepo.save([
        optionRepo.create({ questionId: publicQ1.id, text: 'Opt 1', isCorrect: true, order: 1 }),
        optionRepo.create({ questionId: publicQ1.id, text: 'Opt 2', isCorrect: false, order: 2 }),
      ]);

      // 3. Create Org Quiz (timed: 900s = 15m)
      const orgQuiz = await quizRepo.save(
        quizRepo.create({
          title: `Org Restricted Quiz ${testRunId}`,
          description: 'Restricted to assigned recipients only',
          status: QuizStatus.PUBLISHED,
          creatorId: creator12.id,
          organizationId: testOrg12.id,
        }),
      );
      const orgV1 = await versionRepo.save(
        versionRepo.create({
          quizId: orgQuiz.id,
          version: 1,
          status: QuizVersionStatus.PUBLISHED,
          timeLimitSeconds: 900,
          publishedAt: new Date(),
        }),
      );
      const orgQ1 = await questionRepo.save(
        questionRepo.create({
          quizVersionId: orgV1.id,
          text: 'Org Q1',
          questionType: QuestionType.SINGLE_CHOICE,
          order: 1,
          marks: 10,
        }),
      );
      await optionRepo.save([
        optionRepo.create({ questionId: orgQ1.id, text: 'Secret A', isCorrect: true, order: 1 }),
        optionRepo.create({ questionId: orgQ1.id, text: 'Secret B', isCorrect: false, order: 2 }),
      ]);

      // 4. Create active assignment for org quiz and assign ONLY assignedLearner12
      const assignment = await assignmentRepo.save(
        assignmentRepo.create({
          quizId: orgQuiz.id,
          quizVersionId: orgV1.id,
          organizationId: testOrg12.id,
          assignedBy: creator12.id,
          isActive: true,
          startsAt: null,
          dueAt: null,
        }),
      );
      await recipientRepo.save(
        recipientRepo.create({
          assignmentId: assignment.id,
          studentId: assignedLearner12.id,
        }),
      );

      // 5. Verification: Catalog discovery
      // - Assigned learner sees BOTH public and assigned org quiz
      const assignedCatalog = await quizService.getPublishedQuizzes(
        { search: testRunId },
        assignedUser12,
      );
      const assignedIds = assignedCatalog.items.map((q) => q.id);
      expect(assignedIds).toContain(publicQuiz.id);
      expect(assignedIds).toContain(orgQuiz.id);

      // - Unassigned learner sees ONLY the public quiz; org quiz is filtered out
      const unassignedCatalog = await quizService.getPublishedQuizzes(
        { search: testRunId },
        unassignedUser12,
      );
      const unassignedIds = unassignedCatalog.items.map((q) => q.id);
      expect(unassignedIds).toContain(publicQuiz.id);
      expect(unassignedIds).not.toContain(orgQuiz.id);

      // - Timing filters
      const timedCatalog = await quizService.getPublishedQuizzes(
        { search: testRunId, timing: 'timed' },
        assignedUser12,
      );
      expect(timedCatalog.items.map((q) => q.id)).toContain(orgQuiz.id);
      expect(timedCatalog.items.map((q) => q.id)).not.toContain(publicQuiz.id);

      const untimedCatalog = await quizService.getPublishedQuizzes(
        { search: testRunId, timing: 'untimed' },
        assignedUser12,
      );
      expect(untimedCatalog.items.map((q) => q.id)).toContain(publicQuiz.id);
      expect(untimedCatalog.items.map((q) => q.id)).not.toContain(orgQuiz.id);

      // 6. Access Control: Knowing quizId or versionId cannot bypass isolation
      // - Unassigned learner must receive ForbiddenException on getPublishedQuizVersion
      await expect(
        quizService.getPublishedQuizVersion(orgQuiz.id, orgV1.id, unassignedUser12),
      ).rejects.toThrow(ForbiddenException);

      // - Unassigned learner must receive ForbiddenException on getLatestPublishedQuizVersion
      await expect(
        quizService.getLatestPublishedQuizVersion(orgQuiz.id, unassignedUser12),
      ).rejects.toThrow(ForbiddenException);

      // - Unassigned learner must receive ForbiddenException on startAttempt
      await expect(
        quizService.startAttempt(orgQuiz.id, orgV1.id, unassignedUser12),
      ).rejects.toThrow(ForbiddenException);

      // 7. Assigned Learner Access: can preview and taker answers are strictly omitted
      const preview = await quizService.getPublishedQuizVersion(orgQuiz.id, orgV1.id, assignedUser12);
      expect(preview.quizId).toBe(orgQuiz.id);
      expect(preview.timeLimitSeconds).toBe(900);
      expect(preview.questions).toHaveLength(1);
      expect((preview.questions[0].options[0] as any).isCorrect).toBeUndefined();

      // 8. Start & Resume Lifecycle for Assigned Learner
      const freshAttempt = await quizService.startAttempt(orgQuiz.id, assignedUser12);
      expect(freshAttempt.status).toBe(AttemptStatus.IN_PROGRESS);
      expect(freshAttempt.resumed).toBe(false);
      expect(freshAttempt.remainingTimeSeconds).toBeGreaterThan(0);
      expect(freshAttempt.quizVersionId).toBe(orgV1.id);

      // Idempotent resume: subsequent startAttempt returns same attempt session
      const resumedAttempt = await quizService.startAttempt(orgQuiz.id, assignedUser12);
      expect(resumedAttempt.attemptId).toBe(freshAttempt.attemptId);
      expect(resumedAttempt.resumed).toBe(true);

      // History query shows in-progress attempt with valid deadline
      const history = await quizService.getAttemptHistory(assignedUser12.userId, { quizId: orgQuiz.id });
      expect(history.items).toHaveLength(1);
      expect(history.items[0].attemptId).toBe(freshAttempt.attemptId);
      expect(history.items[0].status).toBe(AttemptStatus.IN_PROGRESS);
      expect(history.items[0].expiresAt).toBeDefined();
    } finally {
      // Clean up isolated test data
      const qr = dataSource.createQueryRunner();
      try {
        await qr.query(`DELETE FROM "quiz_assignment_recipients" WHERE "student_id" IN ($1, $2)`, [assignedLearner12.id, unassignedLearner12.id]);
        await qr.query(`DELETE FROM "quiz_assignments" WHERE "assigned_by" = $1`, [creator12.id]);
        await qr.query(`DELETE FROM "quiz_attempts" WHERE "user_id" IN ($1, $2)`, [assignedLearner12.id, unassignedLearner12.id]);
        await qr.query(`DELETE FROM "options" WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "quiz_version_id" IN (SELECT "id" FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" = $1)))`, [creator12.id]);
        await qr.query(`DELETE FROM "questions" WHERE "quiz_version_id" IN (SELECT "id" FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" = $1))`, [creator12.id]);
        await qr.query(`DELETE FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" = $1)`, [creator12.id]);
        await qr.query(`DELETE FROM "quizzes" WHERE "creator_id" = $1`, [creator12.id]);
        await qr.query(`DELETE FROM "organizations" WHERE "id" = $1`, [testOrg12.id]);
        await qr.query(`DELETE FROM "users" WHERE "id" IN ($1, $2, $3)`, [creator12.id, assignedLearner12.id, unassignedLearner12.id]);
      } catch (cleanupErr) {
        console.warn('Scenario 12 cleanup warning:', cleanupErr);
      } finally {
        await qr.release();
      }
    }
  });

  it('13. Creator Analytics & Performance Insights: Aggregations, Isolation, Difficulty & Top Scorers', async () => {
    if (!isDbAvailable) return;

    const testRunId = `p75_${Date.now()}`;
    const userRepo = dataSource.getRepository(User);
    const quizRepo = dataSource.getRepository(Quiz);
    const versionRepo = dataSource.getRepository(QuizVersion);
    const questionRepo = dataSource.getRepository(Question);
    const optionRepo = dataSource.getRepository(Option);

    // 1. Create two creators: creatorA (owner) and creatorB (stranger), plus two learners
    const creatorA = await userRepo.save(
      userRepo.create({
        username: `creatorA_${testRunId}`,
        email: `creator-a-${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.CREATOR,
      }),
    );
    const creatorAUser = { userId: creatorA.id, role: UserRole.CREATOR, email: creatorA.email };

    const creatorB = await userRepo.save(
      userRepo.create({
        username: `creatorB_${testRunId}`,
        email: `creator-b-${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.CREATOR,
      }),
    );
    const creatorBUser = { userId: creatorB.id, role: UserRole.CREATOR, email: creatorB.email };

    const learner1 = await userRepo.save(
      userRepo.create({
        username: `alice_${testRunId}`,
        email: `alice.${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.LEARNER,
      }),
    );
    const learner1User = { userId: learner1.id, role: UserRole.LEARNER, email: learner1.email };

    const learner2 = await userRepo.save(
      userRepo.create({
        username: `bob_${testRunId}`,
        email: `bob.${testRunId}@test.com`,
        passwordHash: 'hashed',
        role: UserRole.LEARNER,
      }),
    );
    const learner2User = { userId: learner2.id, role: UserRole.LEARNER, email: learner2.email };

    try {
      // 2. Create Quiz with Version 1 and Version 2
      const quizA = await quizRepo.save(
        quizRepo.create({
          title: `Analytics Test Quiz ${testRunId}`,
          description: 'Quiz for analytics verification',
          status: QuizStatus.PUBLISHED,
          creatorId: creatorA.id,
          organizationId: null,
        }),
      );

      // Version 1 (Published, 600s time limit)
      const v1 = await versionRepo.save(
        versionRepo.create({
          quizId: quizA.id,
          version: 1,
          status: QuizVersionStatus.PUBLISHED,
          timeLimitSeconds: 600,
          publishedAt: new Date(),
        }),
      );

      // Questions for Version 1:
      // Q1: Multiple choice (3 marks) - Primary colors: Red, Blue, Yellow (correct), Green (wrong)
      const q1Mcq = await questionRepo.save(
        questionRepo.create({
          quizVersionId: v1.id,
          text: 'Select primary colors',
          questionType: QuestionType.MULTIPLE_CHOICE,
          order: 1,
          marks: 3,
        }),
      );
      const [optRed, optBlue, optYellow] = await optionRepo.save([
        optionRepo.create({ questionId: q1Mcq.id, text: 'Red', isCorrect: true, order: 1 }),
        optionRepo.create({ questionId: q1Mcq.id, text: 'Blue', isCorrect: true, order: 2 }),
        optionRepo.create({ questionId: q1Mcq.id, text: 'Yellow', isCorrect: true, order: 3 }),
        optionRepo.create({ questionId: q1Mcq.id, text: 'Green', isCorrect: false, order: 4 }),
      ]);

      // Q2: Single choice (2 marks) - What is 2 + 2? 4 (correct), 5 (wrong)
      const q2Sc = await questionRepo.save(
        questionRepo.create({
          quizVersionId: v1.id,
          text: 'What is 2 + 2?',
          questionType: QuestionType.SINGLE_CHOICE,
          order: 2,
          marks: 2,
        }),
      );
      const [opt4] = await optionRepo.save([
        optionRepo.create({ questionId: q2Sc.id, text: '4', isCorrect: true, order: 1 }),
        optionRepo.create({ questionId: q2Sc.id, text: '5', isCorrect: false, order: 2 }),
      ]);

      // Version 2 (Published, 300s time limit)
      const v2 = await versionRepo.save(
        versionRepo.create({
          quizId: quizA.id,
          version: 2,
          status: QuizVersionStatus.PUBLISHED,
          timeLimitSeconds: 300,
          publishedAt: new Date(),
        }),
      );
      const q3Tf = await questionRepo.save(
        questionRepo.create({
          quizVersionId: v2.id,
          text: 'TypeScript is compiled',
          questionType: QuestionType.TRUE_FALSE,
          order: 1,
          marks: 1,
        }),
      );
      await optionRepo.save([
        optionRepo.create({ questionId: q3Tf.id, text: 'True', isCorrect: true, order: 1 }),
        optionRepo.create({ questionId: q3Tf.id, text: 'False', isCorrect: false, order: 2 }),
      ]);

      // 3. Learner 1 takes Version 1: answers all questions correctly and submits
      const att1 = await quizService.startAttempt(quizA.id, v1.id, learner1User);
      // Answer Q1: all 3 correct options
      await quizService.saveAnswer(
        att1.attemptId,
        q1Mcq.id,
        { optionIds: [optRed.id, optBlue.id, optYellow.id] },
        learner1User,
      );
      // Answer Q2: opt4
      await quizService.saveAnswer(
        att1.attemptId,
        q2Sc.id,
        { optionIds: [opt4.id] },
        learner1User,
      );
      const sub1 = await quizService.submitAttempt(att1.attemptId, learner1User);
      expect(sub1.status).toBe(AttemptStatus.SUBMITTED);
      expect(sub1.score).toBe(5);
      expect(sub1.percentage).toBe(100);

      // 4. Learner 2 takes Version 1: answers Q1 partially (only Red and Blue), leaves Q2 unanswered, and submits
      const att2 = await quizService.startAttempt(quizA.id, v1.id, learner2User);
      await quizService.saveAnswer(
        att2.attemptId,
        q1Mcq.id,
        { optionIds: [optRed.id, optBlue.id] },
        learner2User,
      );
      const sub2 = await quizService.submitAttempt(att2.attemptId, learner2User);
      expect(sub2.status).toBe(AttemptStatus.SUBMITTED);
      expect(sub2.score).toBe(0); // All-or-nothing: 0 on partial Q1, 0 on unanswered Q2
      expect(sub2.percentage).toBe(0);

      // 5. Learner 1 starts Version 2 but leaves it IN_PROGRESS
      const att3 = await quizService.startAttempt(quizA.id, v2.id, learner1User);
      expect(att3.status).toBe(AttemptStatus.IN_PROGRESS);

      // 6. Creator A inspects analytics for Version 1
      const analyticsV1 = await quizService.getQuizAnalytics(quizA.id, v1.id, creatorAUser);
      expect(analyticsV1.quizId).toBe(quizA.id);
      expect(analyticsV1.versionId).toBe(v1.id);
      expect(analyticsV1.publishedVersionsCount).toBe(2);

      // Summary KPIs on V1: strictly excludes in-progress V2 attempts
      expect(analyticsV1.summary.totalAttempts).toBe(2);
      expect(analyticsV1.summary.submittedAttempts).toBe(2);
      expect(analyticsV1.summary.expiredAttempts).toBe(0);
      expect(analyticsV1.summary.inProgressAttempts).toBe(0);
      expect(analyticsV1.summary.completedAttempts).toBe(2);
      expect(analyticsV1.summary.completionRate).toBe(100);
      expect(analyticsV1.summary.finalizedRate).toBe(100);
      expect(analyticsV1.summary.avgScore).toBe(2.5); // (5 + 0) / 2
      expect(analyticsV1.summary.avgPercentage).toBe(50); // (100 + 0) / 2
      expect(analyticsV1.summary.highestScore).toBe(5);
      expect(analyticsV1.summary.lowestScore).toBe(0);
      expect(analyticsV1.summary.highestPercentage).toBe(100);
      expect(analyticsV1.summary.lowestPercentage).toBe(0);

      // Version Summaries: breaks down both V1 and V2 separately
      expect(analyticsV1.versionSummaries).toHaveLength(2);
      const v1Summary = analyticsV1.versionSummaries.find((v) => v.versionId === v1.id);
      expect(v1Summary?.totalAttempts).toBe(2);
      expect(v1Summary?.submittedAttempts).toBe(2);
      expect(v1Summary?.avgScore).toBe(2.5);
      expect(v1Summary?.avgPercentage).toBe(50);

      const v2Summary = analyticsV1.versionSummaries.find((v) => v.versionId === v2.id);
      expect(v2Summary?.totalAttempts).toBe(1);
      expect(v2Summary?.inProgressAttempts).toBe(1);
      expect(v2Summary?.submittedAttempts).toBe(0);
      expect(v2Summary?.avgScore).toBe(0); // in-progress excluded from averages

      // Top Scorers: masked emails for learner privacy
      expect(analyticsV1.topScorers).toHaveLength(2);
      expect(analyticsV1.topScorers[0].score).toBe(5);
      expect(analyticsV1.topScorers[0].percentage).toBe(100);
      expect(analyticsV1.topScorers[0].email).toMatch(/^al\*\*\*@/);
      expect(analyticsV1.topScorers[1].score).toBe(0);
      expect(analyticsV1.topScorers[1].percentage).toBe(0);
      expect(analyticsV1.topScorers[1].email).toMatch(/^bo\*\*\*@/);

      // Question Analytics: all-or-nothing accuracy & difficulty estimate
      const q1Analytics = analyticsV1.questionAnalytics.find((q) => q.questionId === q1Mcq.id);
      expect(q1Analytics?.attemptCount).toBe(2);
      expect(q1Analytics?.correctCount).toBe(1); // Only learner 1 got all 3
      expect(q1Analytics?.wrongCount).toBe(1); // Learner 2's partial selection is wrong
      expect(q1Analytics?.correctPercentage).toBe(50);
      expect(q1Analytics?.difficultyEstimate).toBe('MEDIUM');

      const q2Analytics = analyticsV1.questionAnalytics.find((q) => q.questionId === q2Sc.id);
      expect(q2Analytics?.attemptCount).toBe(2);
      expect(q2Analytics?.correctCount).toBe(1); // Learner 1 answered correctly
      expect(q2Analytics?.unansweredCount).toBe(1); // Learner 2 left it unanswered
      expect(q2Analytics?.correctPercentage).toBe(50);
      expect(q2Analytics?.difficultyEstimate).toBe('MEDIUM');

      // Question Type Breakdown
      expect(analyticsV1.questionTypeBreakdown[QuestionType.MULTIPLE_CHOICE].questionCount).toBe(1);
      expect(analyticsV1.questionTypeBreakdown[QuestionType.SINGLE_CHOICE].questionCount).toBe(1);

      // 7. Cross-Creator Authorization: Creator B is blocked from inspecting Creator A's quiz
      await expect(
        quizService.getQuizAnalytics(quizA.id, v1.id, creatorBUser),
      ).rejects.toThrow(ForbiddenException);

      // 8. Learner Authorization: Learner is blocked from inspecting quiz analytics
      await expect(
        quizService.getQuizAnalytics(quizA.id, v1.id, learner1User),
      ).rejects.toThrow(ForbiddenException);
    } finally {
      // Clean up isolated test data
      const qr = dataSource.createQueryRunner();
      try {
        await qr.query(`DELETE FROM "answer_options" WHERE "answer_id" IN (SELECT "id" FROM "answers" WHERE "attempt_id" IN (SELECT "id" FROM "quiz_attempts" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" IN ($1, $2))))`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "answers" WHERE "attempt_id" IN (SELECT "id" FROM "quiz_attempts" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" IN ($1, $2)))`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "quiz_attempts" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" IN ($1, $2))`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "options" WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "quiz_version_id" IN (SELECT "id" FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" IN ($1, $2))))`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "questions" WHERE "quiz_version_id" IN (SELECT "id" FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" IN ($1, $2)))`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "quiz_versions" WHERE "quiz_id" IN (SELECT "id" FROM "quizzes" WHERE "creator_id" IN ($1, $2))`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "quizzes" WHERE "creator_id" IN ($1, $2)`, [creatorA.id, creatorB.id]);
        await qr.query(`DELETE FROM "users" WHERE "id" IN ($1, $2, $3, $4)`, [creatorA.id, creatorB.id, learner1.id, learner2.id]);
      } catch (cleanupErr) {
        console.warn('Scenario 13 cleanup warning:', cleanupErr);
      } finally {
        await qr.release();
      }
    }
  });
});
