# Bolt KB — reseeding after help-doc or FAQ changes

The Bolt support bot answers from two **prod database tables** that a normal deploy
does **not** update. Editing the source files (or merging a PR that does) changes the
help *website* on deploy, but Bolt keeps answering from the old data until the tables
are reseeded:

| Table        | Seeded from                              | Script                        |
|--------------|-------------------------------------------|-------------------------------|
| `kb_chunks`  | `docs/help/*.md` (chunked + embedded)      | `server/scripts/seedKnowledgeBase.js` |
| `bot_faqs`   | `server/scripts/data/botFaqs.json`         | `server/scripts/seedBotFaqs.js`       |

## Automatic — on merge to `main`

`.github/workflows/reseed-bot-kb.yml` reseeds both tables whenever a push to `main`
touches `docs/help/**` or the seed scripts/data. It also has a **Run workflow** button
(`workflow_dispatch`).

It uses the same secrets as `host-og-cards.yml`:

- `PROD_SUPABASE_URL`
- `PROD_SUPABASE_SERVICE_ROLE_KEY`
- `VOYAGE_API_KEY` *(optional — without it, `kb_chunks` seed FTS-only, no vector search)*

If the Supabase secrets are missing the job fails fast and changes nothing.

**This targets prod only.** Reseed **staging** by running the scripts locally against
the staging `.env`:

```bash
cd server
node scripts/seedKnowledgeBase.js
node scripts/seedBotFaqs.js
```

## Manual — any environment with the target DB's creds

```bash
cd server
node scripts/seedKnowledgeBase.js   # rebuild kb_chunks from docs/help/*.md
node scripts/seedBotFaqs.js         # rebuild bot_faqs from scripts/data/botFaqs.json
```

Both are idempotent (clear + reinsert). Self-checks (no DB):

```bash
node scripts/seedKnowledgeBase.js --check
node scripts/seedBotFaqs.js --check
```

## Good to know

- `seedKnowledgeBase.js` strips YAML front-matter, so `last_verified:` metadata in the
  help docs never reaches the corpus or the rendered help page.
- `bot_faqs` is curated by hand — thumbs-up auto-promotion is off
  (`BOT_FAQ_AUTOPROMOTE_ENABLED`, default off). To change the FAQ layer, edit
  `botFaqs.json`, open a PR, and let this workflow (or a manual run) reseed.
- `seedBotFaqs.js`'s `--check` refuses to seed abuse/slur patterns — those are handled
  by `abuseGuard`, never by a canned FAQ.
- **Security note:** this workflow uses a prod service-role key in CI. If you'd rather
  not run prod DB writes from GitHub Actions, delete the `push:` trigger (keep
  `workflow_dispatch`) or remove the workflow and reseed manually.
