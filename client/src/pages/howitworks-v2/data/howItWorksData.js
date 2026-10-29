// Central data store for the Meeticulous "How It Works" page.
// Keeping content here makes the page easy to update without touching components.

export const processSteps = [
    {
        icon: 'create',
        title: 'Create your page',
        desc: 'Build a professional booking profile for your business.'
    },
    {
        icon: 'services',
        title: 'Add your services',
        desc: 'Set service duration, pricing, availability, and booking rules.'
    },
    {
        icon: 'share',
        title: 'Share your link',
        desc: 'Add it to WhatsApp, Instagram, Google, or your website.'
    },
    {
        icon: 'bookings',
        title: 'Receive bookings',
        desc: 'Customers book from your live availability without back-and-forth messages.'
    },
    {
        icon: 'payments',
        title: 'Get paid',
        desc: 'Collect full payments or deposits during the booking process.'
    },
    {
        icon: 'manage',
        title: 'Manage everything',
        desc: 'Track bookings, customers, payments, staff, and schedules from one dashboard.'
    }
];

export const hostJourneySteps = [
    {
        icon: 'create',
        title: 'Create your booking page',
        description: 'Sign up, choose your public booking URL, and add your business details, profile photo, cover image, description, location, and contact information.',
        checklist: ['Custom booking link', 'Business profile', 'Contact details', 'Social links'],
        videoPath: '/videos/create-profile.mp4'
    },
    {
        icon: 'services',
        title: 'Add services',
        description: 'Create services with pricing, duration, buffer time, category, meeting type, payment requirement, and cancellation rules.',
        checklist: ['One-to-one services', 'Group sessions', 'Online or offline appointments', 'Free, paid, or deposit-based bookings'],
        videoPath: '/videos/add-services.mp4'
    },
    {
        icon: 'availability',
        title: 'Set availability',
        description: 'Choose your working hours, break times, holidays, booking notice, and maximum appointments per day.',
        checklist: ['Weekly availability', 'Custom date overrides', 'Buffer between appointments', 'Calendar conflict protection'],
        videoPath: '/videos/set-availability.mp4'
    },
    {
        icon: 'share',
        title: 'Share your booking link',
        description: 'Share one booking link anywhere your customers already interact with your business.',
        checklist: ['WhatsApp', 'Instagram', 'Google Business Profile', 'Website', 'Email', 'QR code'],
        videoPath: '/videos/share-booking-link.mp4'
    },
    {
        icon: 'payments',
        title: 'Accept bookings and payments',
        description: 'Customers select their preferred service and time, provide their details, and complete payment securely.',
        checklist: ['Real-time available slots', 'Razorpay-secured payments', 'Deposit collection', 'Automatic invoices', 'Instant booking confirmation'],
        videoPath: '/videos/customer-booking.mp4'
    },
    {
        icon: 'manage',
        title: 'Manage from your dashboard',
        description: 'View upcoming appointments, customer details, payments, cancellations, reschedules, and business performance from one dashboard.',
        checklist: ['Calendar view', 'Booking management', 'Customer records', 'Payment reports', 'Automated reminders', 'Analytics'],
        videoPath: '/videos/manage-dashboard.mp4'
    }
];

export const customerJourneySteps = [
    { title: 'Open your booking link', desc: 'Customers open your shared link from WhatsApp, Instagram, Google, or your website.' },
    { title: 'Select a service', desc: 'Browse your services with clear pricing, duration, and descriptions.' },
    { title: 'Choose an available date and time', desc: 'Pick from live availability that automatically avoids double bookings.' },
    { title: 'Enter booking information', desc: 'Add their name and contact details in a quick, friction-free form.' },
    { title: 'Complete payment', desc: 'Pay securely with a deposit or full amount during booking.' },
    { title: 'Receive confirmation and reminders', desc: 'Get instant confirmation, and automatic reminders before the appointment.' }
];

export const businessCategories = [
    { icon: 'consultant', title: 'Consultants and advisors', service: 'Business consultation', desc: 'Book client strategy sessions and advisory calls without the email ping-pong.' },
    { icon: 'doctor', title: 'Doctors and clinics', service: 'Patient appointments', desc: 'Manage check-ups and follow-ups with real-time slot availability.' },
    { icon: 'salon', title: 'Salons and spas', service: 'Beauty and wellness treatments', desc: 'Take deposits on bookings so no-shows cost you nothing.' },
    { icon: 'trainer', title: 'Personal trainers', service: 'Training sessions', desc: 'Sell session packages and keep every client on schedule.' },
    { icon: 'tutor', title: 'Tutors and educators', service: 'Lessons and classes', desc: 'Offer one-to-one or group classes with automatic reminders.' },
    { icon: 'photographer', title: 'Photographers', service: 'Photo shoots', desc: 'Collect location, package, and shoot details during booking.' },
    { icon: 'lawyer', title: 'Lawyers and accountants', service: 'Client consultations', desc: 'Reserve time slots and collect retainers upfront.' },
    { icon: 'freelancer', title: 'Freelancers', service: 'Project calls', desc: 'Share one link and get paid before the call starts.' },
    { icon: 'agency', title: 'Agencies and creative teams', service: 'Creative services', desc: 'Coordinate team schedules and client-facing appointments.' },
    { icon: 'event', title: 'Event professionals', service: 'Event planning', desc: 'Handle venue tours, planning calls, and deposits in one place.' }
];

export const testimonials = [
    {
        name: 'Sandeep Rao',
        business: 'Salon owner',
        avatar: 'SR',
        rating: 5,
        quote: 'We used to lose hours every week answering "do you have a slot?" messages. Now clients book themselves and we just show up.',
        metric: '8 hours saved every week'
    },
    {
        name: 'Ananya Mehta',
        business: 'Physiotherapy clinic',
        avatar: 'AM',
        rating: 5,
        quote: 'The automatic reminders have made a huge difference. Far fewer patients forget their appointments now.',
        metric: '40% fewer missed appointments'
    },
    {
        name: 'Rahul Verma',
        business: 'Personal trainer',
        avatar: 'RV',
        rating: 5,
        quote: 'Collecting payment in advance was the game changer. Clients commit, and I no longer chase anyone for fees.',
        metric: '65% of bookings paid in advance'
    }
];

export const faqs = [
    { question: 'How long does it take to set up Meeticulous?', answer: 'Most businesses go live in under 10 minutes. Sign up, pick your booking URL, add your business details, and share your link—no technical skills required.' },
    { question: 'Do I need a website?', answer: 'No. Meeticulous gives you a professional, ready-made booking page you can share anywhere. If you do have a website, you can embed or link to your booking page too.' },
    { question: 'Can I collect payments during booking?', answer: 'Yes. You can require full payment, a deposit, or keep bookings free. Payments are processed securely, and you receive automatic invoices.' },
    { question: 'Can customers reschedule their appointments?', answer: 'Yes. Customers can reschedule or cancel from their confirmation link, subject to the cancellation rules you set for each service.' },
    { question: 'Can I manage multiple staff members?', answer: 'Absolutely. Add staff, assign them to services, and let each staff member have their own availability that syncs with your calendar.' },
    { question: 'Does it prevent double bookings?', answer: 'Yes. Real-time availability means a slot is locked the moment someone books it, so double bookings are impossible.' },
    { question: 'Can I use Meeticulous for online appointments?', answer: 'Yes. Set any service to online or offline. For online appointments, customers get your meeting link automatically after booking.' },
    { question: 'Can I customize my booking page?', answer: 'Yes. Add your logo, brand colors, cover image, bio, social links, and even your own domain for a fully branded experience.' },
    { question: 'Will customers receive reminders?', answer: 'Yes. Automated SMS and email reminders are sent before each appointment to reduce no-shows, and you can control reminder timing.' },
    { question: 'Can I use it on mobile?', answer: 'Yes. Customers get a mobile-first booking experience, and you can manage your dashboard, view bookings, and send updates from any device.' }
];

export const tutorialCategories = [
    { id: 'all', label: 'All' },
    { id: 'getting-started', label: 'Getting Started' },
    { id: 'services', label: 'Services' },
    { id: 'payments', label: 'Payments' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'team-management', label: 'Team Management' }
];

export const tutorials = [
    { id: 1, title: 'Creating your Meeticulous account', duration: '3:45', category: 'getting-started', description: 'Learn how to sign up and create your first booking page.', path: '/videos/create-account.mp4' },
    { id: 2, title: 'Setting up your public profile', duration: '4:12', category: 'getting-started', description: 'Customize your business profile and make it professional.', path: '/videos/setup-profile.mp4' },
    { id: 3, title: 'Creating your first service', duration: '5:30', category: 'services', description: 'Add services with pricing, duration, and availability.', path: '/videos/create-service.mp4' },
    { id: 4, title: 'Managing availability', duration: '6:15', category: 'services', description: 'Set up working hours, breaks, and booking slots.', path: '/videos/manage-availability.mp4' },
    { id: 5, title: 'Connecting payments', duration: '4:28', category: 'payments', description: 'Set up secure payment processing for your bookings.', path: '/videos/connect-payments.mp4' },
    { id: 6, title: 'Managing bookings', duration: '7:20', category: 'dashboard', description: 'Track, approve, and manage customer bookings.', path: '/videos/manage-bookings.mp4' },
    { id: 7, title: 'Adding staff members', duration: '5:45', category: 'team-management', description: 'Grant access to team members and set permissions.', path: '/videos/add-staff.mp4' },
    { id: 8, title: 'Using booking reports', duration: '8:10', category: 'dashboard', description: 'Analyze your business performance and insights.', path: '/videos/booking-reports.mp4' }
];

export const demoBookingServices = [
    { id: 'consultation', label: 'Business Consultation', duration: '45 min', price: '$49' },
    { id: 'training', label: 'Personal Training Session', duration: '60 min', price: '$79' },
    { id: 'photography', label: 'Photography Consultation', duration: '30 min', price: '$39' }
];
