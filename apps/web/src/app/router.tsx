import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const DashboardPage = lazy(() => import('@/features/quizzes/pages/DashboardPage'));
const CreatorQuizListPage = lazy(() => import('@/features/quizzes/pages/CreatorQuizListPage'));
const CreatorQuizDetailPage = lazy(() => import('@/features/quizzes/pages/CreatorQuizDetailPage'));
const CreateQuizPage = lazy(() => import('@/features/quizzes/pages/CreateQuizPage'));
const QuizEditPage = lazy(() => import('@/features/quizzes/pages/QuizEditPage'));
const QuizVersionPage = lazy(() => import('@/features/quizzes/pages/QuizVersionPage'));
const QuizPreviewPage = lazy(() => import('@/features/quizzes/pages/QuizPreviewPage'));
const QuizAttemptPage = lazy(() => import('@/features/attempts/pages/QuizAttemptPage'));
const QuizResultPage = lazy(() => import('@/features/attempts/pages/QuizResultPage'));
const AttemptHistoryPage = lazy(() => import('@/features/attempts/pages/AttemptHistoryPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));
const NotFoundPage = lazy(() => import('@/components/feedback/NotFoundPage'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner message="Loading view..." />}>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Authenticated user routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/attempts" element={<AttemptHistoryPage />} />
            <Route path="/attempts/:attemptId" element={<QuizAttemptPage />} />
            <Route path="/attempts/:attemptId/result" element={<QuizResultPage />} />
            <Route path="/quiz/:quizId/versions/:quizVersionId" element={<QuizPreviewPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Creator-only routes */}
          <Route element={<ProtectedRoute allowedRoles={['creator', 'admin']} />}>
            <Route path="/quizzes" element={<CreatorQuizListPage />} />
            <Route path="/quizzes/new" element={<CreateQuizPage />} />
            <Route path="/quizzes/:quizId" element={<CreatorQuizDetailPage />} />
            <Route path="/quizzes/:quizId/edit" element={<QuizEditPage />} />
            <Route path="/quizzes/:quizId/versions/:versionId" element={<QuizVersionPage />} />
          </Route>

          {/* Catch-all 404 route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
