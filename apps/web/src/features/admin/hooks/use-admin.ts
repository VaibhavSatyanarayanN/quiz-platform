import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin.api';
import type { CreateOrganizationRequest, CreateCreatorRequest } from '../types/admin.types';

export const adminKeys = {
  all: ['admin'] as const,
  overview: () => [...adminKeys.all, 'overview'] as const,
  organizations: () => [...adminKeys.all, 'organizations'] as const,
  organizationDetail: (id: string) => [...adminKeys.all, 'organization', id] as const,
  creators: (orgId: string) => [...adminKeys.all, 'creators', orgId] as const,
};

export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview(),
    queryFn: adminApi.getOverview,
  });
}

export function useAdminOrganizations() {
  return useQuery({
    queryKey: adminKeys.organizations(),
    queryFn: adminApi.getOrganizations,
  });
}

export function useAdminOrganizationDetails(organizationId: string) {
  return useQuery({
    queryKey: adminKeys.organizationDetail(organizationId),
    queryFn: () => adminApi.getOrganization(organizationId),
    enabled: !!organizationId,
  });
}

export function useAdminOrganizationCreators(organizationId: string) {
  return useQuery({
    queryKey: adminKeys.creators(organizationId),
    queryFn: () => adminApi.getOrganizationCreators(organizationId),
    enabled: !!organizationId,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrganizationRequest) => adminApi.createOrganization(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.organizations() });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview() });
    },
  });
}

export function useCreateOrganizationCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      data,
    }: {
      organizationId: string;
      data: CreateCreatorRequest;
    }) => adminApi.createOrganizationCreator(organizationId, data),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.creators(organizationId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizationDetail(organizationId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview() });
    },
  });
}

export function useUpdateCreatorStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      organizationId,
      userId,
      isActive,
    }: {
      organizationId: string;
      userId: string;
      isActive: boolean;
    }) => adminApi.updateCreatorStatus(organizationId, userId, isActive),
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: adminKeys.creators(organizationId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.organizationDetail(organizationId) });
      queryClient.invalidateQueries({ queryKey: adminKeys.overview() });
    },
  });
}
