export interface ClassroomMember {
  id: string;
  teacherId?: string;
  studentId?: string;
  username: string;
  email: string;
  joinedAt?: string;
}

export interface Classroom {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  teachers?: ClassroomMember[];
  students?: ClassroomMember[];
}

export interface CreateClassroomRequest {
  organizationId: string;
  name: string;
  description?: string;
}
