import { apiClient } from '@/lib/api/client';
import type {
  AdminOverview,
  AdminOrganizationListItem,
  AdminOrganizationListResponse,
  AdminCreatorListResponse,
  AdminCreatorItem,
  CreateOrganizationRequest,
  CreateCreatorRequest,
} from '../types/admin.types';

export const adminApi = {
  getOverview: async (): Promise<AdminOverview> => {
    const response = await apiClient.get<AdminOverview>('/admin/overview');
    return response.data;
  },

  getOrganizations: async (): Promise<AdminOrganizationListResponse> => {
    const response = await apiClient.get<AdminOrganizationListResponse>('/admin/organizations');
    return response.data;
  },

  createOrganization: async (data: CreateOrganizationRequest): Promise<AdminOrganizationListItem> => {
    const response = await apiClient.post<AdminOrganizationListItem>('/admin/organizations', data);
    return response.data;
  },

  getOrganization: async (organizationId: string): Promise<AdminOrganizationListItem> => {
    const response = await apiClient.get<AdminOrganizationListItem>(`/admin/organizations/${organizationId}`);
    return response.data;
  },

  getOrganizationCreators: async (organizationId: string): Promise<AdminCreatorListResponse> => {
    const response = await apiClient.get<AdminCreatorListResponse>(`/organizations/${organizationId}/creators`);
    return response.data;
  },

  createOrganizationCreator: async (
    organizationId: string,
    data: CreateCreatorRequest,
  ): Promise<AdminCreatorItem> => {
    const response = await apiClient.post<AdminCreatorItem>(`/admin/organizations/${organizationId}/creators`, data);
    return response.data;
  },

  updateCreatorStatus: async (
    organizationId: string,
    userId: string,
    isActive: boolean,
  ): Promise<AdminCreatorItem> => {
    const response = await apiClient.patch<AdminCreatorItem>(
      `/admin/organizations/${organizationId}/creators/${userId}/status`,
      { isActive },
    );
    return response.data;
  },
};
