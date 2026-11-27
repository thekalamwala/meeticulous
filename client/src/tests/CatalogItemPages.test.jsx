/**
 * Product + course pages on the slug scheme (/:u/products/:slug, /:u/courses/:slug):
 * an id / legacy slug in the URL is replaced by the canonical slug URL (query kept),
 * and the canonical page carries its own SEO, JSON-LD, summary and visible FAQ.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../services/api', () => ({
  getProductPublic: vi.fn(),
  getCoursePublic: vi.fn(),
  getCourseContent: vi.fn().mockRejectedValue(new Error('not owned')),
  sendOtp: vi.fn(), createProductOrder: vi.fn(), verifyProductPayment: vi.fn(),
  freeDownloadProduct: vi.fn(), downloadProduct: vi.fn(), resendProductLink: vi.fn(),
  createCourseOrder: vi.fn(), verifyCoursePayment: vi.fn(),
}));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));

import { getProductPublic, getCoursePublic } from '../services/api';
import ProductPurchase from '../pages/ProductPurchase';
import CoursePage from '../pages/CoursePage';

const UUID = '3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b';
const HOST = { name: 'Jane Doe', username: 'jane', profession: 'Designer', is_verified: true, social_links: { website: 'https://jane.design' } };
const PRODUCT = { id: UUID, slug: 'brand-kit', title: 'Brand kit', type: 'template', price: 499, description: 'Fonts, colours and logo rules in one Figma file.', thumbnail_url: 'https://img/kit.webp', purchase_count: 3, profiles: HOST, platform_fee: 0, platform_fee_gst: 0, total: 499 };
const COURSE = { id: 'c1', slug: 'ux-101', title: 'UX 101', price: 999, lesson_count: 2, purchase_count: 0, description: 'Learn UX basics.', course_lessons: [{ id: 'a', title: 'One' }, { id: 'b', title: 'Two' }], profiles: HOST, total: 999 };

const Where = () => { const l = useLocation(); return <div data-testid="where">{l.pathname + l.search}</div>; };
const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/:profileSlug/products/:productSlug" element={<><ProductPurchase /><Where /></>} />
      <Route path="/:username/courses/:slug" element={<><CoursePage /><Where /></>} />
    </Routes>
  </MemoryRouter>,
);
const ldTypes = () => [JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)].flat()[0]['@graph'].map((n) => n['@type']);

beforeEach(() => vi.clearAllMocks());

describe('product page', () => {
  test('an id in the URL is replaced by the slug URL, keeping ?dl=', async () => {
    getProductPublic.mockResolvedValue({ data: PRODUCT });
    renderAt(`/jane/products/${UUID}?dl=tok`);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/jane/products/brand-kit?dl=tok'));
  });

  test('canonical page: title, canonical, indexable, Product JSON-LD, summary, FAQ, alt text', async () => {
    getProductPublic.mockResolvedValue({ data: PRODUCT });
    renderAt('/jane/products/brand-kit');
    await waitFor(() => expect(document.title).toBe('Brand kit — Template by Jane Doe'));
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://meeticulous.com/jane/products/brand-kit');
    expect(document.querySelector('meta[name="robots"]').getAttribute('content')).toBe('index,follow');
    expect(ldTypes()).toEqual(expect.arrayContaining(['Product', 'BreadcrumbList', 'FAQPage', 'Person']));
    expect(screen.getByText(/^Template by Jane Doe\./)).toBeTruthy();
    expect(screen.getByText('How do I get access after paying?')).toBeTruthy();
    expect(screen.getByAltText('Brand kit cover')).toBeTruthy();
    expect(document.querySelectorAll('h1')).toHaveLength(1);
  });
});

describe('course page', () => {
  test('a legacy slug in the URL is replaced by the current slug URL', async () => {
    getCoursePublic.mockResolvedValue({ data: COURSE });
    renderAt('/jane/courses/demo-ux-101');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/jane/courses/ux-101'));
  });

  test('canonical page: title, canonical, Course JSON-LD, summary, FAQ', async () => {
    getCoursePublic.mockResolvedValue({ data: COURSE });
    renderAt('/jane/courses/ux-101');
    await waitFor(() => expect(document.title).toBe('UX 101 — course by Jane Doe'));
    expect(document.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://meeticulous.com/jane/courses/ux-101');
    expect(ldTypes()).toEqual(expect.arrayContaining(['Course', 'BreadcrumbList', 'FAQPage']));
    expect(screen.getByText(/^2 video lessons by Jane Doe\./)).toBeTruthy();
    expect(screen.getByText("What's included in UX 101?")).toBeTruthy();
  });
});
