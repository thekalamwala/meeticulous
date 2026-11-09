'use strict';
/**
 * supportSlaNudge — alerts the team when a customer has waited too long for a human
 * on a 'waiting' or 'assigned' support thread. Time counts only inside support hours.
 *
 * Two breach levels per wait: P1 past 2 business hours, P2 past 1 business day. A thread
 * has no priority of its own, so every thread passes through both.
 * ponytail: add a thread priority column if P1/P2 ever need to differ per ticket.
 *
 * Once per breach: the sla_alerted_* columns (v3.191) survive restarts, unlike the
 * in-memory adminAlert throttle. A failed send stays unstamped, so the next run retries.
 */
const { supabaseAdmin } = require('../config/supabase');
const { adminAlert } = require('../utils/adminAlert');
const supportHours = require('../utils/supportHours');
const { isIntroMessage } = require('../config/supportAgents');

const LEVELS = {
  1: { name: 'P1', target: '2 business hours', minutes: 120 },
  2: { name: 'P2', target: '1 business day', minutes: supportHours.BUSINESS_DAY_MIN },
};

/**
 * When the customer's current wait began (epoch ms), or null if they aren't waiting
 * because a human replied last. Threads handed off before v3.191 have no
 * sla_waiting_since and fall back to their messages.
 */
function clockStart(thread, messages) {
  const times = (keep) => messages.filter(keep).map((m) => Date.parse(m.created_at));
  const lastReply = Math.max(0, ...times((m) => m.sender === 'admin' && !isIntroMessage(m.body)));
  const handoff = Date.parse(thread.sla_waiting_since) || 0;
  if (handoff > lastReply) return handoff;
  const userTimes = times((m) => m.sender === 'user').filter((t) => t > lastReply);
  if (userTimes.length) return Math.min(...userTimes);
  return lastReply ? null : Date.parse(thread.created_at);
}

async function run(now = new Date()) {
  const { data: threads, error } = await supabaseAdmin
    .from('support_threads')
    .select('id, reference, participant_type, status, agent_name, created_at, sla_waiting_since, sla_alerted_clock, sla_alerted_level')
    .in('status', ['waiting', 'assigned']);
  // Fail closed: without the dedupe columns (pre-v3.191) every run would re-alert.
  // Throwing records 'error' in job_runs, so a dead monitor doesn't look healthy.
  if (error) throw new Error(`threads query failed: ${error.message}`);
  if (!threads.length) return { alerted: 0 };

  const { data: messages, error: msgError } = await supabaseAdmin
    .from('support_messages')
    .select('thread_id, sender, body, created_at')
    .in('thread_id', threads.map((t) => t.id))
    .in('sender', ['user', 'admin'])
    .order('created_at', { ascending: false });
  // Missing messages would look like "no human replied" and raise false alerts.
  if (msgError) throw new Error(`messages query failed: ${msgError.message}`);

  let alerted = 0;
  for (const t of threads) {
    const start = clockStart(t, messages.filter((m) => m.thread_id === t.id));
    if (start === null) continue;

    const minutes = Math.floor(supportHours.businessMinutesBetween(new Date(start), now));
    const level = minutes >= LEVELS[2].minutes ? 2 : minutes >= LEVELS[1].minutes ? 1 : 0;
    // A new wait has a new clock, so it can breach again.
    const alreadyAlerted = Date.parse(t.sla_alerted_clock) === start ? t.sla_alerted_level : 0;
    if (level <= alreadyAlerted) continue;

    const clock = new Date(start).toISOString();
    const breach = LEVELS[level];
    const sent = await adminAlert({
      subject: `Support SLA breach (${breach.name}) — ${t.reference}`,
      key: `support-sla:${t.id}:${level}:${clock}`,
      lines: [
        `${t.participant_type === 'host' ? 'Host' : 'Guest'} has waited past the ${breach.target} target for a reply.`,
        `Status: ${t.status}`,
        `Handling: ${t.agent_name || 'Unassigned'}`,
        `Waiting: ${Math.floor(minutes / 60)}h ${minutes % 60}m of support hours`,
      ],
      link: `${process.env.CLIENT_URL || 'https://meeticulous.com'}/admin/support/chat`,
      category: 'Support Alert',
    });
    if (!sent.sent) continue;

    alerted += 1;
    // ponytail: send then stamp. A failed stamp can repeat one alert; stamping first could lose it.
    const { error: stampError } = await supabaseAdmin
      .from('support_threads')
      .update({ sla_alerted_clock: clock, sla_alerted_level: level })
      .eq('id', t.id);
    if (stampError) console.error('[supportSlaNudge] stamp failed', t.id, stampError.message);
  }
  return { alerted };
}

module.exports = { run };
