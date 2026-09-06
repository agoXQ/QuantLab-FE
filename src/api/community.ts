import { apiClient } from './client';
import type { CommunityComment, CommunityContent, CommunityFeedItem, CommunityProfile, Cursor, Page } from '@/types';

type AxiosWithMeta<T> = {
  data: T;
  meta?: Cursor;
};

function withCursor<T>(resp: AxiosWithMeta<{ items?: T[] }>): Page<T> {
  return {
    items: resp.data.items ?? [],
    cursor: resp.meta,
  };
}

function normalizeContent(content?: Partial<CommunityContent>): CommunityContent {
  return {
    ...content,
    id: content?.id ?? 0,
    content_type: content?.content_type ?? 'post',
    object_id: content?.object_id ?? 0,
    author_id: content?.author_id ?? 0,
    title: content?.title ?? '',
    summary: content?.summary ?? '',
    visibility: content?.visibility ?? 2,
    status: content?.status ?? 2,
    like_count: content?.like_count ?? 0,
    favorite_count: content?.favorite_count ?? 0,
    comment_count: content?.comment_count ?? 0,
    view_count: content?.view_count ?? 0,
    created_at: content?.created_at ?? 0,
  };
}

function normalizeFeedItem(item: CommunityFeedItem): CommunityFeedItem {
  return {
    ...item,
    content: normalizeContent(item.content),
    score: item.score ?? 0,
    created_at: item.created_at ?? item.content?.created_at ?? 0,
  };
}

export const communityApi = {
  createContent: (data: { content_type: string; object_id?: number; title: string; summary?: string }) =>
    apiClient.post<{ content_id: number }>('/community/contents', data).then((r) => r.data.content_id),
  getContent: (id: number) =>
    apiClient.get<{ content: CommunityContent }>(`/community/contents/${id}`).then((r) => normalizeContent(r.data.content)),
  getFeed: (params?: { limit?: number; cursor?: string }) =>
    apiClient
      .get<{ items?: CommunityFeedItem[] }>('/community/feed', { params })
      .then((r) => {
        const page = withCursor<CommunityFeedItem>(r as AxiosWithMeta<{ items?: CommunityFeedItem[] }>);
        return { ...page, items: page.items.map(normalizeFeedItem) };
      }),
  like: (id: number) => apiClient.post(`/community/contents/${id}/likes`).then((r) => r.data),
  unlike: (id: number) => apiClient.delete(`/community/contents/${id}/likes`).then((r) => r.data),
  favorite: (id: number) => apiClient.post(`/community/contents/${id}/favorites`).then((r) => r.data),
  unfavorite: (id: number) => apiClient.delete(`/community/contents/${id}/favorites`).then((r) => r.data),
  createComment: (contentId: number, data: { parent_id?: number; body: string }) =>
    apiClient.post<{ comment_id: number }>(`/community/contents/${contentId}/comments`, data).then((r) => r.data.comment_id),
  listComments: (contentId: number, params?: { limit?: number; cursor?: string }) =>
    apiClient
      .get<{ items?: CommunityComment[] }>(`/community/contents/${contentId}/comments`, { params })
      .then((r) => withCursor<CommunityComment>(r as AxiosWithMeta<{ items?: CommunityComment[] }>)),
  deleteComment: (id: number) => apiClient.delete(`/community/comments/${id}`).then((r) => r.data),
  getProfile: (userId: number) =>
    apiClient.get<{ profile: CommunityProfile }>(`/community/users/${userId}/profile`).then((r) => r.data.profile),
  listUserContents: (userId: number, params?: { limit?: number; cursor?: string }) =>
    apiClient
      .get<{ items?: CommunityContent[] }>(`/community/users/${userId}/contents`, { params })
      .then((r) => {
        const page = withCursor<CommunityContent>(r as AxiosWithMeta<{ items?: CommunityContent[] }>);
        return { ...page, items: page.items.map(normalizeContent) };
      }),
};
