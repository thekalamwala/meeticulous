import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/communityApi', () => ({
  createItem: vi.fn(), acceptTerms: vi.fn(), getSpaces: vi.fn(), getMe: vi.fn(),
}));
vi.mock('../../../services/api', () => ({ uploadImage: vi.fn() }));
vi.mock('../../../services/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { COMMUNITY_POST_CREATED: 'community_post_created', COMMUNITY_TERMS_ACCEPTED: 'community_terms_accepted' },
}));
const auth = { user: { id: 'u1', is_host: false } };
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => auth }));
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

import { acceptTerms, createItem, getMe, getSpaces } from '../../../services/communityApi';
import { analytics } from '../../../services/analytics';
import Composer from '../Composer';

const SPACES = [
  { key: 'help', name: 'Help & Questions', post_policy: 'everyone', reply_policy: 'everyone' },
  { key: 'host-corner', name: 'Host Corner', post_policy: 'hosts', reply_policy: 'hosts' },
  { key: 'updates', name: 'Updates', post_policy: 'official', reply_policy: 'everyone' },
];
const apiErr = (status, data) => Object.assign(new Error('x'), { response: { status, data } });
const setup = (props = {}) => render(
  <MemoryRouter><Composer open onClose={vi.fn()} defaultKind="post" {...props} /></MemoryRouter>,
);
const type = async (re, text) => userEvent.type(await screen.findByLabelText(re), text);

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', is_host: false };
  getSpaces.mockResolvedValue({ spaces: SPACES });
  getMe.mockResolvedValue({ member: null, terms_version_required: 1 });
  createItem.mockResolvedValue({ item: { id: 'i1', url: '/community/p/hi' } });
});

describe('Composer', () => {
  it('disables submit for a thread with no title', async () => {
    setup({ defaultKind: 'thread', defaultSpaceKey: 'help' });
    await type(/details/i, 'Some details');
    expect(screen.getByRole('button', { name: 'Post thread' })).toBeDisabled();
    await type(/title/i, 'A title');
    expect(screen.getByRole('button', { name: 'Post thread' })).toBeEnabled();
  });

  it('turns the counter red and disables submit past 1,000 chars', async () => {
    setup();
    const box = await screen.findByLabelText(/on your mind/i);
    await userEvent.click(box);
    await userEvent.paste('a'.repeat(1001));
    expect(screen.getByText('1,001 / 1,000').className).toContain('mt-counter--over');
    expect(screen.getByRole('button', { name: 'Post' })).toBeDisabled();
  });

  it('shows the host copy for CONTACT_NOT_ALLOWED', async () => {
    auth.user = { id: 'h1', is_host: true };
    createItem.mockRejectedValue(apiErr(400, { code: 'CONTACT_NOT_ALLOWED', message: 'server' }));
    setup();
    await type(/on your mind/i, 'mail me');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText("Phone numbers and emails aren't allowed — guests book through your page.")).toBeInTheDocument();
  });

  it('shows the guest copy for CONTACT_NOT_ALLOWED', async () => {
    createItem.mockRejectedValue(apiErr(400, { code: 'CONTACT_NOT_ALLOWED' }));
    setup();
    await type(/on your mind/i, 'mail me');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText("Phone numbers and emails aren't allowed — keep the conversation here.")).toBeInTheDocument();
  });

  it('shows the rate-limit copy on 429', async () => {
    createItem.mockRejectedValue(apiErr(429, { message: 'Too many' }));
    setup();
    await type(/on your mind/i, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(await screen.findByText("You're posting a lot — try again in a bit.")).toBeInTheDocument();
  });

  it('opens the terms dialog, accepts, then retries createItem once', async () => {
    createItem.mockRejectedValueOnce(apiErr(403, { code: 'COMMUNITY_TERMS_REQUIRED' }));
    acceptTerms.mockResolvedValue({});
    setup();
    await type(/on your mind/i, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Accept and continue' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/community/p/hi'));
    expect(acceptTerms).toHaveBeenCalledTimes(1);
    expect(createItem).toHaveBeenCalledTimes(2);
    expect(analytics.track).toHaveBeenCalledWith('community_post_created', expect.objectContaining({ kind: 'post' }));
  });

  it('writes nothing when the terms dialog is dismissed with Not now', async () => {
    createItem.mockRejectedValueOnce(apiErr(403, { code: 'COMMUNITY_TERMS_REQUIRED' }));
    setup();
    await type(/on your mind/i, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Post' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(acceptTerms).not.toHaveBeenCalled();
    expect(createItem).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Accept and continue' })).not.toBeInTheDocument();
  });

  it('hides Host Corner from a guest but shows it to a host', async () => {
    setup({ defaultKind: 'thread' });
    await screen.findByRole('option', { name: 'Help & Questions' });
    expect(screen.queryByRole('option', { name: 'Host Corner' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Updates' })).not.toBeInTheDocument();
  });

  it('shows Host Corner to a host', async () => {
    auth.user = { id: 'h1', is_host: true };
    setup({ defaultKind: 'thread' });
    expect(await screen.findByRole('option', { name: 'Host Corner' })).toBeInTheDocument();
  });

  it('shows the support nudge only for a mention plus a complaint word', async () => {
    setup();
    const box = await screen.findByLabelText(/on your mind/i);
    await userEvent.type(box, '@priya total scam');
    expect(screen.getByRole('link', { name: /Support can help/ })).toHaveAttribute('href', '/support');
    await userEvent.clear(box);
    await userEvent.type(box, '@priya great session');
    expect(screen.queryByRole('link', { name: /Support can help/ })).not.toBeInTheDocument();
  });
});
