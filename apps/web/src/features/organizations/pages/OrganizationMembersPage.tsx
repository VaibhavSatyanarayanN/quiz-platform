import React, { useState, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useOrganizationStudents } from '@/features/classrooms/hooks/use-classrooms';
import { useAdminOrganizationCreators } from '@/features/admin/hooks/use-admin';
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card/Card';
import { Badge } from '@/components/ui/Badge/Badge';
import { Button } from '@/components/ui/Button/Button';
import { Input } from '@/components/ui/Input/Input';
import { Alert } from '@/components/feedback/Alert';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/Table/Table';
import { CreateStudentModal } from '@/features/classrooms/components/CreateStudentModal';
import { CreateTeacherModal } from '../components/CreateTeacherModal';

export const OrganizationMembersPage: React.FC = () => {
  const { user, isPlatformAdmin, currentOrganization } = useAuth();

  const organizationId = currentOrganization?.organizationId || '';
  const organizationName = currentOrganization?.organizationName || 'Organization';
  const orgRole = currentOrganization?.role || user?.role || 'user';

  const isOrgAdmin = isPlatformAdmin || orgRole === 'admin' || user?.role === 'admin';
  const isTeacher = orgRole === 'teacher' || user?.role === 'creator';

  const {
    data: students = [],
    isLoading: isStudentsLoading,
    error: studentsError,
    refetch: refetchStudents,
  } = useOrganizationStudents(organizationId);

  const {
    data: creatorsData,
    isLoading: isCreatorsLoading,
    refetch: refetchCreators,
  } = useAdminOrganizationCreators(isOrgAdmin ? organizationId : '');

  const [activeTab, setActiveTab] = useState<'all' | 'teachers' | 'students'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const creators = creatorsData?.items ?? [];

  // Combine members list
  const combinedMembers = useMemo(() => {
    const list: Array<{
      id: string;
      userId: string;
      username: string;
      email: string;
      role: 'admin' | 'teacher' | 'student';
      joinedAt?: string;
    }> = [];

    // Add creators/teachers if loaded
    creators.forEach((c) => {
      list.push({
        id: c.id,
        userId: c.userId,
        username: c.username || 'User',
        email: c.email,
        role: c.role === 'admin' ? 'admin' : 'teacher',
        joinedAt: c.createdAt,
      });
    });

    // Add students
    students.forEach((s) => {
      if (!list.some((existing) => existing.userId === s.userId)) {
        list.push({
          id: s.id,
          userId: s.userId,
          username: s.username,
          email: s.email,
          role: 'student',
          joinedAt: s.joinedAt,
        });
      }
    });

    return list;
  }, [creators, students]);

  const filteredMembers = useMemo(() => {
    let result = combinedMembers;

    if (activeTab === 'teachers') {
      result = result.filter((m) => m.role === 'teacher' || m.role === 'admin');
    } else if (activeTab === 'students') {
      result = result.filter((m) => m.role === 'student');
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (m) => m.username.toLowerCase().includes(term) || m.email.toLowerCase().includes(term),
      );
    }

    return result;
  }, [combinedMembers, activeTab, searchTerm]);

  const isLoading = isStudentsLoading || (isOrgAdmin && isCreatorsLoading);

  if (!organizationId) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert variant="warning">No active organization membership found for your account.</Alert>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message="Loading organization members directory..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
              {organizationName} Directory
            </h1>
            <Badge variant="brand" size="sm">
              {isOrgAdmin ? 'Organization Admin View' : isTeacher ? 'Teacher View' : 'Member'}
            </Badge>
          </div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
            Manage teachers, instructors, and student accounts under {organizationName}.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {(isTeacher || isOrgAdmin) && (
            <Button variant="primary" onClick={() => setIsStudentModalOpen(true)}>
              + Register New Student
            </Button>
          )}

          {isOrgAdmin && (
            <Button variant="outline" onClick={() => setIsTeacherModalOpen(true)}>
              + Create Teacher Account
            </Button>
          )}
        </div>
      </div>

      {bannerMessage && <Alert variant="success">{bannerMessage}</Alert>}
      {studentsError && <Alert variant="danger">{(studentsError as Error)?.message}</Alert>}

      {/* Main Members Card */}
      <Card variant="default">
        <CardHeader style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <CardTitle>Organization Members ({combinedMembers.length})</CardTitle>
              <CardDescription>
                {students.length} Students {creators.length > 0 ? `| ${creators.length} Staff/Teachers` : ''}
              </CardDescription>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-bg-subtle, #f1f5f9)', padding: '4px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'all' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: activeTab === 'all' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  boxShadow: activeTab === 'all' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                All ({combinedMembers.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('teachers')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'teachers' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: activeTab === 'teachers' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  boxShadow: activeTab === 'teachers' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Teachers / Admins ({combinedMembers.filter((m) => m.role !== 'student').length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('students')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'students' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: activeTab === 'students' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  boxShadow: activeTab === 'students' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                Students ({students.length})
              </button>
            </div>
          </div>

          {/* Search Box */}
          <Input
            placeholder="Search member by username or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardHeader>

        <CardBody style={{ padding: 0 }}>
          {filteredMembers.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No members found matching "{searchTerm}".
            </div>
          ) : (
            <TableContainer>
              <Table>
                <Thead>
                  <Tr>
                    <Th>User Name</Th>
                    <Th>Email Address</Th>
                    <Th>Organization Role</Th>
                    <Th>Joined Date</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredMembers.map((m) => (
                    <Tr key={m.userId || m.id}>
                      <Td style={{ fontWeight: 600 }}>{m.username}</Td>
                      <Td style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>{m.email}</Td>
                      <Td>
                        <Badge
                          variant={m.role === 'admin' ? 'coral' : m.role === 'teacher' ? 'peach' : 'neutral'}
                          size="sm"
                        >
                          {m.role === 'admin'
                            ? 'Org Admin'
                            : m.role === 'teacher'
                            ? 'Teacher / Instructor'
                            : 'Student'}
                        </Badge>
                      </Td>
                      <Td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : 'N/A'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      {/* Modals for creating Students and Teachers */}
      <CreateStudentModal
        organizationId={organizationId}
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onStudentCreated={(newStudent) => {
          setBannerMessage(`Student account "${newStudent.username}" registered successfully!`);
          refetchStudents();
          setTimeout(() => setBannerMessage(null), 4000);
        }}
      />

      <CreateTeacherModal
        organizationId={organizationId}
        isOpen={isTeacherModalOpen}
        onClose={() => setIsTeacherModalOpen(false)}
        onTeacherCreated={() => {
          setBannerMessage('Teacher account created successfully!');
          refetchCreators();
          setTimeout(() => setBannerMessage(null), 4000);
        }}
      />
    </div>
  );
};

export default OrganizationMembersPage;
