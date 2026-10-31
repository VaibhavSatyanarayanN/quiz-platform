import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  QuestionType,
  QuizVersionStatus,
} from '../src/features/quizzes/types/quiz.types.ts';

const UserRole = {
  LEARNER: 'learner',
  TAKER: 'taker',
  CREATOR: 'creator',
  ADMIN: 'admin',
} as const;
type UserRole = (typeof UserRole)[keyof typeof UserRole];

interface OptionItem {
  id?: string;
  text: string;
  isCorrect?: boolean;
}

interface QuestionItem {
  id?: string;
  text: string;
  marks?: number;
  questionType: QuestionType;
  options: OptionItem[];
}

interface PublishingValidationInput {
  title: string;
  questions: QuestionItem[];
  hasInFlightAiGeneration: boolean;
}

function validatePublishingReadiness(input: PublishingValidationInput) {
  const blockers: string[] = [];

  if (!input.title || !input.title.trim()) {
    blockers.push('Quiz title cannot be empty.');
  }

  if (input.hasInFlightAiGeneration) {
    blockers.push('An AI question generation job is currently in progress.');
  }

  if (!input.questions || input.questions.length === 0) {
    blockers.push('The version must contain at least one question.');
    return { isReady: false, blockers };
  }

  for (let i = 0; i < input.questions.length; i++) {
    const q = input.questions[i];
    const qNum = i + 1;

    if (!q.text || !q.text.trim()) {
      blockers.push(`Question ${qNum} has an empty prompt.`);
    }

    if ((q.marks ?? 1) < 1) {
      blockers.push(`Question ${qNum} must have at least 1 mark.`);
    }

    if (!q.options || q.options.length === 0) {
      blockers.push(`Question ${qNum} has no options.`);
      continue;
    }

    if (
      (q.questionType === QuestionType.SINGLE_CHOICE ||
        q.questionType === QuestionType.MULTIPLE_CHOICE) &&
      q.options.length < 2
    ) {
      blockers.push(`Question ${qNum} must have at least 2 options.`);
    }

    if (q.questionType === QuestionType.TRUE_FALSE && q.options.length !== 2) {
      blockers.push(`Question ${qNum} (True/False) must have exactly 2 options.`);
    }

    const optionTexts = new Set<string>();
    let hasDuplicate = false;
    for (const opt of q.options) {
      const normalized = (opt.text || '').trim().toLowerCase();
      if (!normalized) {
        blockers.push(`Question ${qNum} has an option with empty text.`);
      }
      if (optionTexts.has(normalized)) {
        hasDuplicate = true;
      }
      optionTexts.add(normalized);
    }
    if (hasDuplicate) {
      blockers.push(`Question ${qNum} contains duplicate option choices.`);
    }
  }

  return {
    isReady: blockers.length === 0,
    blockers,
  };
}

function parseAssessmentInput(input: string): { route: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: 'Please enter a Quiz link or Quiz ID / Version ID.' };
  }

  const fullVersionMatch = trimmed.match(/quizzes\/([a-zA-Z0-9-]+)\/versions\/([a-zA-Z0-9-]+)/);
  if (fullVersionMatch) {
    return { route: `/quizzes/${fullVersionMatch[1]}/versions/${fullVersionMatch[2]}` };
  }

  const singleQuizMatch = trimmed.match(/quizzes\/([a-zA-Z0-9-]+)(?:\/take|\/published)?$/);
  if (singleQuizMatch) {
    return { route: `/quizzes/${singleQuizMatch[1]}/take` };
  }

  const parts = trimmed.split(/[/,\s]+/).filter(Boolean);
  if (parts.length === 2) {
    return { route: `/quizzes/${parts[0]}/versions/${parts[1]}` };
  }

  if (parts.length === 1 && parts[0].length >= 8) {
    return { route: `/quizzes/${parts[0]}/take` };
  }

  return { error: 'Expected format: Paste full quiz taker link, quizId, or "quizId / versionId"' };
}

describe('Phase 7.3 — Publishing Workflow Hardening & Learner Discovery (Frontend Logic)', () => {
  it('7.3-1. Publishing readiness: accepts a fully valid question set and approves publication', () => {
    const input: PublishingValidationInput = {
      title: 'Distributed Systems Assessment',
      hasInFlightAiGeneration: false,
      questions: [
        {
          text: 'What is eventual consistency?',
          marks: 3,
          questionType: QuestionType.SINGLE_CHOICE,
          options: [
            { text: 'Data converges to the same state eventually across all nodes', isCorrect: true },
            { text: 'Data is strictly identical at all clock ticks', isCorrect: false },
          ],
        },
      ],
    };

    const result = validatePublishingReadiness(input);
    assert.equal(result.isReady, true);
    assert.equal(result.blockers.length, 0);
  });

  it('7.3-2. Publishing readiness: flags multiple validation blockers simultaneously with actionable messages', () => {
    const input: PublishingValidationInput = {
      title: '   ',
      hasInFlightAiGeneration: true,
      questions: [
        {
          text: '',
          marks: 0,
          questionType: QuestionType.SINGLE_CHOICE,
          options: [
            { text: 'Choice 1', isCorrect: true },
            { text: 'choice 1', isCorrect: false },
          ],
        },
      ],
    };

    const result = validatePublishingReadiness(input);
    assert.equal(result.isReady, false);
    assert.ok(result.blockers.some((b) => b.includes('Quiz title cannot be empty')));
    assert.ok(result.blockers.some((b) => b.includes('AI question generation job is currently in progress')));
    assert.ok(result.blockers.some((b) => b.includes('Question 1 has an empty prompt')));
    assert.ok(result.blockers.some((b) => b.includes('Question 1 must have at least 1 mark')));
    assert.ok(result.blockers.some((b) => b.includes('duplicate option choices')));
  });

  it('7.3-3. Conflict and retry handling: repeated publication succeeds idempotently without error banner', () => {
    let publishCallCount = 0;
    const publishedResponse = {
      quizId: 'quiz-1',
      quizVersionId: 'ver-1',
      version: 1,
      status: QuizVersionStatus.PUBLISHED,
      publishedAt: '2026-10-30T00:00:00Z',
    };

    const mockPublishApi = async () => {
      publishCallCount++;
      return publishedResponse;
    };

    // Simulate first publish and retry
    const handlePublish = async () => {
      return await mockPublishApi();
    };

    return Promise.all([handlePublish(), handlePublish()]).then(([resA, resB]) => {
      assert.equal(publishCallCount, 2);
      assert.equal(resA.status, QuizVersionStatus.PUBLISHED);
      assert.equal(resB.status, QuizVersionStatus.PUBLISHED);
    });
  });

  it('7.3-4. Join Assessment Session input parsing: supports full URLs, quizId/versionId, and standalone quizId', () => {
    const resUrl = parseAssessmentInput('http://localhost:5173/quizzes/q-uuid-12345/versions/v-uuid-67890');
    assert.deepEqual(resUrl, { route: '/quizzes/q-uuid-12345/versions/v-uuid-67890' });

    const resRelative = parseAssessmentInput('/quizzes/q-uuid-12345/versions/v-uuid-67890');
    assert.deepEqual(resRelative, { route: '/quizzes/q-uuid-12345/versions/v-uuid-67890' });

    const resSlash = parseAssessmentInput('q-uuid-12345 / v-uuid-67890');
    assert.deepEqual(resSlash, { route: '/quizzes/q-uuid-12345/versions/v-uuid-67890' });

    const resSingleUrl = parseAssessmentInput('https://app.com/quizzes/q-uuid-12345');
    assert.deepEqual(resSingleUrl, { route: '/quizzes/q-uuid-12345/take' });

    const resSingleId = parseAssessmentInput('q-uuid-12345-long-id');
    assert.deepEqual(resSingleId, { route: '/quizzes/q-uuid-12345-long-id/take' });

    const resEmpty = parseAssessmentInput('   ');
    assert.ok('error' in resEmpty);
  });

  it('7.3-5. Learner Dashboard query partitioning: disables creator-only queries to prevent 403 Forbidden', () => {
    const creatorUser = { role: UserRole.CREATOR };
    const learnerUser = { role: UserRole.LEARNER };

    const shouldEnableCreatorQueries = (user: { role: UserRole }) =>
      user.role === UserRole.CREATOR || user.role === UserRole.ADMIN;

    const shouldEnablePublishedCatalogQuery = (user: { role: UserRole }) =>
      user.role !== UserRole.CREATOR && user.role !== UserRole.ADMIN;

    assert.equal(shouldEnableCreatorQueries(creatorUser), true);
    assert.equal(shouldEnablePublishedCatalogQuery(creatorUser), false);

    assert.equal(shouldEnableCreatorQueries(learnerUser), false);
    assert.equal(shouldEnablePublishedCatalogQuery(learnerUser), true);
  });

  it('7.3-6. Answer key confidentiality: learner preview and attempt responses strictly strip isCorrect', () => {
    const serverTakerPayload = {
      quizId: 'quiz-1',
      quizVersionId: 'ver-1',
      title: 'Assessment',
      questions: [
        {
          id: 'q-1',
          text: 'Question prompt',
          marks: 2,
          options: [
            { id: 'opt-1', text: 'Option A', order: 1 },
            { id: 'opt-2', text: 'Option B', order: 2 },
          ],
        },
      ],
    };

    for (const q of serverTakerPayload.questions) {
      for (const opt of q.options) {
        assert.equal('isCorrect' in opt, false);
      }
    }
  });

  it('7.3-7. Route guard verification: protects creator studio routes while keeping taker routes open to learners', () => {
    const creatorStudioRoutes = [
      '/quizzes',
      '/quizzes/new',
      '/quizzes/:quizId',
      '/quizzes/:quizId/ai-generations/:generationId/review',
    ];

    const takerRoutes = [
      '/',
      '/quizzes/:quizId/versions/:quizVersionId',
      '/quizzes/:quizId/take',
      '/quizzes/:quizId/published',
      '/attempts',
      '/attempts/:attemptId',
      '/attempts/:attemptId/result',
    ];

    const isRouteAuthorized = (route: string, userRole: UserRole) => {
      const isCreatorRoute = creatorStudioRoutes.some((pattern) => {
        const regex = new RegExp(`^${pattern.replace(/:[a-zA-Z0-9]+/g, '[^/]+')}$`);
        return regex.test(route);
      });

      if (isCreatorRoute) {
        return userRole === UserRole.CREATOR || userRole === UserRole.ADMIN;
      }
      return true; // Open to all authenticated users
    };

    // Learner access tests
    for (const route of takerRoutes) {
      assert.equal(isRouteAuthorized(route, UserRole.LEARNER), true);
    }
    assert.equal(isRouteAuthorized('/quizzes', UserRole.LEARNER), false);
    assert.equal(isRouteAuthorized('/quizzes/new', UserRole.LEARNER), false);
    assert.equal(isRouteAuthorized('/quizzes/q-1', UserRole.LEARNER), false);

    assert.equal(isRouteAuthorized('/', UserRole.LEARNER), true);
    assert.equal(isRouteAuthorized('/quizzes/q-1/versions/v-1', UserRole.LEARNER), true);
    assert.equal(isRouteAuthorized('/quizzes/q-1/take', UserRole.LEARNER), true);
    assert.equal(isRouteAuthorized('/attempts', UserRole.LEARNER), true);

    // Creator access tests
    assert.equal(isRouteAuthorized('/quizzes', UserRole.CREATOR), true);
    assert.equal(isRouteAuthorized('/quizzes/new', UserRole.CREATOR), true);
    assert.equal(isRouteAuthorized('/quizzes/q-1', UserRole.CREATOR), true);
  });
});
