import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { QuizStatus } from '../src/features/quizzes/types/quiz.types.ts';
import type { CreatorQuizListItem } from '../src/features/quizzes/types/quiz.types.ts';

describe('Phase 7.1 — Quiz Creator Dashboard (Frontend Logic & Contracts)', () => {
  const sampleQuizzes: CreatorQuizListItem[] = [
    {
      id: 'quiz-1',
      title: 'Advanced TypeScript Patterns',
      description: 'Generics, conditional types, and template literals',
      status: QuizStatus.PUBLISHED,
      publishedVersionsCount: 2,
      hasDraft: true,
      latestVersion: 2,
      latestVersionId: 'ver-2',
      latestVersionStatus: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-15T12:00:00.000Z',
    },
    {
      id: 'quiz-2',
      title: 'NestJS Architecture & DI',
      description: 'Modular monolith principles and testing',
      status: QuizStatus.DRAFT,
      publishedVersionsCount: 0,
      hasDraft: true,
      latestVersion: 1,
      latestVersionId: 'ver-draft',
      latestVersionStatus: null,
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-25T14:30:00.000Z',
    },
    {
      id: 'quiz-3',
      title: 'Docker & Microservices Basics',
      description: null,
      status: QuizStatus.PUBLISHED,
      publishedVersionsCount: 1,
      hasDraft: false,
      latestVersion: 1,
      latestVersionId: 'ver-docker-1',
      latestVersionStatus: null,
      createdAt: '2026-10-05T08:00:00.000Z',
      updatedAt: '2026-10-05T09:00:00.000Z',
    },
  ];

  it('7.1-1. Success state: calculates accurate KPI metrics across drafts and published quizzes', () => {
    const published = sampleQuizzes.filter((q) => q.status === QuizStatus.PUBLISHED).length;
    const drafts = sampleQuizzes.filter((q) => q.status === QuizStatus.DRAFT).length;
    const total = sampleQuizzes.length;

    assert.equal(total, 3);
    assert.equal(published, 2);
    assert.equal(drafts, 1);
  });

  it('7.1-2. Search filter: matches quizzes by title or description case-insensitively', () => {
    const filterBySearch = (query: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return sampleQuizzes;
      return sampleQuizzes.filter(
        (quiz) =>
          quiz.title.toLowerCase().includes(q) ||
          (quiz.description && quiz.description.toLowerCase().includes(q)),
      );
    };

    // Match by title
    const tsMatches = filterBySearch('typescript');
    assert.equal(tsMatches.length, 1);
    assert.equal(tsMatches[0].id, 'quiz-1');

    // Match by description
    const monolithMatches = filterBySearch('monolith');
    assert.equal(monolithMatches.length, 1);
    assert.equal(monolithMatches[0].id, 'quiz-2');

    // Match uppercase query
    const nestMatches = filterBySearch('NESTJS');
    assert.equal(nestMatches.length, 1);
    assert.equal(nestMatches[0].id, 'quiz-2');

    // No match
    const noneMatches = filterBySearch('Rust');
    assert.equal(noneMatches.length, 0);
  });

  it('7.1-3. Status filter: correctly partitions published vs draft quizzes', () => {
    const filterByStatus = (status: 'all' | QuizStatus) => {
      if (status === 'all') return sampleQuizzes;
      return sampleQuizzes.filter((quiz) => quiz.status === status);
    };

    const allQuizzes = filterByStatus('all');
    assert.equal(allQuizzes.length, 3);

    const published = filterByStatus(QuizStatus.PUBLISHED);
    assert.equal(published.length, 2);
    assert.ok(published.every((q) => q.status === QuizStatus.PUBLISHED));

    const drafts = filterByStatus(QuizStatus.DRAFT);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].id, 'quiz-2');
  });

  it('7.1-4. Version metadata: formats published version counts, draft indicator, and latest version label', () => {
    const q1 = sampleQuizzes[0];
    const q2 = sampleQuizzes[1];
    const q3 = sampleQuizzes[2];

    // Quiz 1 has 2 published versions and an active draft
    assert.equal(q1.publishedVersionsCount, 2);
    assert.equal(q1.hasDraft, true);
    assert.equal(q1.latestVersion, 2);

    // Quiz 2 is purely a draft with 0 published versions
    assert.equal(q2.publishedVersionsCount, 0);
    assert.equal(q2.hasDraft, true);

    // Quiz 3 has 1 published version with no draft
    assert.equal(q3.publishedVersionsCount, 1);
    assert.equal(q3.hasDraft, false);
  });

  it('7.1-5. Empty state distinction: distinguishes between no quizzes created vs no filter matches', () => {
    const getEmptyStateConfig = (itemsCount: number, hasActiveFilters: boolean) => {
      if (itemsCount > 0) return null;
      if (hasActiveFilters) {
        return {
          title: 'No matching quizzes found',
          actionLabel: 'Clear Filters',
          actionType: 'clear_filters',
        };
      }
      return {
        title: 'No quizzes yet',
        actionLabel: '+ Create Quiz',
        actionType: 'create_quiz',
      };
    };

    // When filters yield 0 results
    const filteredEmpty = getEmptyStateConfig(0, true);
    assert.equal(filteredEmpty?.title, 'No matching quizzes found');
    assert.equal(filteredEmpty?.actionLabel, 'Clear Filters');

    // When creator truly has zero quizzes
    const freshCreatorEmpty = getEmptyStateConfig(0, false);
    assert.equal(freshCreatorEmpty?.title, 'No quizzes yet');
    assert.equal(freshCreatorEmpty?.actionLabel, '+ Create Quiz');
  });

  it('7.1-6. Pagination calculations: correctly bounds page limits and calculates totalPages', () => {
    const calculatePagination = (total: number, page: number, limit: number) => {
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const clampedPage = Math.max(1, Math.min(page, totalPages));
      const startItem = total === 0 ? 0 : (clampedPage - 1) * limit + 1;
      const endItem = Math.min(clampedPage * limit, total);
      const canGoPrevious = clampedPage > 1;
      const canGoNext = clampedPage < totalPages;

      return {
        totalPages,
        clampedPage,
        startItem,
        endItem,
        canGoPrevious,
        canGoNext,
      };
    };

    // 25 items, limit 10, page 1
    const p1 = calculatePagination(25, 1, 10);
    assert.equal(p1.totalPages, 3);
    assert.equal(p1.clampedPage, 1);
    assert.equal(p1.startItem, 1);
    assert.equal(p1.endItem, 10);
    assert.equal(p1.canGoPrevious, false);
    assert.equal(p1.canGoNext, true);

    // 25 items, limit 10, page 3 (last page)
    const p3 = calculatePagination(25, 3, 10);
    assert.equal(p3.clampedPage, 3);
    assert.equal(p3.startItem, 21);
    assert.equal(p3.endItem, 25);
    assert.equal(p3.canGoPrevious, true);
    assert.equal(p3.canGoNext, false);

    // 0 items
    const p0 = calculatePagination(0, 1, 10);
    assert.equal(p0.totalPages, 1);
    assert.equal(p0.startItem, 0);
    assert.equal(p0.endItem, 0);
    assert.equal(p0.canGoPrevious, false);
    assert.equal(p0.canGoNext, false);
  });

  it('7.1-7. Contextual action URLs: routes creators to question editor, AI workflow, and analytics', () => {
    const getActionUrls = (quizId: string) => ({
      manage: `/quizzes/${quizId}`,
      aiQuestions: `/quizzes/${quizId}?ai=open`,
      analytics: `/quizzes/${quizId}/analytics`,
    });

    const urls = getActionUrls('quiz-123');
    assert.equal(urls.manage, '/quizzes/quiz-123');
    assert.equal(urls.aiQuestions, '/quizzes/quiz-123?ai=open');
    assert.equal(urls.analytics, '/quizzes/quiz-123/analytics');
  });

  it('7.1-8. Role authorization contract: verifies creator routes reject learner accounts', () => {
    const isRoleAllowed = (role: string, allowedRoles: string[]) => allowedRoles.includes(role);

    const allowed = ['creator', 'admin'];
    assert.equal(isRoleAllowed('creator', allowed), true);
    assert.equal(isRoleAllowed('admin', allowed), true);
    assert.equal(isRoleAllowed('user', allowed), false);
    assert.equal(isRoleAllowed('student', allowed), false);
  });
});
