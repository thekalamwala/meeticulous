# Writing a Moment

Moments are our quiet celebration of days that mattered. Not advertising, not
news, not trend-chasing. Just: *this happened, and it meant something.*

Content lives in [`client/src/data/moments.js`](../client/src/data/moments.js).
Publish = add an entry (newest first) + upload art to the CDN + deploy.

## What qualifies

Moments that represent something meaningful — World Cup wins, Olympic feats,
space and science milestones, medical and environmental wins, historic firsts,
extraordinary kindness, engineering, human perseverance, records.

**Avoid:** politics, celebrity gossip, drama, scandals, clickbait, marketing or
brand events. Only celebrate what deserves remembering. Some weeks: none. Never
invent one to fill space — quality over consistency.

## Tone

Calm. Almost a museum curator speaking quietly. Respectful, thoughtful,
timeless. Not loud, not excited, not salesy.

## Structure — answer five questions (free-form, not fixed fields)

Write the `body` as ordinary `{ p }` / `{ h2 }` blocks, but make sure it covers:

1. **What happened** — the event, simply.
2. **Why it matters** — context; why anyone should care.
3. **What made it possible** — years, discipline, teamwork, sacrifice. Never
   reduce greatness to talent alone.
4. **What we can learn** — one universal human lesson. Not a cliché.
5. **Quiet ending** — one line to remember, as a `{ quote }` block (max one). It
   renders large, centered, hairline above. Examples:
   - *Great moments are rarely created in a single day.*
   - *Every masterpiece was once ordinary practice.*
   - *Success arrives long after most people stop watching.*

**Guiding principle: celebrate effort more than victory.** The trophy is the
visible ending; the real story is the thousands of unseen ordinary days before
it.

## Fields

See the header comment in `moments.js`. `MOMENTS[0]` is auto-`FEATURED` (shown on
the search page and index) — keep the array newest-first. Art convention:
`.../images/moments/<name>.png`, minimal text, large whitespace, collectible.
