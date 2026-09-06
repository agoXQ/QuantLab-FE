import { apiClient } from './client';
import type { User, Profile, Strategy, Page } from '@/types';

// Routes mirror the real user-service HTTP surface (app/user/interfaces/http).
// Note: there is no /users/me; the caller resolves the id from the token
// store. Profile update and password change are scoped by :id.
export const userApi = {
  register: (data: { username: string; email: string; password: string; nickname?: string }) =>
    apiClient.post<{ user_id: number }>('/users/register', data).then((r) => r.data.user_id),
  login: (data: { email: string; password: string }) =>
    apiClient
      .post<{ user_id: number; access_token: string; refresh_token: string }>('/users/login', data)
      .then((r) => r.data),
  refreshToken: (refreshToken: string) =>
    apiClient
      .post<{ user: User; access_token: string; refresh_token: string; expires_in: number }>(
        '/users/token/refresh',
        { refresh_token: refreshToken },
      )
      .then((r) => r.data),
  getUser: (id: number) =>
    apiClient.get<{ user: User }>(`/users/${id}`).then((r) => r.data.user),
  getProfile: (id: number) =>
    apiClient.get<Profile>(`/users/${id}/profile`).then((r) => r.data),
  updateProfile: (
    id: number,
    data: { nickname?: string; avatar?: string; bio?: string; location?: string },
  ) => apiClient.put(`/users/${id}/profile`, data).then((r) => r.data),
  changePassword: (id: number, data: { current_password: string; new_password: string }) =>
    apiClient.post(`/users/${id}/password`, data).then((r) => r.data),
  follow: (id: number) => apiClient.post(`/users/${id}/follow`).then((r) => r.data),
  unfollow: (id: number) => apiClient.delete(`/users/${id}/follow`).then((r) => r.data),
  listStrategies: (id: number, params?: { limit?: number; cursor?: string }) =>
    apiClient.get<Page<Strategy>>('/strategies', { params: { ...params, author_id: id } }).then((r) => r.data),
};
