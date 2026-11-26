// Profession discovery cards. Keep destinations in sync with the /for routes.
export const CATEGORIES = [
  {
    "label": "Architects & Designers",
    "sub": "Architecture & Interior Design Studios",
    "to": "/for/architects",
    "group": "design",
    "tags": [
      "Residential",
      "Commercial",
      "Landscape"
    ],
    "image": "/images/professions/architects.webp"
  },
  {
    "label": "Lawyers & Advocates",
    "sub": "Legal & Litigation Experts",
    "to": "/for/lawyers",
    "group": "finance",
    "tags": [
      "Corporate",
      "Family Law",
      "Criminal"
    ],
    "image": "/images/professions/lawyers.webp"
  },
  {
    "label": "Chartered Accountants",
    "sub": "Tax, GST & Financial Experts",
    "to": "/for/chartered-accountants",
    "group": "finance",
    "tags": [
      "Taxation",
      "Auditing",
      "GST"
    ],
    "image": "/images/professions/chartered-accountants.webp"
  },
  {
    "label": "Sports & Turf",
    "sub": "Turf, Box Cricket & Court Owners",
    "to": "/for/sports-turf",
    "group": "sports",
    "tags": [
      "Cricket",
      "Football",
      "Coaching"
    ],
    "image": "/images/professions/sports-turf.webp"
  },
  {
    "label": "Doctors & Clinics",
    "sub": "Healthcare Professionals",
    "to": "/for/doctors",
    "group": "health",
    "tags": [
      "Consultations",
      "Primary Care",
      "Follow-ups"
    ],
    "image": "/images/professions/doctors.webp"
  },
  {
    "label": "Dentists & Clinics",
    "sub": "Dental & Orthodontic Care",
    "to": "/for/dentists",
    "group": "health",
    "tags": [
      "Dental Care",
      "Orthodontics",
      "Check-ups"
    ],
    "image": "/images/professions/dentists.webp"
  },
  {
    "label": "Business Consultants",
    "sub": "Advisors & Growth Experts",
    "to": "/for/business-consultant",
    "group": "finance",
    "tags": [
      "Strategy",
      "Growth",
      "Advisory"
    ],
    "image": "/images/professions/business-consultant.webp"
  },
  {
    "label": "Salons & Spas",
    "sub": "Beauty & Wellness",
    "to": "/for/salon",
    "group": "health",
    "tags": [
      "Hair",
      "Beauty",
      "Wellness"
    ],
    "image": "/images/professions/salon.webp"
  },
  {
    "label": "Freelancers",
    "sub": "Designers, Developers, Writers & More",
    "to": "/for/freelancers",
    "group": "design",
    "tags": [
      "Design",
      "Writing",
      "Development"
    ],
    "image": "/images/professions/freelancers.webp"
  },
  {
    "label": "Fitness Trainers & Studios",
    "sub": "Coaches & Fitness Experts",
    "to": "/for/fitness",
    "group": "sports",
    "tags": [
      "Strength",
      "Personal Training",
      "Fitness"
    ],
    "image": "/images/professions/fitness.webp"
  },
  {
    "label": "Tutors & Educators",
    "sub": "Teachers & Mentors",
    "to": "/for/tutors",
    "group": "education",
    "tags": [
      "Tutoring",
      "Mentoring",
      "Learning"
    ],
    "image": "/images/professions/tutors.webp"
  },
  {
    "label": "Photographers",
    "sub": "Photography & Videography",
    "to": "/for/photographers",
    "group": "creative",
    "tags": [
      "Portraits",
      "Weddings",
      "Commercial"
    ],
    "image": "/images/professions/photographers.webp"
  },
  {
    "label": "Event Organisers",
    "sub": "Planners & Coordinators",
    "to": "/for/events",
    "group": "creative",
    "tags": [
      "Weddings",
      "Corporate",
      "Celebrations"
    ],
    "image": "/images/professions/events.webp"
  },
  {
    "label": "Agencies & Studios",
    "sub": "Creative & Professional Teams",
    "to": "/for/agencies",
    "group": "design",
    "tags": [
      "Branding",
      "Design",
      "Strategy"
    ],
    "image": "/images/professions/agencies.webp"
  },
  {
    "label": "Coworking Spaces",
    "sub": "Desks, Cabins & Meeting Rooms",
    "to": "/for/coworking-spaces",
    "group": "creative",
    "tags": [
      "Hot Desks",
      "Cabins",
      "Meeting Rooms"
    ],
    "image": "/images/professions/coworking-spaces.webp"
  },
  {
    "label": "Driving Schools",
    "sub": "Lessons & Classes Booked Online",
    "to": "/for/driving-schools",
    "group": "education",
    "tags": [
      "Driving Lessons",
      "Practice",
      "Training"
    ],
    "image": "/images/professions/driving-schools.webp"
  },
  {
    "label": "Conference Halls",
    "sub": "Halls & Event Spaces",
    "to": "/for/conference-halls",
    "group": "creative",
    "tags": [
      "Conferences",
      "Workshops",
      "Events"
    ],
    "image": "/images/professions/conference-halls.webp"
  },
  {
    "label": "Photo Studios",
    "sub": "Shoots & Studio Rentals",
    "to": "/for/photo-studios",
    "group": "creative",
    "tags": [
      "Studio Hire",
      "Portraits",
      "Product Shoots"
    ],
    "image": "/images/professions/photo-studios.webp"
  },
  {
    "label": "Coaches & Mentors",
    "sub": "Paid Coaching Sessions",
    "to": "/for/coaches",
    "group": "education",
    "tags": [
      "Coaching",
      "Mentoring",
      "Career"
    ],
    "image": "/images/professions/coaches.webp"
  },
  {
    "label": "Content Creators",
    "sub": "Paid 1:1s & Collabs",
    "to": "/for/content-creators",
    "group": "creative",
    "tags": [
      "Consultations",
      "Collaborations",
      "Content"
    ],
    "image": "/images/professions/content-creators.webp"
  },
  {
    "label": "Educators",
    "sub": "Classes & Demo Calls",
    "to": "/for/educators",
    "group": "education",
    "tags": [
      "Classes",
      "Demo Calls",
      "Learning"
    ],
    "image": "/images/professions/educators.webp"
  },
  {
    "label": "Musicians",
    "sub": "Lessons & Gig Bookings",
    "to": "/for/musicians",
    "group": "creative",
    "tags": [
      "Lessons",
      "Sessions",
      "Gigs"
    ],
    "image": "/images/professions/musicians.webp"
  },
  {
    "label": "Language Teachers",
    "sub": "Lessons & Conversation Classes",
    "to": "/for/language-teachers",
    "group": "education",
    "tags": [
      "Languages",
      "Conversation",
      "Lessons"
    ],
    "image": "/images/professions/language-teachers.webp"
  },
  {
    "label": "Astrologers & Consultants",
    "sub": "Vedic, Tarot & Numerology",
    "to": "/for/astrologers",
    "group": "health",
    "tags": [
      "Vedic",
      "Tarot",
      "Numerology"
    ],
    "image": "/images/professions/astrologers.webp"
  },
  {
    "label": "Therapists & Psychologists",
    "sub": "Counselling & Mental Health",
    "to": "/for/therapists",
    "group": "health",
    "tags": [
      "Counselling",
      "Therapy",
      "Wellbeing"
    ],
    "image": "/images/professions/therapists.webp"
  },
  {
    "label": "Yoga Instructors",
    "sub": "Batches, Classes & Studios",
    "to": "/for/yoga-instructors",
    "group": "sports",
    "tags": [
      "Yoga",
      "Meditation",
      "Classes"
    ],
    "image": "/images/professions/yoga-instructors.webp"
  }
];
