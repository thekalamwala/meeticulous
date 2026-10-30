import S01Hook from './S01Hook';
import S02Problem from './S02Problem';
import S03Idea from './S03Idea';
import S04How from './S04How';
import S05Demo from './S05Demo';
import S06Sides from './S06Sides';
import S07Transform from './S07Transform';
import S08Who from './S08Who';
import S09Pricing from './S09Pricing';
import S10Start from './S10Start';

// Each slide carries a geometric background (pattern + accent), rendered by
// SlideBackground in the morph layer. Distinct pattern/accent per slide so
// advancing feels like moving through chapters. Light-only, low-contrast.
export const SLIDES = [
  { key: 'hook',      title: 'Meeticulous',   bg: { pattern: 'dots',     accent: '#960D32' },                          Component: S01Hook },
  { key: 'problem',   title: 'The Problem',    bg: { pattern: 'grid',     accent: '#269CEF' }, eyebrow: 'The problem',  Component: S02Problem },
  { key: 'idea',      title: 'The Idea',       bg: { pattern: 'rings',    accent: '#10b981' }, eyebrow: 'The idea',     Component: S03Idea },
  { key: 'how',       title: 'How It Works',   bg: { pattern: 'diagonal', accent: '#1DA1F2' }, eyebrow: 'How it works', Component: S04How },
  { key: 'demo',      title: 'Try a Booking',  bg: { pattern: 'dots',     accent: '#960D32' }, eyebrow: 'Live demo',    Component: S05Demo },
  { key: 'sides',     title: 'Two Sides',      bg: { pattern: 'grid',     accent: '#06b6d4' }, eyebrow: 'Two sides',    Component: S06Sides },
  { key: 'transform', title: 'Before & After', bg: { pattern: 'cross',    accent: '#FFB703' }, eyebrow: 'The shift',    Component: S07Transform },
  { key: 'who',       title: "Who It's For",   bg: { pattern: 'dots',     accent: '#db2777' }, eyebrow: "Who it's for", Component: S08Who },
  { key: 'pricing',   title: 'Simple Pricing', bg: { pattern: 'rings',    accent: '#10b981' }, eyebrow: 'Pricing',      Component: S09Pricing },
  { key: 'start',     title: 'Get Started',    bg: { pattern: 'diagonal', accent: '#960D32' }, eyebrow: 'Get started',  Component: S10Start },
];
