/**
 * tests/api.uploadProductFile.test.jsx
 * Verifies uploadProductFile posts the file as field "file" to
 * /upload/product-file with multipart headers.
 */
import { vi } from 'vitest';

const postMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { url: 'https://cdn/x.pdf', name: 'x.pdf', size: 10 } }));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      post: postMock,
      get: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    }),
  },
}));

// supabaseClient is imported by api.js for the refresh flow; stub it.
vi.mock('../services/supabaseClient', () => ({ getSupabase: () => Promise.resolve({ auth: { refreshSession: vi.fn() } }) }));

import { uploadProductFile } from '../services/api';

beforeEach(() => postMock.mockClear());

describe('uploadProductFile', () => {
  test('posts a FormData with field "file" to /upload/product-file', async () => {
    const file = new File(['hello'], 'guide.pdf', { type: 'application/pdf' });
    await uploadProductFile(file);

    expect(postMock).toHaveBeenCalled();
    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe('/upload/product-file');
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('file')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });
});
