const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_FOLDERS = ['profiles', 'covers', 'services', 'branding', 'products'];

// Content-based image detection via magic bytes — the client-supplied mimetype
// and filename extension are both attacker-controlled, so they are never
// trusted. Rejects SVG/HTML/polyglots that could execute if served inline.
const sniffImage = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: '.png', mime: 'image/png' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  return null;
};

// Allowed product-file extensions. The extension is checked AND the content is
// sniffed — both must agree, so a renamed .exe -> .pdf is rejected.
const PRODUCT_EXT_ALLOWLIST = [
  'pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
  'zip', 'epub', 'mp3', 'png', 'jpg',
];

// Magic-byte families. We sniff the byte signature and return the broad family
// it belongs to; we then require the declared extension to be a member of that
// family. This stops content/extension spoofing without parsing each format.
//   %PDF                -> pdf
//   PK\x03\x04          -> zip container: zip, epub, docx, pptx, xlsx
//   D0 CF 11 E0 ...     -> OLE compound: legacy doc, ppt, xls
//   ID3 / 0xFF 0xFB     -> mp3
//   89 50 4E 47         -> png
//   FF D8 FF            -> jpg
const sniffProductFile = (buf, ext) => {
  if (!buf || buf.length < 4) return null;
  const b = buf;
  const ascii = (start, end) => b.toString('ascii', start, end);

  let family = null;
  if (ascii(0, 4) === '%PDF') {
    family = ['pdf'];
  } else if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    family = ['zip', 'epub', 'docx', 'pptx', 'xlsx'];
  } else if (
    b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0
  ) {
    family = ['doc', 'ppt', 'xls'];
  } else if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) {
    family = ['mp3'];
  } else if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    family = ['png'];
  } else if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    family = ['jpg', 'jpeg'];
  }

  if (!family) return null;
  if (!family.includes(ext)) return null;
  return { ext };
};

// POST /api/upload/image
// Accepts multipart/form-data with field "image"
// Returns { url: 'https://...' }
const uploadImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const { size, buffer } = req.file;

    // Authorization: only vendors (hosts) and admins may upload — stops a guest
    // account being used as free file hosting. Admin sessions (req.admin) pass.
    if (!req.admin) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('is_host, role').eq('id', req.user?.id).maybeSingle();
      if (!prof || !(prof.is_host || prof.role === 'host')) {
        return res.status(403).json({ message: 'Only hosts can upload images.' });
      }
    }

    if (size > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: 'File size must be under 2MB' });
    }

    // Validate by CONTENT, not the (spoofable) client mimetype/extension.
    const sniffed = sniffImage(buffer);
    if (!sniffed) {
      return res.status(400).json({ message: 'File content is not a valid JPG, PNG, or WEBP image.' });
    }

    // Allowlist the destination folder so a crafted ?folder= cannot place files
    // outside the intended prefixes within the bucket.
    const folder = ALLOWED_FOLDERS.includes(req.query.folder) ? req.query.folder : 'uploads';
    const uploaderId = req.user?.id || req.admin?.id || 'admin';
    // Random suffix prevents predictable-key overwrite (upsert is on).
    const filename = `${folder}/${uploaderId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${sniffed.ext}`;

    // Upload to Supabase Storage (bucket: 'images')
    const { data, error } = await supabaseAdmin.storage
      .from('images')
      .upload(filename, buffer, {
        contentType: sniffed.mime,
        upsert: true,
      });

    if (error) {
      return safeError(res, error, 500, 'Image upload failed. Please try again.');
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(filename);

    res.json({ url: publicUrl });
  } catch (error) {
    console.error('uploadImage error:', error);
    safeError(res, error);
  }
};

// POST /api/upload/product-file
// Accepts multipart/form-data with field "file"
// Returns { url, name, size }
const uploadProductFile = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const { size, buffer, originalname } = req.file;

    // Authorization: only vendors (hosts) and admins may upload.
    if (!req.admin) {
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('is_host, role').eq('id', req.user?.id).maybeSingle();
      if (!prof || !(prof.is_host || prof.role === 'host')) {
        return res.status(403).json({ message: 'Only vendors can upload files.' });
      }
    }

    if (size > MAX_SIZE_BYTES) {
      return res.status(400).json({ message: 'File size must be under 2MB' });
    }

    const ext = String(originalname || '').toLowerCase().split('.').pop();
    if (!PRODUCT_EXT_ALLOWLIST.includes(ext)) {
      return res.status(400).json({
        message: 'File type not supported. Allowed: PDF, DOC(X), PPT(X), XLS(X), ZIP, EPUB, MP3, PNG, JPG.',
      });
    }

    // Validate by CONTENT, not the (spoofable) client extension/mimetype.
    const sniffed = sniffProductFile(buffer, ext);
    if (!sniffed) {
      return res.status(400).json({ message: 'File content is not a valid file of the declared type.' });
    }

    const hostId = req.user?.id || req.admin?.id || 'admin';
    const rand = Math.random().toString(36).slice(2, 8);
    const key = `products/${hostId}/${Date.now()}_${rand}.${sniffed.ext}`;

    // Pin the stored content-type to the sniffed type (never the spoofable
    // client mimetype) and force `attachment` so the object always downloads
    // rather than rendering inline in the browser. Defense-in-depth: the
    // magic-byte allowlist already rejects HTML/SVG, but this guarantees even a
    // future allowlisted type can't be served as an inline/active document.
    const { error } = await supabaseAdmin.storage
      .from('products')
      .upload(key, buffer, {
        upsert: true,
        contentType: sniffed.mime || 'application/octet-stream',
        contentDisposition: 'attachment',
      });

    if (error) {
      return safeError(res, error, 500, 'File upload failed. Please try again.');
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('products')
      .getPublicUrl(key);

    res.json({ url: publicUrl, name: originalname, size });
  } catch (error) {
    console.error('uploadProductFile error:', error);
    safeError(res, error);
  }
};

module.exports = { uploadImage, uploadProductFile, sniffProductFile, sniffImage };
