import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router';
import { useCreatorQuizzes } from '../hooks/use-quizzes';
import { CreateQuizModal } from '../components/CreateQuizModal';
import { QuizStatus } from '../types/quiz.types';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { Button } from '@/components/ui/Button/Button';
import { Skeleton } from '@/components/ui/Skeleton/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Alert } from '@/components/feedback/Alert';
import { formatDate } from '@/lib/utils/formatters';
import styles from './CreatorQuizListPage.module.css';

export default function CreatorQuizListPage() {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Debounce search query to prevent excessive queries while typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Handle status filter change
  const handleStatusFilterChange = (status: string) => {
    setFilterStatus(status);
    setPage(1);
  };

  // Primary paginated and filtered quiz list query
  const queryParams = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      status: filterStatus === 'all' ? undefined : (filterStatus as QuizStatus),
      page,
      limit,
    }),
    [debouncedSearch, filterStatus, page, limit],
  );

  const { data, isLoading, error, refetch } = useCreatorQuizzes(queryParams);

  // Unfiltered summary count query for KPI cards
  const { data: summaryData } = useCreatorQuizzes({ limit: 50 });

  const quizzes = useMemo(() => data?.items ?? [], [data]);

  const stats = useMemo(() => {
    const allItems = summaryData?.items ?? quizzes;
    const published = allItems.filter((q) => q.status === QuizStatus.PUBLISHED).length;
    const drafts = allItems.filter((q) => q.status === QuizStatus.DRAFT).length;
    const total = summaryData?.total ?? data?.total ?? allItems.length;
    return { total, published, drafts };
  }, [summaryData, data, quizzes]);

  const total = data?.total ?? quizzes.length;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(total / limit));

  return (
    <div className={styles.pageContainer}>
      {/* Top Header Bar */}
      <div className={styles.headerBar}>
        <div className={styles.titleArea}>
          <h1 className={styles.pageTitle}>Quizzes</h1>
          <p className={styles.pageSubtitle}>
            Author, manage, and monitor assessments and AI-generated question banks.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            aria-label="Create New Quiz"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: 6 }}
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Quiz
          </Button>
        </div>
      </div>

      {/* Role Notice for non-creator / learner accounts */}
      {user?.role === 'user' && (
        <Alert variant="warning" title="Learner Account Notice">
          Your current account role is "{user?.role}". Authoring, editing, and managing quizzes
          requires Creator or Admin privileges.
        </Alert>
      )}

      {/* KPI Metrics Band (references/app-screens.md §5) */}
      <div className={styles.kpiStrip}>
        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Total Quizzes</span>
          <span className={styles.kpiValue}>{stats.total}</span>
          <span className={styles.kpiSubtext}>Total registered assessments</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Published</span>
          <span className={`${styles.kpiValue} ${styles.kpiValuePublished}`}>{stats.published}</span>
          <span className={styles.kpiSubtext}>Live & accessible to learners</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Drafts</span>
          <span className={`${styles.kpiValue} ${styles.kpiValueDraft}`}>{stats.drafts}</span>
          <span className={styles.kpiSubtext}>Staged & work-in-progress</span>
        </div>
      </div>

      {/* Search and Filter Toolbar (references/app-screens.md §4.4) */}
      <div className={styles.toolbarCard}>
        <div className={styles.searchBox}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.searchIcon}
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search quizzes by title or description..."
            aria-label="Search quizzes"
          />
          {searchInput && (
            <button
              type="button"
              className={styles.clearSearchButton}
              onClick={() => setSearchInput('')}
              aria-label="Clear search query"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className={styles.filterSegmentedTrack}>
          <button
            type="button"
            className={`${styles.filterTab} ${filterStatus === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => handleStatusFilterChange('all')}
            aria-label="Filter all quizzes"
          >
            <span>All</span>
            <span className={styles.filterTabCount}>{stats.total}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${filterStatus === QuizStatus.PUBLISHED ? styles.filterTabActive : ''}`}
            onClick={() => handleStatusFilterChange(QuizStatus.PUBLISHED)}
            aria-label="Filter published quizzes"
          >
            <span>Published</span>
            <span className={styles.filterTabCount}>{stats.published}</span>
          </button>
          <button
            type="button"
            className={`${styles.filterTab} ${filterStatus === QuizStatus.DRAFT ? styles.filterTabActive : ''}`}
            onClick={() => handleStatusFilterChange(QuizStatus.DRAFT)}
            aria-label="Filter draft quizzes"
          >
            <span>Drafts</span>
            <span className={styles.filterTabCount}>{stats.drafts}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Loading, Error, Empty, or Table */}
      {isLoading ? (
        <div className={styles.tableCard}>
          <div className={styles.skeletonList} aria-busy="true" aria-label="Loading quizzes">
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className={styles.skeletonRow}>
                <div style={{ flex: 1 }}>
                  <Skeleton width="45%" height={20} style={{ marginBottom: 6 }} />
                  <Skeleton width="75%" height={14} />
                </div>
                <Skeleton width="80px" height={24} />
                <Skeleton width="110px" height={16} />
                <Skeleton width="160px" height={32} />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className={styles.tableCard} style={{ padding: 24 }}>
          <Alert variant="danger" title="Unable to load quizzes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span>
                {error instanceof Error
                  ? error.message
                  : 'A network or server error occurred while retrieving your quizzes.'}
              </span>
              <div>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 6 }}
                    aria-hidden="true"
                  >
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Retry Loading
                </Button>
              </div>
            </div>
          </Alert>
        </div>
      ) : quizzes.length === 0 ? (
        <div className={styles.tableCard} style={{ padding: '32px 16px' }}>
          <EmptyState
            title={
              debouncedSearch || filterStatus !== 'all'
                ? 'No matching quizzes found'
                : 'No quizzes yet'
            }
            description={
              debouncedSearch || filterStatus !== 'all'
                ? 'No quizzes match your current search query or filter selection. Try adjusting or clearing filters.'
                : 'Start building your assessment bank by creating your first quiz.'
            }
            actionLabel={
              debouncedSearch || filterStatus !== 'all'
                ? 'Clear Filters'
                : '+ Create Quiz'
            }
            onAction={() => {
              if (debouncedSearch || filterStatus !== 'all') {
                setSearchInput('');
                setFilterStatus('all');
                setPage(1);
              } else {
                setIsModalOpen(true);
              }
            }}
          />
        </div>
      ) : (
        <div className={styles.tableCard}>
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Status</th>
                  <th>Version Info</th>
                  <th>Updated</th>
                  <th className={styles.thRight}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id} className={styles.tableRow}>
                    <td className={styles.quizCol}>
                      <Link to={`/quizzes/${quiz.id}`} className={styles.quizTitleLink}>
                        {quiz.title}
                      </Link>
                      <div className={styles.quizDescription}>
                        {quiz.description || 'No description provided'}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`${styles.statusPill} ${
                          quiz.status === 'published' ? styles.badgeSuccess : styles.badgeNeutral
                        }`}
                      >
                        {quiz.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </td>

                    <td>
                      <div className={styles.versionCol}>
                        <span className={styles.versionText}>
                          {quiz.publishedVersionsCount} published version
                          {quiz.publishedVersionsCount !== 1 ? 's' : ''}
                        </span>
                        {quiz.hasDraft && (
                          <span className={styles.draftActiveTag}>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'currentColor',
                                display: 'inline-block',
                              }}
                            />
                            Draft active
                          </span>
                        )}
                        {quiz.latestVersion && (
                          <span className={styles.latestVersionText}>
                            Latest: v{quiz.latestVersion}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className={styles.dateCol}>{formatDate(quiz.updatedAt)}</td>

                    <td className={styles.actionsCol}>
                      <div className={styles.actionButtonCluster}>
                        <Link
                          to={`/quizzes/${quiz.id}?ai=open`}
                          className={styles.actionBtnGhost}
                          aria-label={`Open AI question generator for ${quiz.title}`}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                          </svg>
                          <span>AI Questions</span>
                        </Link>

                        <Link
                          to={`/quizzes/${quiz.id}/analytics`}
                          className={styles.actionBtnGhost}
                          aria-label={`View analytics for ${quiz.title}`}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M18 20V10M12 20V4M6 20v-6" />
                          </svg>
                          <span>Analytics</span>
                        </Link>

                        <Link
                          to={`/quizzes/${quiz.id}`}
                          className={styles.actionBtnOutline}
                          aria-label={`Manage quiz ${quiz.title}`}
                        >
                          <span>Manage</span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className={styles.paginationBar}>
              <div className={styles.paginationRange}>
                Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}{' '}
                quizzes
              </div>

              <div className={styles.paginationControls}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: 4 }}
                    aria-hidden="true"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Previous
                </Button>

                <span className={styles.pageIndicator}>
                  Page {page} of {totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Next page"
                >
                  Next
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginLeft: 4 }}
                    aria-hidden="true"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <CreateQuizModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export { CreatorQuizListPage as QuizCreatorDashboard };
