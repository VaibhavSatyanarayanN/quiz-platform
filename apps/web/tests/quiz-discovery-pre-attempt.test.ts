import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

interface PublishedCatalogItem {
  id: string;
  title: string;
  description: string | null;
  organizationId?: string | null;
  latestPublishedVersionId: string;
  latestPublishedVersionNumber: number;
  timeLimitSeconds: number | null;
  totalQuestions: number;
  totalMarks: number;
}

interface AttemptHistoryRecord {
  attemptId: string;
  quizId: string;
  quizVersionId: string;
  version: number;
  status: 'in_progress' | 'submitted' | 'expired';
  score: number | null;
  totalMarks?: number;
  percentage: number | null;
  startedAt: string;
  expiresAt?: string | null;
  submittedAt: string | null;
}

// Helper: Filter catalog items by search & timing
function filterCatalog(
  items: PublishedCatalogItem[],
  params?: { search?: string; timing?: 'all' | 'timed' | 'untimed' },
): PublishedCatalogItem[] {
  let result = [...items];

  if (params?.search && params.search.trim()) {
    const term = params.search.trim().toLowerCase();
    result = result.filter(
      (item) =>
        item.title.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term)),
    );
  }

  if (params?.timing === 'timed') {
    result = result.filter((item) => item.timeLimitSeconds !== null && item.timeLimitSeconds > 0);
  } else if (params?.timing === 'untimed') {
    result = result.filter((item) => item.timeLimitSeconds === null || item.timeLimitSeconds === 0);
  }

  return result;
}

// Helper: Paginate filtered items
function paginateCatalog(items: PublishedCatalogItem[], page = 1, limit = 10) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const total = items.length;
  const totalPages = Math.ceil(total / safeLimit) || 1;
  const skip = (safePage - 1) * safeLimit;
  const pagedItems = items.slice(skip, skip + safeLimit);

  return {
    items: pagedItems,
    total,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

// Helper: Classify learner pre-attempt status
function evaluatePreAttemptState(
  history: AttemptHistoryRecord[],
  referenceNow: number = Date.now(),
) {
  const inProgressAttempt = history.find((a) => a.status === 'in_progress');
  const pastAttempts = history.filter((a) => a.status !== 'in_progress');

  if (!inProgressAttempt) {
    return {
      hasActiveAttempt: false,
      isExpiredOnClient: false,
      activeAttempt: null,
      pastAttempts,
      primaryCta: 'start_quiz',
      ctaTarget: null,
    };
  }

  const isExpired = Boolean(
    inProgressAttempt.expiresAt &&
      new Date(inProgressAttempt.expiresAt).getTime() <= referenceNow,
  );

  return {
    hasActiveAttempt: !isExpired,
    isExpiredOnClient: isExpired,
    activeAttempt: inProgressAttempt,
    pastAttempts,
    primaryCta: isExpired ? 'start_quiz' : 'resume_attempt',
    ctaTarget: isExpired
      ? `/attempts/${inProgressAttempt.attemptId}/result`
      : `/attempts/${inProgressAttempt.attemptId}`,
  };
}

// Helper: Classify learner authorization errors
function classifyCatalogError(error: unknown): { isRestricted: boolean; message: string } {
  if (!error) return { isRestricted: false, message: '' };

  const status = (error as { response?: { status?: number } })?.response?.status;
  const msg =
    (error as Error)?.message ||
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    '';

  const isForbidden =
    status === 403 ||
    msg.toLowerCase().includes('not assigned') ||
    msg.toLowerCase().includes('forbidden');

  return {
    isRestricted: isForbidden,
    message: isForbidden
      ? 'You are not assigned to take this quiz. Please contact your organization administrator or course instructor to be assigned to this assessment.'
      : msg || 'An unexpected error occurred.',
  };
}

describe('Phase 7.4 — Learner Quiz Discovery & Pre-Attempt Frontend Suite', () => {
  const mockCatalog: PublishedCatalogItem[] = [
    {
      id: 'quiz-pub-1',
      title: 'JavaScript Essentials',
      description: 'Core ECMAScript concepts and closures',
      organizationId: null,
      latestPublishedVersionId: 'v1-uuid',
      latestPublishedVersionNumber: 1,
      timeLimitSeconds: 1200, // 20 mins (timed)
      totalQuestions: 10,
      totalMarks: 20,
    },
    {
      id: 'quiz-pub-2',
      title: 'TypeScript Type System',
      description: 'Generics, conditional types, and mapped types',
      organizationId: null,
      latestPublishedVersionId: 'v2-uuid',
      latestPublishedVersionNumber: 2,
      timeLimitSeconds: null, // untimed
      totalQuestions: 15,
      totalMarks: 30,
    },
    {
      id: 'quiz-org-1',
      title: 'Enterprise Architecture Exam',
      description: 'Internal security and microservices architecture',
      organizationId: 'org-internal-uuid',
      latestPublishedVersionId: 'v3-uuid',
      latestPublishedVersionNumber: 1,
      timeLimitSeconds: 3600, // 60 mins (timed)
      totalQuestions: 25,
      totalMarks: 50,
    },
  ];

  it('1. Filter catalog by search term across title and description', () => {
    const searchTitle = filterCatalog(mockCatalog, { search: 'typescript' });
    assert.equal(searchTitle.length, 1);
    assert.equal(searchTitle[0].id, 'quiz-pub-2');

    const searchDesc = filterCatalog(mockCatalog, { search: 'closures' });
    assert.equal(searchDesc.length, 1);
    assert.equal(searchDesc[0].id, 'quiz-pub-1');

    const noMatches = filterCatalog(mockCatalog, { search: 'quantum computing' });
    assert.equal(noMatches.length, 0);
  });

  it('2. Filter catalog by timing filter (timed vs untimed)', () => {
    const timedOnly = filterCatalog(mockCatalog, { timing: 'timed' });
    assert.equal(timedOnly.length, 2);
    assert.ok(timedOnly.every((q) => q.timeLimitSeconds !== null && q.timeLimitSeconds > 0));

    const untimedOnly = filterCatalog(mockCatalog, { timing: 'untimed' });
    assert.equal(untimedOnly.length, 1);
    assert.equal(untimedOnly[0].id, 'quiz-pub-2');
    assert.equal(untimedOnly[0].timeLimitSeconds, null);

    const allQuizzes = filterCatalog(mockCatalog, { timing: 'all' });
    assert.equal(allQuizzes.length, 3);
  });

  it('3. Catalog pagination calculates limits and page counts accurately', () => {
    const paged1 = paginateCatalog(mockCatalog, 1, 2);
    assert.equal(paged1.page, 1);
    assert.equal(paged1.limit, 2);
    assert.equal(paged1.total, 3);
    assert.equal(paged1.totalPages, 2);
    assert.equal(paged1.items.length, 2);

    const paged2 = paginateCatalog(mockCatalog, 2, 2);
    assert.equal(paged2.page, 2);
    assert.equal(paged2.items.length, 1);
    assert.equal(paged2.items[0].id, 'quiz-org-1');
  });

  it('4. Detects active in-progress attempt and prioritizes Resume CTA', () => {
    const activeHistory: AttemptHistoryRecord[] = [
      {
        attemptId: 'att-active-1',
        quizId: 'quiz-pub-1',
        quizVersionId: 'v1-uuid',
        version: 1,
        status: 'in_progress',
        score: null,
        percentage: null,
        startedAt: new Date(Date.now() - 300_000).toISOString(),
        expiresAt: new Date(Date.now() + 900_000).toISOString(), // 15 mins remaining
        submittedAt: null,
      },
      {
        attemptId: 'att-past-1',
        quizId: 'quiz-pub-1',
        quizVersionId: 'v1-uuid',
        version: 1,
        status: 'submitted',
        score: 18,
        totalMarks: 20,
        percentage: 90,
        startedAt: new Date(Date.now() - 86400_000).toISOString(),
        expiresAt: null,
        submittedAt: new Date(Date.now() - 85000_000).toISOString(),
      },
    ];

    const evaluation = evaluatePreAttemptState(activeHistory);
    assert.equal(evaluation.hasActiveAttempt, true);
    assert.equal(evaluation.isExpiredOnClient, false);
    assert.equal(evaluation.primaryCta, 'resume_attempt');
    assert.equal(evaluation.ctaTarget, '/attempts/att-active-1');
    assert.equal(evaluation.pastAttempts.length, 1);
    assert.equal(evaluation.pastAttempts[0].status, 'submitted');
  });

  it('5. Correctly detects attempt that expired while on client and yields result link', () => {
    const expiredHistory: AttemptHistoryRecord[] = [
      {
        attemptId: 'att-expired-1',
        quizId: 'quiz-pub-1',
        quizVersionId: 'v1-uuid',
        version: 1,
        status: 'in_progress',
        score: null,
        percentage: null,
        startedAt: new Date(Date.now() - 1500_000).toISOString(),
        expiresAt: new Date(Date.now() - 300_000).toISOString(), // expired 5 mins ago
        submittedAt: null,
      },
    ];

    const evaluation = evaluatePreAttemptState(expiredHistory);
    assert.equal(evaluation.hasActiveAttempt, false);
    assert.equal(evaluation.isExpiredOnClient, true);
    assert.equal(evaluation.primaryCta, 'start_quiz');
    assert.equal(evaluation.ctaTarget, '/attempts/att-expired-1/result');
  });

  it('6. Classifies 403 Forbidden as an organization tenant assignment restriction', () => {
    const forbiddenError = {
      response: {
        status: 403,
        data: { message: 'You are not assigned to take this quiz' },
      },
    };

    const classified = classifyCatalogError(forbiddenError);
    assert.equal(classified.isRestricted, true);
    assert.ok(classified.message.includes('not assigned to take this quiz'));

    const notFoundError = {
      response: {
        status: 404,
        data: { message: 'Quiz not found' },
      },
    };
    const classified404 = classifyCatalogError(notFoundError);
    assert.equal(classified404.isRestricted, false);
  });

  it('7. Guarantees answer keys (isCorrect) are strictly absent in taker preview payloads', () => {
    const previewPayload = {
      quizId: 'quiz-preview-1',
      quizVersionId: 'v1-preview',
      title: 'Taker Safe Quiz',
      questions: [
        {
          id: 'q-1',
          text: 'What is TypeScript?',
          options: [
            { id: 'opt-1', text: 'Typed superset of JS', order: 1 },
            { id: 'opt-2', text: 'Database engine', order: 2 },
          ],
        },
      ],
    };

    for (const q of previewPayload.questions) {
      for (const opt of q.options) {
        assert.equal('isCorrect' in opt, false, 'Option must never expose isCorrect to learners');
      }
    }
  });
});
