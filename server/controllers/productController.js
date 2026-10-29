// Phase 3: Digital Products — CRUD + secure download
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const otpStore = require('../utils/otpStore');
const { identifierOf } = require('../utils/bookingGrant');
const crypto = require('crypto');
const { calculatePlatformFee, calculateGst, round2 } = require('../lib/pricingEngine');
const platformConfig = require('../services/platformConfig');
const { sendProductDownloadEmail } = require('../utils/productEmail');
const { runInBackground } = require('../utils/background');
const { canActivateMore } = require('../middleware/planMiddleware');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRODUCTS_BUCKET = 'products';
const SIGNED_URL_TTL_SECONDS = 60; // short-lived: link is single-use-ish, expires fast

// Stored file_url is a PUBLIC Supabase Storage URL of the form
//   <SUPABASE_URL>/storage/v1/object/public/products/<objectKey>
// Extract <objectKey> (the path relative to the bucket) so we can mint a signed
// URL. If the stored value is already a bare key (no public prefix), use it as-is.
const extractObjectKey = (fileUrl) => {
  const marker = `/object/public/${PRODUCTS_BUCKET}/`;
  const idx = fileUrl.indexOf(marker);
  if (idx !== -1) return fileUrl.slice(idx + marker.length);
  return fileUrl;
};

// Mint a short-lived signed URL for the product file. Works whether the bucket
// is public or private, so it is safe to ship before flipping the bucket private.
// Returns null on failure (caller maps that to a 404).
const signProductFile = async (fileUrl) => {
  const objectKey = extractObjectKey(fileUrl);
  const { data: signed, error } = await supabaseAdmin.storage
    .from(PRODUCTS_BUCKET)
    .createSignedUrl(objectKey, SIGNED_URL_TTL_SECONDS);
  if (error || !signed?.signedUrl) return null;
  return signed.signedUrl;
};

// Build a slug that is unique within a host's catalogue, so a product can be
// addressed by /:username/:slug. Two products with the same title under one host
// get -2, -3 … suffixes. Uniqueness is per host (the public route is scoped by
// username), so two different hosts may share a slug.
const slugify = (title) =>
  String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'product';

const uniqueHostSlug = async (hostId, title) => {
  const base = slugify(title);
  const { data: rows } = await supabaseAdmin
    .from('products').select('slug').eq('host_id', hostId).like('slug', `${base}%`);
  const used = new Set((rows || []).map((r) => r.slug));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

// ── POST /api/products ────────────────────────────────────────
const createProduct = async (req, res) => {
  try {
    const {
      title, description, type, price, file_url, thumbnail_url,
      product_url, file_name, file_size_bytes,
    } = req.body;
    if (!title || price == null) return res.status(400).json({ message: 'title and price are required' });

    const slug = await uniqueHostSlug(req.user.id, title);

    const payload = {
      host_id: req.user.id, title, description, type: type || 'pdf', price,
      file_url, thumbnail_url, slug,
      product_url, file_name, file_size_bytes,
    };

    let result = await supabaseAdmin.from('products').insert(payload).select().single();

    // Fallback: drop v2.9 fields if the migration hasn't been applied yet.
    if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
      const { product_url: _u, file_name: _n, file_size_bytes: _s, ...payloadCore } = payload;
      result = await supabaseAdmin.from('products').insert(payloadCore).select().single();
    }

    if (result.error) return safeError(res, result.error);
    res.status(201).json(result.data);
  } catch (error) { safeError(res, error); }
};

// ── GET /api/products/mine ────────────────────────────────────
const getMyProducts = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('products')
      .select('*').eq('host_id', req.user.id).order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (error) { safeError(res, error); }
};

// ── PUT /api/products/:id ─────────────────────────────────────
const updateProduct = async (req, res) => {
  try {
    const {
      title, description, type, price, file_url, thumbnail_url, is_active,
      product_url, file_name, file_size_bytes,
    } = req.body;
    // P1-1: activating a product (is_active false→true) must respect the plan's
    // active-product cap. Only gate on a real transition so editing an
    // already-active product (which re-sends is_active:true) isn't blocked.
    if (is_active === true) {
      const { data: current } = await supabaseAdmin
        .from('products').select('is_active').eq('id', req.params.id).eq('host_id', req.user.id).single();
      if (current && current.is_active === false) {
        const gate = await canActivateMore(req.user.id, 'digital_products');
        if (!gate.ok) return res.status(gate.status).json({ message: gate.message, upgrade_required: true });
      }
    }

    const updates = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (type !== undefined) updates.type = type;
    if (price !== undefined) updates.price = price;
    if (file_url !== undefined) updates.file_url = file_url;
    if (thumbnail_url !== undefined) updates.thumbnail_url = thumbnail_url;
    if (is_active !== undefined) updates.is_active = is_active;
    if (product_url !== undefined) updates.product_url = product_url;
    if (file_name !== undefined) updates.file_name = file_name;
    if (file_size_bytes !== undefined) updates.file_size_bytes = file_size_bytes;

    const runUpdate = (u) => supabaseAdmin.from('products')
      .update(u).eq('id', req.params.id).eq('host_id', req.user.id).select().single();

    let result = await runUpdate(updates);

    // Fallback: drop v2.9 fields if the migration hasn't been applied yet.
    if (result.error && /Could not find the|column.*does not exist/i.test(result.error.message)) {
      const { product_url: _u, file_name: _n, file_size_bytes: _s, ...updatesCore } = updates;
      result = await runUpdate(updatesCore);
    }

    if (result.error) return safeError(res, result.error);
    res.json(result.data);
  } catch (error) { safeError(res, error); }
};

// ── DELETE /api/products/:id ──────────────────────────────────
const deleteProduct = async (req, res) => {
  try {
    const { error } = await supabaseAdmin.from('products')
      .delete().eq('id', req.params.id).eq('host_id', req.user.id);
    if (error) return safeError(res, error);
    res.json({ message: 'Product deleted' });
  } catch (error) { safeError(res, error); }
};

// ── GET /api/products/host/:username ─────────────────────────
// Public — returns active products for a vendor's profile page
const getHostProducts = async (req, res) => {
  try {
    const { data: host } = await supabaseAdmin
      .from('profiles').select('id').eq('username', req.params.username).single();
    if (!host) return res.status(404).json({ message: 'Host not found' });

    const { data, error } = await supabaseAdmin.from('products')
      .select('id, title, description, type, price, thumbnail_url, slug, purchase_count')
      .eq('host_id', host.id).eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (error) { safeError(res, error); }
};

// ── GET /api/products/:id ─────────────────────────────────────
// Public — single product detail
const getProduct = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('products')
      .select('id, title, description, type, price, thumbnail_url, slug, purchase_count, profiles!products_host_id_fkey(name, username, profile_image, tagline)')
      .eq('id', req.params.id).eq('is_active', true).single();
    if (error || !data) return res.status(404).json({ message: 'Product not found' });
    res.json(data);
  } catch (error) { safeError(res, error); }
};

// ── GET /api/products/download/:token ────────────────────────
// Secure file download — validates token, returns file_url, increments download_count
const downloadProduct = async (req, res) => {
  try {
    const { token } = req.params;
    const { data: purchase, error } = await supabaseAdmin
      .from('product_purchases')
      .select('*, products(file_url, title)')
      .eq('download_token', token)
      .single();

    if (error || !purchase) return res.status(404).json({ message: 'Download link not found or expired' });
    if (purchase.payment_status !== 'paid') return res.status(403).json({ message: 'Payment not completed' });
    if (new Date(purchase.download_token_expires_at) < new Date())
      return res.status(410).json({ message: 'Download link has expired. Contact the seller for a new link.' });
    if (purchase.download_count >= 3)
      return res.status(410).json({ message: 'Download limit reached (3 downloads). Contact the seller.' });

    // Increment download count
    await supabaseAdmin.from('product_purchases')
      .update({ download_count: purchase.download_count + 1 }).eq('id', purchase.id);

    const fileUrl = purchase.products?.file_url;
    if (!fileUrl) return res.status(404).json({ message: 'File not found. Contact the seller.' });

    // Mint a short-lived signed URL instead of leaking the public storage URL.
    const signedUrl = await signProductFile(fileUrl);
    if (!signedUrl) return res.status(404).json({ message: 'File not found. Contact the seller.' });

    // Return the signed URL — frontend redirects to it
    res.json({
      file_url: signedUrl,
      title: purchase.products?.title,
      downloads_remaining: 2 - purchase.download_count,
    });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/products/free-download ─────────────────────────
// For free products — OTP verified, issue download token
const freeDownload = async (req, res) => {
  try {
    const { product_id, buyer_name, buyer_phone, otp } = req.body;
    // Validate email; never trust a client-supplied buyer_id (derive from auth).
    const buyerEmail = String(req.body.buyer_email || '').toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }

    // Identity check: the caller must prove ownership with a verified OTP
    // (single-use, same store as guest booking). Keyed phone-first via
    // identifierOf to match send-otp (the product page sends a WhatsApp-keyed
    // code); verifying by email alone diverged from the issued key and failed.
    const otpResult = await otpStore.verify(identifierOf({ email: buyerEmail, phone: buyer_phone }), otp);
    if (!otpResult.valid) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    const buyerId = req.user?.id || null;

    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, title, price, host_id, file_url, profiles!products_host_id_fkey(username, name)')
      .eq('id', product_id).single();

    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.price !== 0) return res.status(400).json({ message: 'This product requires payment' });
    if (!product.file_url) return res.status(404).json({ message: 'File not available' });

    // Email the secure link (deferred) — same delivery the paid path uses, so the
    // "a copy has been sent to you" promise on the page holds for free products too.
    const emailLink = (downloadToken) => runInBackground('product:free-download-email', () =>
      sendProductDownloadEmail({
        to: buyerEmail, username: product.profiles?.username, productId: product.id,
        productTitle: product.title, hostName: product.profiles?.name, downloadToken, isFree: true,
      }));

    // Dedupe: reuse a still-valid token for the same product+email instead of
    // spawning a new purchase row on every call (anti-spam / DB-bloat guard).
    const { data: existing } = await supabaseAdmin
      .from('product_purchases')
      .select('download_token, download_token_expires_at')
      .eq('product_id', product_id).eq('buyer_email', buyerEmail)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (existing && new Date(existing.download_token_expires_at) > new Date()) {
      emailLink(existing.download_token);
      return res.json({ download_token: existing.download_token, reused: true });
    }

    const downloadToken = crypto.randomUUID();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { data: purchase } = await supabaseAdmin.from('product_purchases').insert({
      product_id, host_id: product.host_id,
      buyer_id: buyerId, buyer_name, buyer_email: buyerEmail, buyer_phone,
      amount_paid: 0, platform_fee: 0, payment_status: 'paid',
      download_token: downloadToken,
      download_token_expires_at: tokenExpires.toISOString(),
    }).select().single();

    emailLink(downloadToken);
    res.json({ download_token: downloadToken, purchase });
  } catch (error) { safeError(res, error); }
};

// Public detail columns + the host's theme_color (purchase page accent) and a
// server-computed platform_fee so the client never hardcodes the fee.
const PUBLIC_PRODUCT_COLS =
  'id, title, description, type, price, thumbnail_url, slug, purchase_count, ' +
  'profiles!products_host_id_fkey(name, username, profile_image, tagline, theme_color)';

// ── GET /api/products/p/:username/:key ───────────────────────
// Public — resolve a product by host username + slug, falling back to id so
// existing /:profileSlug/product/:id links (and emailed ?dl deep links) keep
// working through the slug migration.
const getProductPublic = async (req, res) => {
  try {
    const { username, key } = req.params;
    const { data: host } = await supabaseAdmin
      .from('profiles').select('id').eq('username', username).single();
    if (!host) return res.status(404).json({ message: 'Product not found' });

    let { data } = await supabaseAdmin.from('products')
      .select(PUBLIC_PRODUCT_COLS)
      .eq('host_id', host.id).eq('slug', key).eq('is_active', true).maybeSingle();

    if (!data && UUID_RE.test(key)) {
      ({ data } = await supabaseAdmin.from('products')
        .select(PUBLIC_PRODUCT_COLS)
        .eq('id', key).eq('host_id', host.id).eq('is_active', true).maybeSingle());
    }
    if (!data) return res.status(404).json({ message: 'Product not found' });

    // Config-driven fee + GST so the client never hardcodes money math (mirrors
    // services). A free product (price 0) → fee 0, gst 0 via calculatePlatformFee.
    const cfg = await platformConfig.getConfig();
    const price = Number(data.price) || 0;
    const fee = calculatePlatformFee(price, { platformFee: cfg.platformFee });
    const gst = calculateGst(fee, { gstRate: cfg.gstRate });
    res.json({
      ...data,
      platform_fee: fee,
      platform_fee_gst: gst,
      gst_rate: cfg.gstRate,
      total: round2(price + fee + gst),
    });
  } catch (error) { safeError(res, error); }
};

// ── POST /api/products/resend-link ───────────────────────────
// Public — re-issue a download link for a buyer's existing PAID purchase when
// the 24h / 3-download grant has lapsed. Email ownership is proven by OTP
// (logged-in buyers who own the row skip it). The OTP gate runs BEFORE the
// existence check returns anything distinguishable, so this can't be used to
// probe which emails bought which product.
const resendDownloadLink = async (req, res) => {
  try {
    const { product_id, otp } = req.body;
    const buyerEmail = String(req.body.buyer_email || '').toLowerCase().trim();
    if (!product_id || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
      return res.status(400).json({ message: 'A valid email and product are required' });
    }

    const { data: purchase } = await supabaseAdmin
      .from('product_purchases')
      .select('id, buyer_id')
      .eq('product_id', product_id).eq('buyer_email', buyerEmail).eq('payment_status', 'paid')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();

    // A logged-in buyer who owns the row skips OTP; everyone else must present a
    // valid code. The OTP check happens regardless of whether a purchase exists,
    // so the response is identical (400 on bad code) either way — no oracle.
    const owns = purchase && req.user?.id && purchase.buyer_id && req.user.id === purchase.buyer_id;
    if (!owns) {
      const otpResult = await otpStore.verify(buyerEmail, otp);
      if (!otpResult.valid) return res.status(400).json({ message: otpResult.reason || 'Invalid or expired code' });
    }

    const genericOk = { message: 'If a purchase exists for that email, a fresh download link is on its way.' };
    if (!purchase) return res.json(genericOk);

    const { data: product } = await supabaseAdmin
      .from('products')
      .select('id, title, file_url, profiles!products_host_id_fkey(username, name)')
      .eq('id', product_id).single();
    if (!product?.file_url) return res.status(404).json({ message: 'File no longer available. Contact the seller.' });

    const downloadToken = crypto.randomUUID();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await supabaseAdmin.from('product_purchases')
      .update({
        download_token: downloadToken,
        download_token_expires_at: tokenExpires.toISOString(),
        download_count: 0,
      })
      .eq('id', purchase.id);

    runInBackground('product:resend-link-email', () => sendProductDownloadEmail({
      to: buyerEmail, username: product.profiles?.username, productId: product.id,
      productTitle: product.title, hostName: product.profiles?.name, downloadToken, isFree: false,
    }));

    // The caller proved ownership (session or OTP), so it's safe to hand back the
    // token for an immediate in-page download in addition to the email.
    res.json({ ...genericOk, download_token: downloadToken });
  } catch (error) { safeError(res, error); }
};

module.exports = {
  createProduct, getMyProducts, updateProduct, deleteProduct,
  getHostProducts, getProduct, getProductPublic, downloadProduct,
  freeDownload, resendDownloadLink,
};
