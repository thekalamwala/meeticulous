// Host dashboard sidebar icons: SVG sources here → PNGs the app serves.
// Usage: npm i sharp && node design-system/icons/dashboard/export-png.js
// Writes <name>@2x.png and <name>@3x.png (transparent) to client/public/icons/dashboard.
// Rail glyphs render at 20px, panel items at 17px (see SB in ConsoleSidebar.jsx).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = __dirname;
const out = path.resolve(dir, '../../../client/public/icons/dashboard');
fs.mkdirSync(out, { recursive: true });

const sizes = (name) => (name.startsWith('rail-') ? { '2x': 40, '3x': 60 } : { '2x': 34, '3x': 51 });

(async () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg'));
  for (const file of files) {
    const name = path.basename(file, '.svg');
    const svg = fs.readFileSync(path.join(dir, file));
    for (const [scale, px] of Object.entries(sizes(name))) {
      // Rasterise at 4x the target, then downsample — crisper hairlines.
      await sharp(svg, { density: Math.ceil((72 * px) / 24) * 4 })
        .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(path.join(out, `${name}@${scale}.png`));
    }
  }
  console.log(`Exported ${files.length * 2} PNGs to ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
