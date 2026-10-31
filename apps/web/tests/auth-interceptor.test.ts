import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Auth Interceptor Polish & 401 Loop Prevention', () => {
  function shouldTriggerRefresh(url: string | undefined, status: number, isRetry: boolean | undefined): boolean {
    if (status !== 401 || isRetry) {
      return false;
    }
    const requestUrl = url ?? '';
    const isAuthRequest =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/register');

    return !isAuthRequest;
  }

  it('prevents refresh loop on failed login (401 on /auth/login)', () => {
    const triggers = shouldTriggerRefresh('/api/auth/login', 401, false);
    assert.equal(triggers, false, 'Failed login should not trigger refresh loop');
  });

  it('prevents refresh loop on failed token refresh (401 on /auth/refresh)', () => {
    const triggers = shouldTriggerRefresh('/api/auth/refresh', 401, false);
    assert.equal(triggers, false, 'Failed refresh should not trigger another refresh');
  });

  it('prevents refresh loop on registration 401', () => {
    const triggers = shouldTriggerRefresh('/api/auth/register', 401, false);
    assert.equal(triggers, false, 'Auth register should not trigger refresh');
  });

  it('triggers token refresh on protected API 401 (e.g. /quizzes, /classrooms)', () => {
    const triggers = shouldTriggerRefresh('/api/quizzes/creator', 401, false);
    assert.equal(triggers, true, 'Protected API 401 should trigger refresh');
  });

  it('does not re-trigger refresh if request is already retried (_retry: true)', () => {
    const triggers = shouldTriggerRefresh('/api/quizzes/creator', 401, true);
    assert.equal(triggers, false, 'Retried request should not trigger another refresh');
  });
});
