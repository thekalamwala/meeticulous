// Profession slug → lucide icon. Per-service override comes from
// service_categories.icon (a key in SERVICE_ICONS); profession icon is the fallback.
import {
  Camera, Code, Briefcase, Salad, Brain, Megaphone, PenTool, Languages,
  Landmark, Palette, Sparkles, Video, Mic, Music, HeartPulse, GraduationCap,
} from 'lucide-react';

// NOTE: brief specified `Figma` for ux-designer, but lucide-react (installed v1.21.0)
// has no `Figma` export — substituted `Palette` (closest available design-tool icon).
export const PROFESSION_ICONS = {
  photographer: Camera,
  videographer: Video,
  'software-engineer': Code,
  'ai-engineer': Code,
  'data-scientist': Code,
  'career-coach': Briefcase,
  'business-coach': Briefcase,
  'startup-advisor': Briefcase,
  nutritionist: Salad,
  psychologist: Brain,
  'digital-marketer': Megaphone,
  'social-media-manager': Megaphone,
  'graphic-designer': PenTool,
  'ux-designer': Palette,
  'language-tutor': Languages,
  'ielts-coach': GraduationCap,
  'financial-advisor': Landmark,
  'voice-artist': Mic,
  'music-producer': Music,
  'speech-therapist': HeartPulse,
};

export const SERVICE_ICONS = {
  camera: Camera, code: Code, briefcase: Briefcase, salad: Salad, brain: Brain,
  megaphone: Megaphone, pen: PenTool, languages: Languages, bank: Landmark,
  figma: Palette, video: Video, mic: Mic, music: Music, health: HeartPulse,
  graduation: GraduationCap,
};

export const iconFor = (profession, serviceIcon) =>
  (serviceIcon && SERVICE_ICONS[serviceIcon]) || PROFESSION_ICONS[profession] || Sparkles;
