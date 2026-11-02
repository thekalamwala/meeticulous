import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BotWidget from '../BotWidget';
import { streamBot, sendBotFeedback, botEscalateRating } from '../../../services/api';

// The widget now streams over SSE via streamBot(payload, { onDelta, onDone }).
vi.mock('../../../services/api', () => ({
  streamBot: vi.fn(),
  sendBotFeedback: vi.fn().mockResolvedValue({ data: { ok: true } }),
  botEscalateSendOtp: vi.fn().mockResolvedValue({ data: { ok: true } }),
  botEscalateVerifyOtp: vi.fn().mockResolvedValue({ data: { ok: true, reference: 'CHAT-123456', escalationId: 'e-1' } }),
  botEscalateRating: vi.fn().mockResolvedValue({ data: { ok: true } }),
}));

// Markdown renders <Link>, so the widget must sit inside a router.
const renderWidget = () => render(<BotWidget />, { wrapper: MemoryRouter });
const open = () => fireEvent.click(screen.getByRole('button', { name: /open tithi support/i }));
const ask = (text) => {
  fireEvent.change(screen.getByLabelText(/type your question/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
};

beforeEach(() => vi.clearAllMocks());

describe('BotWidget', () => {
  it('renders the launcher button', () => {
    renderWidget();
    expect(screen.getByRole('button', { name: /open tithi support/i })).toBeInTheDocument();
  });

  it('shows the welcome screen with starter suggestions when opened', () => {
    renderWidget();
    open();
    expect(screen.getByText(/hey, i'm tithi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how do i book a service/i })).toBeInTheDocument();
  });

  it('streams a grounded answer and renders its cited source', async () => {
    streamBot.mockImplementation(async (_payload, { onDelta, onDone }) => {
      onDelta('Connect Google Calendar from your dashboard settings.');
      onDone({
        escalate: false,
        cited_sources: [{ source_file: 'docs/help/availability.md', heading: 'Google Calendar' }],
        conversationId: 'c1', messageId: 'm1',
      });
    });
    renderWidget();
    open();
    ask('How do I connect Google Calendar?');

    expect(await screen.findByText(/connect google calendar from your dashboard/i)).toBeInTheDocument();
    expect(screen.getByText('Google Calendar')).toBeInTheDocument(); // the source chip
    expect(streamBot).toHaveBeenCalledWith(
      expect.objectContaining({ question: 'How do I connect Google Calendar?', conversationId: null }),
      expect.any(Object),
    );
  });

  it('records thumbs feedback for an answered message', async () => {
    streamBot.mockImplementation(async (_p, { onDelta, onDone }) => {
      onDelta('Yes.');
      onDone({ escalate: false, cited_sources: [], conversationId: 'c1', messageId: 'm1' });
    });
    renderWidget();
    open();
    ask('Can I add a service?');
    await screen.findByText('Yes.');
    fireEvent.click(screen.getByRole('button', { name: /^helpful$/i }));
    await waitFor(() => expect(sendBotFeedback).toHaveBeenCalledWith({ messageId: 'm1', feedback: 'up' }));
  });

  it('asks an anonymous visitor how to be contacted when the reply escalates', async () => {
    streamBot.mockImplementation(async (_p, { onDelta, onDone }) => {
      onDelta("I'm getting this to a human on our support team.");
      onDone({ escalate: true, needsContact: true, escalateReason: 'sensitive', cited_sources: [], conversationId: 'c1', messageId: 'm2' });
    });
    renderWidget();
    open();
    ask('I need a refund');
    expect(await screen.findByText(/how would you like us to contact you/i)).toBeInTheDocument();
    // Choosing WhatsApp reveals the number field (reuses the OTP verify flow).
    fireEvent.click(screen.getByRole('button', { name: /continue with whatsapp/i }));
    expect(await screen.findByText(/your whatsapp number/i)).toBeInTheDocument();
  });

  it('shows a Support Request Sent confirmation with the reference for a logged-in user', async () => {
    streamBot.mockImplementation(async (_p, { onDelta, onDone }) => {
      onDelta("I'm getting this to a human on our support team.");
      onDone({ escalate: true, needsContact: false, reference: 'CHAT-8F92AB', cited_sources: [], conversationId: 'c1', messageId: 'm3' });
    });
    renderWidget();
    open();
    ask('Something only a human can fix');
    expect(await screen.findByText(/support request sent/i)).toBeInTheDocument();
    expect(screen.getByText('CHAT-8F92AB')).toBeInTheDocument();
  });

  it('collects an emoji rating after the handoff, then offers ticket tracking', async () => {
    streamBot.mockImplementation(async (_p, { onDelta, onDone }) => {
      onDelta('to a human.');
      onDone({ escalate: true, needsContact: false, reference: 'CHAT-8F92AB', escalationId: 'e-9', cited_sources: [], conversationId: 'c1', messageId: 'm4' });
    });
    renderWidget();
    open();
    ask('human please');
    // rating scale appears
    const rate5 = await screen.findByRole('button', { name: /rate 5 of 5/i });
    fireEvent.click(rate5);
    await waitFor(() => expect(botEscalateRating).toHaveBeenCalledWith({ escalationId: 'e-9', rating: 5 }));
    // then a reference/reply reassurance replaces the scale (no dead ticket link)
    expect(await screen.findByText(/our team will reply/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /track ticket status/i })).toBeNull();
  });
});
