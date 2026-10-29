import {
  TrendingUp, HeartPulse, Scissors, Zap, BookOpen,
  Camera, CalendarCheck, Scale, Laptop, Building2,
} from 'lucide-react';

/**
 * Industry use-case registry.
 *
 * Each entry supports:
 *   label       — display name
 *   desc        — one-line description
 *   href        — destination (can include query params)
 *   icon        — lucide-react component
 *   badge       — optional string: 'Popular' | 'New' | 'Coming Soon'
 *   featured    — boolean: highlight in a "Featured" section (future)
 *   external    — boolean: open in new tab
 *   event       — analytics event name (future)
 *   category    — category slug for filtering
 *
 * Adding a new industry only requires a new entry here.
 */
export const USE_CASES_CONFIG = [
  {
    label: 'Coaches & Consultants',
    desc: 'Book meetings and collect payments effortlessly.',
    href: '/for/business-consultant',
    icon: TrendingUp,
    category: 'coaching-consulting',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    color: '#d97706', // amber — matches /for/business-consultant page accent
  },
  {
    label: 'Doctors & Clinics',
    desc: 'Appointment scheduling with reminders.',
    href: '/for/doctors',
    icon: HeartPulse,
    category: 'health-wellness',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-500',
    color: '#10b981', // emerald — matches /for/doctors page accent
  },
  {
    label: 'Salons & Spas',
    desc: 'Manage clients, staff, and bookings.',
    href: '/for/salon',
    icon: Scissors,
    category: 'salons-spas',
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-500',
    color: '#ec4899', // pink — beauty, luxury
  },
  {
    label: 'Fitness Trainers',
    desc: 'Schedule personal and group sessions.',
    href: '/for/fitness',
    icon: Zap,
    category: 'fitness',
    badge: 'Popular',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    color: '#f97316', // orange — energy, fire
  },
  {
    label: 'Tutors & Educators',
    desc: 'Online and offline class bookings.',
    href: '/for/tutors',
    icon: BookOpen,
    category: 'education',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-500',
    color: '#6366f1', // indigo — matches /for/tutors page accent
  },
  {
    label: 'Photographers',
    desc: 'Book shoots and manage clients.',
    href: '/for/photographers',
    icon: Camera,
    category: 'photography',
    iconBg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-500',
    color: '#d946ef', // fuchsia — matches /for/photographers page accent
  },
  {
    label: 'Event Organisers',
    desc: 'Handle consultations and bookings.',
    href: '/for/events',
    icon: CalendarCheck,
    category: 'events',
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
    color: '#a855f7', // purple — matches /for/events page accent
  },
  {
    label: 'Lawyers & CAs',
    desc: 'Professional appointment scheduling.',
    href: '/for/lawyers',
    icon: Scale,
    category: 'legal-finance',
    iconBg: 'bg-amber-50',
    iconColor: 'text-[#b7892f]',
    color: '#b7892f', // legal gold — matches /for/lawyers page accent
  },
  {
    label: 'Freelancers',
    desc: 'Let clients book your availability.',
    href: '/for/freelancers',
    icon: Laptop,
    category: 'freelance',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-500',
    color: '#14b8a6', // teal — matches /for/freelancers page accent
  },
  {
    label: 'Agencies & Studios',
    desc: 'Manage discovery calls and projects.',
    href: '/for/agencies',
    icon: Building2,
    category: 'agencies',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-500',
    color: '#06b6d4', // cyan — matches /for/agencies page accent
  },
];
