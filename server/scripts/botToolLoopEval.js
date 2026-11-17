'use strict';

/**
 * botToolLoopEval.js — run the REAL model against the account tool-loop's golden cases
 * (services/bot/botToolEval) and grade tool selection + the confirmation gate.
 *
 * READ-ONLY: it inspects only the model's FIRST response (which tool it picks, and whether
 * it set confirmed) and NEVER executes a tool — so no email is sent and nothing changes.
 * This is the pre-flip QA gate for `bot_tool_loop`: the unit tests mock the model, so this
 * script is the one thing that checks the model's actual behaviour (does it pick the right
 * tool, preview writes instead of self-confirming, route cancels to send_cancel_link).
 *
 *   cd server && node scripts/botToolLoopEval.js      # needs ANTHROPIC_API_KEY in .env
 *
 * Exit: 0 all pass · 1 some failed · 2 no API key.
 */

require('dotenv').config();
const anthropicClient = require('../services/ai/anthropicClient');
const botTools = require('../services/bot/botTools');
const { contextNote } = require('../services/bot/contextAnswer');
const { toolLoopSystem } = require('../services/botService');
const { CASES, grade, ctxFor } = require('../services/bot/botToolEval');

// One case → what the model did on its FIRST turn (no tool is ever executed).
async function observe(caseItem) {
  const ctx = ctxFor(caseItem.kind);
  const resp = await anthropicClient.getClient().messages.create({
    model: anthropicClient.MODELS.generate,
    max_tokens: 300,
    system: toolLoopSystem(),
    tools: botTools.toolSpecsFor(ctx),
    messages: [{ role: 'user', content: `${contextNote(ctx)}\n\n${caseItem.question}` }],
  });
  const use = (resp.content || []).find((b) => b.type === 'tool_use');
  const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join(' ').trim();
  return use
    ? { tool: use.name, confirmed: use.input ? use.input.confirmed : undefined, text }
    : { tool: null, confirmed: undefined, text };
}

async function main() {
  if (!anthropicClient.isConfigured()) {
    console.error('No ANTHROPIC_API_KEY — set it in server/.env to run the real-model eval.');
    process.exit(2);
  }
  let pass = 0;
  const fails = [];
  for (const c of CASES) {
    let observed = {};
    let g;
    try {
      observed = await observe(c);
      g = grade(c.expect, observed, botTools.isWriteTool);
    } catch (e) {
      g = { pass: false, reason: `error: ${e.message}` };
    }
    const confirmedNote = observed.confirmed !== undefined ? ` confirmed=${observed.confirmed}` : '';
    console.log(`${g.pass ? 'PASS' : 'FAIL'}  ${c.id.padEnd(24)} tool=${observed.tool || '-'}${confirmedNote}  ${g.reason}`);
    if (g.pass) pass += 1; else fails.push(c.id);
  }
  console.log(`\n${pass}/${CASES.length} passed.${fails.length ? ` Failed: ${fails.join(', ')}` : ' All good — spot-check a couple by hand, then consider flipping bot_tool_loop.'}`);
  process.exit(fails.length ? 1 : 0);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { observe, main };
