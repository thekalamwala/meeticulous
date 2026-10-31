// Personas → live category slugs (verified in the `categories` table).
// Shared between PersonaStep (selection) and PreviewStep (label lookup for
// the live preview badge). Keep this list in sync with what's active in the
// `categories` table — an unknown slug degrades to no label in the preview.
//
// `color` is a key into PERSONA_DOT (PageStep chip dot). `suggestions` seed the
// one-tap first-service titles on ServiceStep; `plural` reads "Popular for coaches".
// Order is curated top-first — the long tail lives behind "Explore all
// categories". All 12 slugs confirmed present in prod `categories` 2026-08-24.
import {
  Sparkles, Briefcase, Camera, Aperture, Dumbbell, GraduationCap,
  Palette, HeartHandshake, Megaphone, PenTool, Code2, Apple,
} from 'lucide-react';

export const PERSONAS = [
  { id: 'coach',        slug: 'life-coach',          label: 'Coach',        tag: 'Life · Career · Fitness',      desc: 'Help people grow, perform and reach their personal goals.', color: 'amber',   Icon: Sparkles, plural: 'coaches', suggestions: ['Discovery call', '1:1 coaching session', 'Goal-setting session'] },
  { id: 'consultant',   slug: 'business-consultant', label: 'Consultant',   tag: 'Business · Strategy · Advice', desc: 'Solve problems and drive real business impact.',            color: 'blue',    Icon: Briefcase, plural: 'consultants', suggestions: ['Strategy call', 'Business audit', 'Advisory session'] },
  { id: 'creator',      slug: 'content-creator',     label: 'Creator',      tag: 'Content · Media · Community',  desc: 'Build an audience and share what you know.',                color: 'rose',    Icon: Camera, plural: 'creators', suggestions: ['1:1 mentorship', 'Brand collab call', 'Content review'] },
  { id: 'photographer', slug: 'photographer',        label: 'Photographer', tag: 'Photo · Video · Events',       desc: 'Capture moments and tell visual stories.',                 color: 'cyan',    Icon: Aperture, plural: 'photographers', suggestions: ['Portrait shoot', 'Event shoot consult', 'Portfolio review'] },
  { id: 'trainer',      slug: 'fitness-coach',       label: 'Fitness Coach',tag: 'Fitness · Strength · Wellness',desc: 'Help clients get fitter, stronger and healthier.',          color: 'red',     Icon: Dumbbell, plural: 'fitness coaches', suggestions: ['Personal training session', 'Fitness assessment', 'Online workout plan'] },
  { id: 'tutor',        slug: 'language-tutor',      label: 'Tutor',        tag: 'Languages · Academics · Prep', desc: 'Teach and help students learn faster.',                     color: 'emerald', Icon: GraduationCap, plural: 'tutors', suggestions: ['Trial lesson', '1:1 tutoring session', 'Exam prep session'] },
  { id: 'designer',     slug: 'visual-designer',     label: 'Designer',     tag: 'Visual · Fashion · UX',        desc: 'Design beautiful experiences that people love.',            color: 'violet',  Icon: Palette, plural: 'designers', suggestions: ['Design review', 'Portfolio critique', 'Brand discovery call'] },
  { id: 'therapist',    slug: 'psychologist',        label: 'Therapist',    tag: 'Mind · Body · Wellness',       desc: 'Support healing, wellbeing and personal growth.',           color: 'teal',    Icon: HeartHandshake, plural: 'therapists', suggestions: ['Intro consultation', 'Therapy session', 'Wellness check-in'] },
  { id: 'marketer',     slug: 'digital-marketer',    label: 'Marketer',     tag: 'Digital · Social · Growth',    desc: 'Grow brands and drive real results.',                       color: 'fuchsia', Icon: Megaphone, plural: 'marketers', suggestions: ['Marketing audit', 'Growth strategy call', 'Ads review'] },
  { id: 'writer',       slug: 'content-writer',      label: 'Writer',       tag: 'Copy · Content · Editing',     desc: 'Craft words that inform, engage and sell.',                 color: 'indigo',  Icon: PenTool, plural: 'writers', suggestions: ['Copy review', 'Content strategy call', 'Editing session'] },
  { id: 'engineer',     slug: 'software-engineer',   label: 'Engineer',     tag: 'Software · Product · Data',    desc: 'Build products and solve technical challenges.',            color: 'sky',     Icon: Code2, plural: 'engineers', suggestions: ['Code review', 'Tech mentorship', 'Architecture consult'] },
  { id: 'nutritionist', slug: 'nutritionist',        label: 'Nutritionist', tag: 'Diet · Health · Wellness',     desc: 'Guide healthier eating and living.',                        color: 'lime',    Icon: Apple, plural: 'nutritionists', suggestions: ['Diet consultation', 'Meal plan session', 'Follow-up check-in'] },
];

export const personaLabelForSlug = (slug) =>
  PERSONAS.find((p) => p.slug === slug)?.label || null;

export const personaTagForSlug = (slug) =>
  PERSONAS.find((p) => p.slug === slug)?.tag || null;

// Generic one-tap titles for a category picked from the long-tail search.
export const DEFAULT_SUGGESTIONS = ['Intro call', '1:1 session', 'Follow-up session'];

export const personaForSlug = (slug) => PERSONAS.find((p) => p.slug === slug) || null;
