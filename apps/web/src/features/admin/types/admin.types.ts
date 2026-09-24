export interface AdminOverview {
  totalOrganizations: number;
  activeOrganizations: number;
  totalCreators: number;
}

export interface AdminOrganizationListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  creatorsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrganizationListResponse {
  items: AdminOrganizationListItem[];
}

export interface AdminCreatorItem {
  id: string;
  userId: string;
  username: string;
  email: string;
  isActive: boolean;
  role: string;
  createdAt: string;
}

export interface AdminCreatorListResponse {
  items: AdminCreatorItem[];
}

export interface CreateOrganizationRequest {
  name: string;
}

export interface CreateCreatorRequest {
  email: string;
  username: string;
  password?: string;
}
