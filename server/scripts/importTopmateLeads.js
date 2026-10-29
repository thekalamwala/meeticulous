/**
 * importTopmateLeads.js — load the verified LinkedIn + Topmate prospect list
 * into the Sales-Lead CRM (`leads`) for founder-led outbound.
 *
 * Reuses leadService.upsertLead (email-dedup, never-regress, schema-tolerant) —
 * no new tables, no new send path. Rich Topmate columns the generic UI importer
 * drops (linkedin/website/topmate_profile/grade/match/ascore) are preserved:
 * mapped to real lead columns where they exist, else stashed in leads.attributes.
 *
 * Scope: grades A + B only (verified LinkedIn + a real email) — the email-
 * addressable pool. Rows without a usable email are skipped (can't dedup, can't
 * email). Tags + saved segments are seeded by migration v3.150.
 *
 * The CSV is PII (real people) — it lives on disk, is NEVER committed.
 *
 * Usage:
 *   node scripts/importTopmateLeads.js                 # DRY RUN (writes nothing; emits a preview)
 *   node scripts/importTopmateLeads.js --commit        # upsert into leads (needs server .env)
 *   node scripts/importTopmateLeads.js --files a.csv,b.csv   # override input files
 *   node scripts/importTopmateLeads.js --selftest      # run the built-in asserts
 *
 * ponytail: purpose-built mapper for THIS dataset, run by hand like a migration.
 * The generic /import endpoint stays untouched.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Minimal RFC-4180 CSV parser ───────────────────────────────────────────────
// The dataset has commas AND newlines inside quoted fields (all_socials,
// website_all), so a line/`split(',')` parser corrupts rows. This handles quotes,
// "" escapes and embedded newlines. Returns array of objects keyed by the header.
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  text = text.replace(/^﻿/, '');           // strip BOM
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { pushField(); pushRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? '').trim()])));
}

// ── Small helpers ──────────────────────────────────────────────────────────────
const decodeEntities = (s = '') => String(s)
  .replace(/&#x27;|&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&#x2F;/gi, '/');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDER = /(example@|test@|no-?reply|your-?email|email@example|@sentry\.|@example\.)/i;
const emailUsable = (e) => !!e && EMAIL_RE.test(e) && !PLACEHOLDER.test(e);

const FREE_PROVIDERS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com',
  'aol.com', 'rediffmail.com', 'proton.me', 'protonmail.com', 'pm.me', 'gmx.com',
]);
// Domains that host a page for you but you don't OWN as a brand → NOT a switcher signal.
const AGGREGATORS = [
  'linktr.ee', 'linktree.com', 'topmate.io', 'topmate.click', 'bio.site', 'beacons.ai',
  'github.io', 'github.com', 'gitlab.io', 'notion.site', 'notion.so', 'beehiiv.com',
  'substack.com', 'medium.com', 'hashnode.dev', 'hashnode.com', 'blogspot.com',
  'wordpress.com', 'wixsite.com', 'vercel.app', 'netlify.app', 'lovable.app',
  'graphy.com', 'myinstamojo.com', 'gumroad.com', 'kit.com', 'googleusercontent.com',
  'google.com', 'google.ca', 'quora.com', 'about.me', 'fueler.io', 't.co', 'share.google',
];
const isFree = (d = '') => FREE_PROVIDERS.has(d.toLowerCase());
const isAggregator = (d = '') => { d = d.toLowerCase(); return AGGREGATORS.some((a) => d === a || d.endsWith('.' + a)); };
const domainOf = (email = '') => (email.split('@')[1] || '').toLowerCase();

// The `name` column is sometimes a role/handle ("admin", "support") — prefer the
// Topmate display name when the primary name is junk or blank.
const JUNK_NAMES = new Set(['admin', 'support', 'info', 'contact', 'team', 'hello', 'none', 'owner', 'user']);
const pickName = (name, tmName) => {
  const n = decodeEntities(name || '').trim();
  return (!n || JUNK_NAMES.has(n.toLowerCase())) ? decodeEntities(tmName || '').trim() : n;
};

const JUNK_URL = /googleusercontent|substackcdn|\/image\/|\.(jpg|jpeg|png|gif|webp)(\?|$)|google\.[a-z.]+\/search/i;
function cleanWebsite(raw, domain) {
  raw = (raw || '').trim();
  if (raw && /^https?:\/\//i.test(raw) && !JUNK_URL.test(raw)) return raw;
  return domain ? `https://${domain}` : '';
}

function parseSocials(json) {
  try { const o = JSON.parse(json); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
const firstMatch = (arr, needle) => (Array.isArray(arr) ? arr.find((u) => (u || '').toLowerCase().includes(needle)) : '') || '';

// topmate.io/<slug> → "<slug>" (drop query/trailing slash), for the enrichment join.
const topmateSlug = (url = '') => {
  const m = String(url).match(/topmate\.[a-z]+\/([^/?#]+)/i);
  return m ? m[1].toLowerCase() : '';
};

// ── Best-effort profession/type inference ───────────────────────────────────────
// ponytail: keyword heuristic over the text we have, low-confidence flagged in
// attributes.type_confidence. Correct in bulk from the lead list, don't build ML.
// Stems match as substrings (so "psycholog" catches "Psychologist"); short or
// ambiguous tokens keep \b guards (so "dev" doesn't fire on "Devanshu").
const TYPE_RULES = [ // precedence: most specific first
  ['finance',    /finance|fintech|wealth|invest|mutual fund|stock|trading|\btax\b|\bgst\b|\bca\b|chartered account|\bcfo\b|accounting|payroll|nri tax|quant|equity research|portfolio manager|financial analyst/i],
  ['health',     /nutrition|dietician|dietitian|doctor|psycholog|therap|wellness|fitness|gyneco|dental|dentist|medical|physician|\bmental\b|ayurveda|clinic|counsel/i],
  ['developer',  /developer|devops|\bdev\b|engineer|software|frontend|backend|full[- ]?stack|programming|coding|coder|python|javascript|\breact\b|golang|\bsde\b|machine learning|data scien|data engineer|big ?data|architect|gen ?ai|agentic|\bml\b|\bllm\b|\bnlp\b|\bai\b engineer|prompt engineer|cyber|\bsecurity\b|threat detection|infosec|pentest|penetration test|\bsre\b|site reliability|hacker|system design|vlsi|\bcloud\b|kubernetes|blockchain|tech speaker/i],
  ['career',     /career|resume|interview|hiring|placement|\bjobs?\b|land better|preplaced/i],
  ['product',    /product manager|product management|\bpm\b|productwallah|roadmap/i],
  ['designer',   /designer|\bux\b|\bui\b|product design|graphic design/i],
  ['marketing',  /marketing|\bbrand|\bseo\b|content writ|content strateg|copywrit|\bgrowth\b|social media|\bads\b|agency/i],
  ['coach',      /coach/i],
  ['mentor',     /mentor/i],
  ['consultant', /consult|advisory|advisor/i],
  ['creator',    /creator|influencer|youtube|podcast|blogger|\bwriter\b|\bauthor\b|storytell/i],
  ['founder',    /founder|entrepreneur|startup|solopreneur/i],
];
function inferType(hay) {
  hay = (hay || '').toLowerCase();
  const hits = TYPE_RULES.filter(([, re]) => re.test(hay));
  if (!hits.length) return { tag: null, confidence: 'none' };
  const [tag, re] = hits[0];
  const count = (hay.match(new RegExp(re.source, 'gi')) || []).length;
  return { tag, confidence: count >= 2 || hits.length >= 2 ? 'high' : 'medium' };
}

// ── Row → lead patch (or a skip) ────────────────────────────────────────────────
function transform(r, enrich = {}, opts = {}) {
  const grade = (r.grade || '').trim().toUpperCase();
  // Default: only the email-addressable, verified tiers (A/B). `anyEmail` widens
  // to every row that has a usable email, regardless of grade or link_status
  // (a dead Topmate link doesn't affect email deliverability).
  if (!opts.anyEmail) {
    if (grade !== 'A' && grade !== 'B') return { skip: 'not grade A/B' };
    if (r.link_status && r.link_status.trim() && r.link_status.trim().toLowerCase() !== 'active') {
      return { skip: `link ${r.link_status.trim().toLowerCase()}` };
    }
  }

  const email = (r.primary_email || '').trim().toLowerCase();
  if (!emailUsable(email)) return { skip: email ? 'unusable email' : 'no email' };

  // Topmate headline (scraped by enrichTopmateCategories.js) is the strongest
  // profession signal we have — put it first in the inference haystack.
  const headline = enrich[topmateSlug(r.topmate_profile)]?.headline || '';

  const socials = parseSocials(r.all_socials);
  const name = pickName(r.name, r.tm_name);
  const company = decodeEntities(r.company || '').trim();
  const domain = (r.domain || domainOf(email) || '').toLowerCase();
  const website = cleanWebsite(r.website, domain);
  const linkedinPersonal = firstMatch(socials.linkedin, '/in/') || r.linkedin_profile || '';
  const instagram = firstMatch(socials.instagram, 'instagram.com') || '';
  const phone = (r.discovered_phones || '').split(/[;, ]/).map((s) => s.trim()).find((s) => /\d{7,}/.test(s)) || '';

  const dom = domainOf(email);
  const nature = isFree(dom) ? 'personal-email' : 'business-email';
  const switcher = nature === 'business-email' && !!dom && !isAggregator(dom);
  const { tag: typeTag, confidence: typeConf } =
    inferType([headline, headline, name, company, r.topmate_profile, website, r.source_url, r.all_socials].join(' '));

  const tags = ['topmate', nature];
  if (grade) tags.push(`grade-${grade.toLowerCase()}`);       // grade-a|b|c|d — lets you isolate the safe set
  if (grade === 'A' || grade === 'B') tags.push('verified-email'); // A/B = verified LinkedIn + email; D is unconfirmed
  if (grade === 'A') tags.push('high-priority');
  if (switcher) tags.push('potential-switcher');
  if (typeTag) tags.push(typeTag);

  const score = Math.max(0, Math.min(100, parseInt(r.ascore, 10) || 0));

  return {
    patch: {
      name,
      email,
      phone,
      whatsapp_phone: phone,
      linkedin: linkedinPersonal,
      website,
      instagram,
      business_name: company,
      profession: typeTag || '',
      score,
      intent: grade === 'A' ? 'high' : grade === 'B' ? 'medium' : 'low',
      tags: [...new Set(tags)],
      attributes: {
        source_dataset: 'topmate',
        grade,
        topmate_profile: r.topmate_profile || '',
        topmate_headline: headline,
        domain,
        email_tier: r.email_tier || '',
        match_signal: r.verified_linkedin || '',
        match_confidence: r.confidence || '',
        ascore: r.ascore || '',
        tm_name: r.tm_name || '',
        india: r.india || '',
        india_signals: r.india_signals || '',
        link_status: (r.link_status || '').trim(),
        linkedin_company: /\/company\//i.test(r.linkedin_profile || '') ? r.linkedin_profile : '',
        type_confidence: typeConf,
      },
    },
    meta: { grade, nature, switcher, typeTag: typeTag || '—', typeConf },
  };
}

// ── Runner ───────────────────────────────────────────────────────────────────
function defaultFiles() {
  const desk = path.join(os.homedir(), 'OneDrive', 'Desktop');
  return ['leads_grade_A.csv', 'leads_grade_B.csv'].map((f) => path.join(desk, f));
}

function loadRows(files) {
  const all = [];
  for (const f of files) {
    if (!fs.existsSync(f)) { console.warn(`! missing: ${f}`); continue; }
    const rows = parseCSV(fs.readFileSync(f, 'utf8'));
    console.log(`  read ${rows.length} rows from ${path.basename(f)}`);
    all.push(...rows);
  }
  return all;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--selftest')) return selftest();
  const commit = args.includes('--commit');
  const anyEmail = args.includes('--any-email');
  const filesArg = args[args.indexOf('--files') + 1];
  const files = args.includes('--files') && filesArg ? filesArg.split(',').map((s) => s.trim()) : defaultFiles();
  const outArg = args[args.indexOf('--out') + 1];
  const outDir = args.includes('--out') && outArg ? outArg : os.tmpdir();

  console.log(`\nTopmate import — ${commit ? 'COMMIT (writing to leads)' : 'DRY RUN (writes nothing)'}${anyEmail ? ' · ANY-EMAIL (all grades/links with a usable email)' : ' · A+B active only'}`);
  const rows = loadRows(files);
  if (!rows.length) { console.error('No input rows. Pass --files a.csv,b.csv'); process.exit(1); }

  // Optional Topmate category cache (produced by enrichTopmateCategories.js).
  // Defaults next to the first input CSV; override with --enrich <path>.
  const enrichArg = args[args.indexOf('--enrich') + 1];
  const enrichPath = args.includes('--enrich') && enrichArg
    ? enrichArg : path.join(path.dirname(files[0]), 'topmate_categories.json');
  let enrich = {};
  if (fs.existsSync(enrichPath)) {
    try { enrich = JSON.parse(fs.readFileSync(enrichPath, 'utf8')); console.log(`  enrich: ${Object.keys(enrich).length} headlines from ${path.basename(enrichPath)}`); }
    catch { console.warn(`! could not read enrich cache ${enrichPath}`); }
  } else { console.log('  enrich: none (run enrichTopmateCategories.js for real Topmate categories)'); }

  const kept = [], skipped = [], seenEmail = new Set();
  for (const r of rows) {
    const t = transform(r, enrich, { anyEmail });
    if (t.skip) { skipped.push({ name: r.name || r.tm_name || '', email: r.primary_email || '', reason: t.skip }); continue; }
    if (seenEmail.has(t.patch.email)) { skipped.push({ name: t.patch.name, email: t.patch.email, reason: 'dup in batch' }); continue; }
    seenEmail.add(t.patch.email);
    kept.push(t);
  }

  // Summary
  const tally = (fn) => kept.reduce((m, k) => { const key = fn(k); m[key] = (m[key] || 0) + 1; return m; }, {});
  console.log(`\n  keep ${kept.length} · skip ${skipped.length}`);
  console.log('  by grade   :', tally((k) => k.meta.grade));
  console.log('  by email   :', tally((k) => k.meta.nature));
  console.log('  switchers  :', kept.filter((k) => k.meta.switcher).length);
  console.log('  by type    :', tally((k) => k.meta.typeTag));
  const skipReasons = skipped.reduce((m, s) => { m[s.reason] = (m[s.reason] || 0) + 1; return m; }, {});
  console.log('  skip why   :', skipReasons);

  // Preview artefacts — a nice-to-have. Guarded: a locked temp file (open in a
  // viewer / AV scan) must NEVER abort the actual import below.
  try {
    const jsonPath = path.join(outDir, 'topmate_import_preview.json');
    const csvPath = path.join(outDir, 'topmate_import_preview.csv');
    fs.writeFileSync(jsonPath, JSON.stringify({ kept: kept.map((k) => k.patch), skipped }, null, 2));
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['name', 'email', 'business_name', 'profession', 'score', 'tags', 'website', 'linkedin'];
    const csv = [head.join(',')].concat(kept.map((k) => head.map((h) =>
      esc(h === 'tags' ? k.patch.tags.join('|') : k.patch[h])).join(','))).join('\n');
    fs.writeFileSync(csvPath, csv);
    console.log(`\n  preview: ${jsonPath}\n           ${csvPath}`);
  } catch (e) { console.warn(`\n  (preview not written: ${e.code || e.message})`); }

  if (!commit) { console.log('\nDry run complete. Re-run with --commit to write to leads.\n'); return; }

  // --commit: lazy-require the DB layer (config/supabase throws without SERVICE_ROLE_KEY).
  require('dotenv').config();
  const leadService = require('../services/crm/leadService');
  let created = 0, merged = 0, failed = 0;
  for (const k of kept) {
    try {
      // skipMetaLead: a scraped-prospect import must NOT fire Meta CAPI "Lead"
      // conversion events (would misreport conversions + skew ad optimization).
      const { created: isNew } = await leadService.upsertLead(k.patch, { source: 'import', createdBy: 'topmate-import', skipMetaLead: true });
      isNew ? created++ : merged++;
    } catch (e) { failed++; console.warn(`  ! ${k.patch.email}: ${e.message}`); }
  }
  console.log(`\nCommitted → created ${created} · merged ${merged} · failed ${failed}\n`);
}

// ── Built-in asserts (node scripts/importTopmateLeads.js --selftest) ────────────
function selftest() {
  const A = require('assert');
  // CSV: embedded comma + newline + escaped quote inside a quoted field.
  const csv = 'grade,name,all_socials\nA,Jane,"{""x"":[""a,b""]}"\nB,"Bob\nson",{}';
  const p = parseCSV(csv);
  A.equal(p.length, 2, 'two data rows despite embedded newline');
  A.equal(p[0].all_socials, '{"x":["a,b"]}', 'quoted comma/quote preserved');
  A.equal(p[1].name, 'Bob\nson', 'embedded newline preserved');

  A.ok(emailUsable('r@rupreetg.com') && !emailUsable('example@mysite.com') && !emailUsable('bad@'), 'email gate');
  A.equal(domainOf('a@gmail.com'), 'gmail.com');
  A.ok(isFree('gmail.com') && !isFree('rupreetg.com'), 'free provider');
  A.ok(isAggregator('linktr.ee') && isAggregator('foo.github.io') && !isAggregator('nandan.dev'), 'aggregator');
  A.equal(decodeEntities('Let&#x27;s &amp; Code'), "Let's & Code");
  A.equal(cleanWebsite('https://x.googleusercontent.com/img.png', 'nandan.dev'), 'https://nandan.dev', 'junk url → domain');

  // grade B, gmail, developer → personal-email + type developer, no high-priority
  const b = transform({ grade: 'B', name: 'Dev Guy', primary_email: 'dev@gmail.com', company: 'Cloud DevOps Engineer', ascore: '30', all_socials: '{}' });
  A.ok(b.patch, 'B row kept');
  A.ok(b.patch.tags.includes('personal-email') && b.patch.tags.includes('developer') && !b.patch.tags.includes('high-priority'), 'B tags');
  A.ok(!b.patch.tags.includes('potential-switcher'), 'gmail is not a switcher');
  A.equal(b.patch.intent, 'medium');

  // grade A, on-domain email → high-priority + business-email + switcher
  const a = transform({ grade: 'A', name: 'Rupreet', primary_email: 'r@rupreetg.com', domain: 'rupreetg.com', company: 'Coach', ascore: '11', website: 'https://rupreetg.com/', all_socials: '{}' });
  A.ok(a.patch.tags.includes('high-priority') && a.patch.tags.includes('business-email') && a.patch.tags.includes('potential-switcher'), 'A tags');
  A.ok(a.patch.tags.includes('grade-a') && a.patch.tags.includes('verified-email'), 'A grade tag');
  A.equal(a.patch.intent, 'high');
  A.equal(a.patch.attributes.grade, 'A');

  // anyEmail: a grade-D row with an email imports, tagged grade-d, NOT verified-email, intent low
  A.equal(transform({ grade: 'D', primary_email: 'x@site.com', link_status: 'lost', all_socials: '{}' }).skip, 'not grade A/B', 'D skipped by default');
  const d = transform({ grade: 'D', primary_email: 'x@site.com', domain: 'site.com', link_status: 'lost', all_socials: '{}' }, {}, { anyEmail: true });
  A.ok(d.patch, 'D kept under --any-email despite dead link');
  A.ok(d.patch.tags.includes('grade-d') && !d.patch.tags.includes('verified-email') && !d.patch.tags.includes('high-priority'), 'D tags honest');
  A.equal(d.patch.intent, 'low');

  // stem matches suffix: "Psychologist"/"Clinical" → health (the \b\b bug)
  A.equal(inferType('Online Clinical Psychologist').tag, 'health', 'psychologist → health');
  A.equal(inferType('Devanshu Tak').tag, null, 'a name is not a developer');
  A.equal(inferType('AI & BigData Architect @ Mobilewalla').tag, 'developer', 'architect → developer');
  A.equal(inferType('Quantitative Analyst at UBS').tag, 'finance', 'quant → finance');
  A.equal(inferType('UI/UX & Product Designer | Founder Mindset').tag, 'designer', 'designer beats founder');
  // junk name → Topmate display name
  A.equal(pickName('admin', 'Rakesh Verma'), 'Rakesh Verma');
  A.equal(pickName('Jane Doe', 'jd'), 'Jane Doe');

  // enrichment: scraped Topmate headline drives the type (beats a bare-domain company)
  A.equal(topmateSlug('https://topmate.io/Rakesh_Verma10?x=1'), 'rakesh_verma10');
  const en = transform(
    { grade: 'B', name: 'X', primary_email: 'x@xyz.com', domain: 'xyz.com', company: 'xyz.com', topmate_profile: 'https://topmate.io/xy', all_socials: '{}' },
    { xy: { headline: 'Nutritionist & Dietitian | Author' } });
  A.equal(en.patch.attributes.topmate_headline, 'Nutritionist & Dietitian | Author');
  A.ok(en.patch.tags.includes('health'), 'headline → health tag');

  A.equal(transform({ grade: 'C', primary_email: 'x@y.com' }).skip, 'not grade A/B');
  A.equal(transform({ grade: 'A', primary_email: '' }).skip, 'no email');
  console.log('selftest OK');
}

module.exports = { parseCSV, inferType, transform, decodeEntities, topmateSlug };

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
