// ─────────────────────────────────────────────────────────────────────────────
// CATALOG TYPES — one descriptor per thing a host can sell.
//
// The old Catalog was five tabs, each its own list, and the service editor was
// a three-step modal while the rest had none. That is five designs to keep in
// step and a new one every time the product learns to sell something new.
//
// Instead: every type is an entry in this file. It declares what it is called,
// how its money works, and the fields on its page. The list reads it to render
// a row; the editor reads it to render a full page. Adding a type later — a
// retainer, a workshop, a gift card — is an entry here and nothing else.
//
// `control` maps to an input in CatalogEditor; `group` decides which section of
// the page the field lands in. No type declares layout, so every item in the
// catalog is created and edited through the same page.
//
// `notice` is the honest escape hatch: a type whose backend does not exist yet
// still gets its real page, and says plainly what will not work. Better than a
// stub, which teaches nothing, and better than silence, which lies.
// ─────────────────────────────────────────────────────────────────────────────
import { BookOpen, CalendarClock, FileDown, Ticket, Users } from 'lucide-react';

const GROUPS = [
  { key: 'basics', title: 'The basics', hint: 'What it is, in the words a guest would use.' },
  { key: 'pricing', title: 'Price', hint: 'What a guest pays, and what reaches you.' },
  { key: 'page', title: 'On your booking page', hint: 'How it appears, and who can see it.' },
];

const ACTIVE = {
  key: 'active', label: 'Live on your booking page', control: 'toggle', group: 'page',
  hint: 'Turn this off to keep it but hide it from guests.',
};

const DESCRIPTION = {
  key: 'description', label: 'Describe it', control: 'textarea', group: 'basics', rows: 4,
  hint: 'Two or three sentences. What the guest walks away with.',
  ai: true,
};

export const CATALOG_TYPES = {
  service: {
    key: 'service',
    label: 'Service',
    plural: 'Services',
    icon: CalendarClock,
    blurb: 'Time on your calendar. A guest picks a slot and pays for it.',
    nameField: 'title',
    takesSlot: true,
    fields: [
      { key: 'title', label: 'What is it called?', control: 'text', group: 'basics', placeholder: 'Nutrition deep-dive', required: true },
      DESCRIPTION,
      { key: 'duration', label: 'How long?', control: 'select', group: 'basics', half: true,
        options: [15, 20, 30, 45, 60, 75, 90, 120].map((n) => ({ value: n, label: `${n} minutes` })) },
      { key: 'kind', label: 'Kind', control: 'select', group: 'basics', half: true,
        options: [
          { value: 'session', label: 'One-to-one session' },
          { value: 'group', label: 'Group session' },
          { value: 'package', label: 'Package of sessions' },
        ] },
      { key: 'price', label: 'What a guest pays', control: 'money', group: 'pricing', half: true, disabledBy: 'price_on_request' },
      { key: 'price_on_request', label: 'Price on request instead', control: 'toggle', group: 'pricing' },
      ACTIVE,
    ],
  },

  product: {
    key: 'product',
    label: 'Product',
    plural: 'Products',
    icon: FileDown,
    blurb: 'A file a guest downloads. It sells while you sleep and takes no slot.',
    nameField: 'title',
    fields: [
      { key: 'title', label: 'What is it called?', control: 'text', group: 'basics', placeholder: '7-day reset meal plan', required: true },
      DESCRIPTION,
      { key: 'file', label: 'The file', control: 'file', group: 'basics', hint: 'PDF, audio or video, up to 200 MB.' },
      { key: 'price', label: 'What a guest pays', control: 'money', group: 'pricing', half: true, hint: 'Set 0 to give it away for an email address.' },
      ACTIVE,
    ],
  },

  course: {
    key: 'course',
    label: 'Course',
    plural: 'Courses',
    icon: BookOpen,
    blurb: 'Lessons a guest works through. Teach once, sell many times.',
    nameField: 'title',
    fields: [
      { key: 'title', label: 'What is it called?', control: 'text', group: 'basics', placeholder: 'Eat for your cycle — 6 weeks', required: true },
      DESCRIPTION,
      { key: 'lessons', label: 'How many lessons?', control: 'number', group: 'basics', half: true },
      { key: 'drip', label: 'Release', control: 'select', group: 'basics', half: true,
        options: [
          { value: 'all', label: 'All at once' },
          { value: 'weekly', label: 'One a week' },
          { value: 'daily', label: 'One a day' },
        ] },
      { key: 'price', label: 'What a guest pays', control: 'money', group: 'pricing', half: true },
      ACTIVE,
    ],
  },

  membership: {
    key: 'membership',
    label: 'Membership',
    plural: 'Memberships',
    icon: Users,
    blurb: 'A monthly fee for ongoing access — the steadiest revenue a host can build.',
    nameField: 'title',
    // Recurring billing does not exist in the product yet, so a membership can
    // be written and priced but cannot charge anyone. Say so on the page rather
    // than letting a host find out after they publish one.
    notice: 'Recurring billing is not live yet, so a membership cannot charge anyone until it ships. Write it now and it is ready the day it does.',
    fields: [
      { key: 'title', label: 'What is it called?', control: 'text', group: 'basics', placeholder: 'Inner circle', required: true },
      DESCRIPTION,
      { key: 'benefits', label: 'What members get', control: 'textarea', group: 'basics', rows: 3,
        hint: 'One per line. Shown as a list on your page.' },
      { key: 'price', label: 'Price a month', control: 'money', group: 'pricing', half: true },
      { key: 'commitment', label: 'Minimum commitment', control: 'select', group: 'pricing', half: true,
        options: [
          { value: 'none', label: 'Cancel any time' },
          { value: '3m', label: '3 months' },
          { value: '6m', label: '6 months' },
        ] },
      ACTIVE,
    ],
  },

  coupon: {
    key: 'coupon',
    label: 'Offer',
    plural: 'Offers',
    icon: Ticket,
    blurb: 'A code that takes money off. For a launch, a festival, or a returning client.',
    nameField: 'code',
    noPreview: true,
    fields: [
      { key: 'code', label: 'The code', control: 'text', group: 'basics', placeholder: 'FIRST20', required: true, mono: true,
        hint: 'Guests type this at checkout. Letters and numbers, no spaces.' },
      { key: 'discount_type', label: 'Takes off', control: 'select', group: 'pricing', half: true,
        options: [
          { value: 'percent', label: 'A percentage' },
          { value: 'flat', label: 'A fixed amount' },
        ] },
      { key: 'discount_value', label: 'How much', control: 'number', group: 'pricing', half: true },
      { key: 'min_amount', label: 'Only on bookings over', control: 'money', group: 'pricing', half: true, hint: 'Leave blank for any amount.' },
      { key: 'max_redemptions', label: 'Times it can be used', control: 'number', group: 'pricing', half: true, hint: 'Leave blank for unlimited.' },
      { key: 'expires_at', label: 'Expires', control: 'date', group: 'page', half: true, hint: 'Leave blank for no expiry.' },
      { key: 'active', label: 'Code is live', control: 'toggle', group: 'page' },
    ],
  },
};

export const TYPE_LIST = Object.values(CATALOG_TYPES);

export const groupsFor = (type) =>
  GROUPS
    .map((g) => ({ ...g, fields: type.fields.filter((f) => f.group === g.key) }))
    .filter((g) => g.fields.length > 0);

/** A blank item of a given type, from its own field defaults. */
export const blankItem = (typeKey) => {
  const type = CATALOG_TYPES[typeKey];
  const item = { kind: typeKey, id: null, active: true };
  type.fields.forEach((f) => {
    if (f.control === 'toggle') item[f.key] = f.key === 'active';
    else if (f.control === 'select') item[f.key] = f.options[0].value;
    else item[f.key] = '';
  });
  return item;
};

export default CATALOG_TYPES;
