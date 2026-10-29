// Notion-style tag palette. Keys are stored in crm_tags.color.
export const TAG_PALETTE = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red', 'teal'];

// Chip = soft background + readable text (light + dark friendly via Tailwind).
const CHIP = {
  gray:   'bg-gray-100 text-gray-700 border-gray-200',
  brown:  'bg-amber-100 text-amber-800 border-amber-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  green:  'bg-green-100 text-green-700 border-green-200',
  blue:   'bg-blue-100 text-blue-700 border-blue-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  pink:   'bg-pink-100 text-pink-700 border-pink-200',
  red:    'bg-red-100 text-red-700 border-red-200',
  teal:   'bg-teal-100 text-teal-700 border-teal-200',
};

// Solid swatch (the colour dot in pickers).
const SWATCH = {
  gray: 'bg-gray-400', brown: 'bg-amber-700', orange: 'bg-orange-500', yellow: 'bg-yellow-400',
  green: 'bg-green-500', blue: 'bg-blue-500', purple: 'bg-purple-500', pink: 'bg-pink-500',
  red: 'bg-red-500', teal: 'bg-teal-500',
};

export const chipClass = (color) => CHIP[color] || CHIP.gray;
export const swatchClass = (color) => SWATCH[color] || SWATCH.gray;

// Build a name→color lookup from a crm_tags list.
export const colorMap = (tags) => Object.fromEntries((tags || []).map((t) => [t.name, t.color]));
