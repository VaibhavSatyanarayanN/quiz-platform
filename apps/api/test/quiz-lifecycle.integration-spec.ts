import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
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
        await qr.query(`DELETE FROM "options" WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "quiz_version_id" IN ($1, $2))`, [version1.id, version2.id]);
        await qr.query(`DELETE FROM "questions" WHERE "quiz_version_id" IN ($1, $2)`, [version1.id, version2.id]);
        await qr.query(`DELETE FROM "quiz_versions" WHERE "quiz_id" = $1`, [testQuiz.id]);
        await qr.query(`DELETE FROM "quizzes" WHERE "id" = $1`, [testQuiz.id]);
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
});
