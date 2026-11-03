// /api/community client. Every call goes through the shared axios instance (auth header,
// 401 refresh, GET-only retry) and resolves to the response body. Errors keep axios's
// shape: `err.response.status` + `err.response.data = {code, message}`.
import API from './api';

const body = (p) => p.then((r) => r.data);
const page = (cursor) => (cursor ? { cursor } : {});

// Reads (optional auth; 404 = community gate closed for this viewer)
export const getSpaces = () => body(API.get('/community/spaces'));
export const getFeed = ({ tab = 'everyone', cursor } = {}) => body(API.get('/community/feed', { params: { tab, ...page(cursor) } }));
export const getSpaceThreads = ({ key, cursor } = {}) => body(API.get(`/community/spaces/${encodeURIComponent(key)}/threads`, { params: page(cursor) }));
export const getItem = (slug) => body(API.get(`/community/items/${encodeURIComponent(slug)}`));
export const getComments = ({ slug, cursor } = {}) => body(API.get(`/community/items/${encodeURIComponent(slug)}/comments`, { params: page(cursor) }));
export const getMe = () => body(API.get('/community/me'));

// Writes (logged in; COMMUNITY_TERMS_REQUIRED until acceptTerms)
export const acceptTerms = () => body(API.post('/community/terms'));
export const createItem = (payload) => body(API.post('/community/items', payload));
export const updateItem = (id, patch) => body(API.patch(`/community/items/${id}`, patch));
export const deleteItem = (id) => body(API.delete(`/community/items/${id}`));
export const createComment = (itemId, payload) => body(API.post(`/community/items/${itemId}/comments`, payload));
export const updateComment = (id, patch) => body(API.patch(`/community/comments/${id}`, patch));
export const deleteComment = (id) => body(API.delete(`/community/comments/${id}`));
export const acceptAnswer = (itemId, commentId) => body(API.post(`/community/items/${itemId}/accept`, { comment_id: commentId }));
export const like = (targetType, id) => body(API.post('/community/reactions', { target_type: targetType, target_id: id }));
export const unlike = (targetType, id) => body(API.delete('/community/reactions', { data: { target_type: targetType, target_id: id } }));
export const report = (payload) => body(API.post('/community/reports', payload));
