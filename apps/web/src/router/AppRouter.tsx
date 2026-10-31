import { BrowserRouter, Routes, Route } from 'react-router';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const DashboardPage = lazy(() => import('@/features/quizzes/pages/DashboardPage'));
const CreatorQuizListPage = lazy(() => import('@/features/quizzes/pages/CreatorQuizListPage'));
const CreateQuizPage = lazy(() => import('@/features/quizzes/pages/CreateQuizPage'));
const CreatorQuizDetailPage = lazy(() => import('@/features/quizzes/pages/CreatorQuizDetailPage'));
const AiGenerationReviewPage = lazy(() => import('@/features/quizzes/pages/AiGenerationReviewPage'));
const QuizPreviewPage = lazy(() => import('@/features/quizzes/pages/QuizPreviewPage'));
const QuizAttemptPage = lazy(() => import('@/features/attempts/pages/QuizAttemptPage'));
const QuizResultPage = lazy(() => import('@/features/attempts/pages/QuizResultPage'));
const AttemptHistoryPage = lazy(() => import('@/features/attempts/pages/AttemptHistoryPage'));
const NotFoundPage = lazy(() => import('@/shared/pages/NotFoundPage'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />

            {/* Quiz Taker & Attempt routes */}
            <Route
              path="/quizzes/:quizId/versions/:quizVersionId"
              element={<QuizPreviewPage />}
            />
            <Route
              path="/quizzes/:quizId/take"
              element={<QuizPreviewPage />}
            />
            <Route
              path="/quizzes/:quizId/published"
              element={<QuizPreviewPage />}
            />
            <Route path="/attempts" element={<AttemptHistoryPage />} />
            <Route path="/quizzes/:quizId/attempts" element={<AttemptHistoryPage />} />
            <Route path="/attempts/:attemptId" element={<QuizAttemptPage />} />
            <Route path="/attempts/:attemptId/result" element={<QuizResultPage />} />
          </Route>

          {/* Creator Studio routes */}
          <Route element={<ProtectedRoute allowedRoles={['creator', 'admin']} />}>
            <Route path="/quizzes" element={<CreatorQuizListPage />} />
            <Route path="/quizzes/new" element={<CreateQuizPage />} />
            <Route path="/quizzes/:quizId" element={<CreatorQuizDetailPage />} />
            <Route
              path="/quizzes/:quizId/ai-generations/:generationId/review"
              element={<AiGenerationReviewPage />}
            />
          </Route>

          {/* Catch-all 404 route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
