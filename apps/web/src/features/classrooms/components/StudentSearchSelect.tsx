import React, { useState, useMemo } from 'react';
import { useOrganizationStudents } from '../hooks/use-classrooms';
import { Input } from '@/components/ui/Input/Input';
import { Button } from '@/components/ui/Button/Button';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { CreateStudentModal } from './CreateStudentModal';

interface StudentSearchSelectProps {
  organizationId: string;
  enrolledStudentIds: string[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string, studentName?: string) => void;
}

export const StudentSearchSelect: React.FC<StudentSearchSelectProps> = ({
  organizationId,
  enrolledStudentIds,
  selectedStudentId,
  onSelectStudent,
}) => {
  const { data: orgStudents = [], isLoading, isError } = useOrganizationStudents(organizationId);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const filteredStudents = useMemo(() => {
    if (!searchTerm.trim()) return orgStudents;
    const term = searchTerm.toLowerCase();
    return orgStudents.filter(
      (s) => s.username.toLowerCase().includes(term) || s.email.toLowerCase().includes(term),
    );
  }, [orgStudents, searchTerm]);

  const selectedStudent = useMemo(() => {
    return orgStudents.find((s) => s.userId === selectedStudentId);
  }, [orgStudents, selectedStudentId]);

  if (isLoading) {
    return <LoadingSpinner message="Loading organization students..." />;
  }

  if (isError) {
    return (
      <div style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.875rem' }}>
        Failed to load organization students.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Select Student to Enroll
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsCreateModalOpen(true)}
          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
        >
          + Register New Student
        </Button>
      </div>

      <CreateStudentModal
        organizationId={organizationId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onStudentCreated={(newStudent) => {
          onSelectStudent(newStudent.userId, newStudent.username);
        }}
      />
      
      <Input
        placeholder="Type to search by name or email..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />

      {selectedStudent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            backgroundColor: 'var(--color-brand-light, #eff6ff)',
            border: '1px solid var(--color-brand-border, #bfdbfe)',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        >
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-brand-700, #1d4ed8)' }}>
              Selected: {selectedStudent.username}
            </span>{' '}
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
              ({selectedStudent.email})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectStudent('')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
              padding: '0 4px',
            }}
            title="Clear selection"
          >
            ×
          </button>
        </div>
      )}

      {isOpen && (
        <div
          style={{
            maxHeight: '220px',
            overflowY: 'auto',
            borderRadius: '8px',
            border: '1px solid var(--color-border, #e2e8f0)',
            backgroundColor: 'var(--color-surface, #ffffff)',
            boxShadow: 'var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1))',
            marginTop: '4px',
          }}
        >
          {filteredStudents.length === 0 ? (
            <div style={{ padding: '12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No students match "{searchTerm}"
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isEnrolled = enrolledStudentIds.includes(student.userId);
              const isSelected = student.userId === selectedStudentId;

              return (
                <div
                  key={student.id}
                  onClick={() => {
                    if (!isEnrolled) {
                      onSelectStudent(student.userId, student.username);
                    }
                  }}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: isEnrolled ? 'not-allowed' : 'pointer',
                    backgroundColor: isSelected
                      ? 'var(--color-brand-light, #eff6ff)'
                      : 'transparent',
                    borderBottom: '1px solid var(--color-border-subtle, #f1f5f9)',
                    opacity: isEnrolled ? 0.6 : 1,
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isEnrolled && !isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-hover, #f8fafc)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {student.username}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      {student.email}
                    </div>
                  </div>
                  <div>
                    {isEnrolled ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--color-bg-muted, #e2e8f0)',
                          color: 'var(--color-text-muted, #64748b)',
                        }}
                      >
                        Enrolled
                      </span>
                    ) : isSelected ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'var(--color-brand-100, #dbeafe)',
                          color: 'var(--color-brand-700, #1d4ed8)',
                        }}
                      >
                        ✓ Selected
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--color-brand-600, #2563eb)',
                          fontWeight: 500,
                        }}
                      >
                        Select
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
