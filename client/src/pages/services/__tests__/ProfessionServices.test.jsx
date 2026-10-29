// Regression: /services/:slug must emit a real per-page <title> even before the API
// response, so the build-time prerender never bakes the generic shell title (root
// cause of 48 profession pages serving the homepage title to bots).
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProfessionServices from '../ProfessionServices';
import { getProfessionServices } from '../../../services/api';

vi.mock('../../../services/api', () => ({ getProfessionServices: vi.fn() }));

const renderAt = (slug) => render(
  <MemoryRouter initialEntries={[`/services/${slug}`]}>
    <Routes><Route path="/services/:profession" element={<ProfessionServices />} /></Routes>
  </MemoryRouter>,
);

describe('ProfessionServices SEO', () => {
  it('sets a slug-derived title while the API is still loading (never the shell title)', async () => {
    getProfessionServices.mockReturnValue(new Promise(() => {})); // stays pending → loading branch
    renderAt('career-coach');
    await waitFor(() => expect(document.title).toBe('Book a Career Coach online | Meeticulous'));
  });

  it('still sets a real title if the fetch errors (rate-limited at build time)', async () => {
    getProfessionServices.mockReturnValue(Promise.reject(new Error('rate limited')));
    renderAt('life-coach');
    await waitFor(() => expect(document.title).toBe('Book a Life Coach online | Meeticulous'));
  });
});
