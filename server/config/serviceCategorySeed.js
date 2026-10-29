// server/config/serviceCategorySeed.js
//
// Source-of-truth dataset for the redesigned Service Category system.
// Each KEY is a Primary Category slug (a profession, from `categories` / v3.21).
// Each VALUE is the curated list of ACTUAL bookable services customers hire that
// profession for — ordered most-common → most-niche, Title Case.
//
// This drives the `service_categories` table seed (scripts/seedServiceCategories.js):
// a row is created per (primary_category, name) with a derived slug. The table is
// admin-editable afterwards; re-running the seed only fills gaps (idempotent upsert).
//
// To regenerate / extend: add or edit entries here, then run
//   node server/scripts/seedServiceCategories.js
//
// NOTE: the picker a host sees is driven by their profiles.primary_category, so a
// profession with no entry here simply shows an empty picker (service stays
// uncategorised — allowed).
//
// ⚠️ GST §9(5) GUARD: do NOT add services NOTIFIED under §9(5) CGST — passenger
// transport, hotel/guesthouse ACCOMMODATION (lodging), HOUSEKEEPING (plumber/
// carpenter type), restaurant/cloud-kitchen food. For those the platform is the
// DEEMED SUPPLIER (pays GST on the full value; TCS §52 doesn't apply), which breaks
// the marketplace tax model (host handles own GST; we take TDS+TCS). Today's
// catalogue is all OUTSIDE §9(5). Any such addition needs CA sign-off + deemed-
// supplier handling first. See memory: gst-9-5-classification.

const SERVICE_CATEGORY_SEED = {
  // ── Technology & Product ────────────────────────────────────────────────────
  'software-engineer': [
    { name: '1:1 Mentorship', description: 'Get matched with a working software engineer for ongoing 1:1 mentorship on skills, projects and career direction.' },
    { name: 'Code Review', description: 'Get an experienced engineer to review your code for bugs, structure and best practices before you ship it to production.' },
    { name: 'Mock Interview', description: 'Practice a realistic coding interview with a senior engineer and get direct feedback on your approach and communication.' },
    { name: 'Resume Review', description: 'Send your engineering resume to a hiring-savvy developer and get line-by-line edits that pass recruiter screens.' },
    { name: 'System Design Session', description: 'Walk through a system design problem with an engineer who has run design interviews and shipped production systems.' },
    { name: 'Career Guidance', description: 'Talk through your engineering career path with someone who has navigated the same choices around levels and specialisation.' },
    { name: 'Tech Interview Prep', description: 'Prepare for technical interviews with structured practice covering coding rounds, system design and behavioural questions.' },
    { name: 'Coding Interview Practice', description: 'Run through live coding problems with a mentor who explains the reasoning behind efficient, interview-ready solutions.' },
    { name: 'Debugging Help', description: 'Bring a stuck bug to an experienced engineer and work through the root cause together in a focused pairing session.' },
    { name: 'Project Help', description: 'Get hands-on guidance from an engineer to unblock your side project, app or class assignment when you are stuck.' },
    { name: 'Portfolio Review', description: 'Have a hiring-minded engineer review your project portfolio and suggest what to add, cut or rework before applying.' },
    { name: 'LeetCode Coaching', description: 'Sharpen your problem-solving speed with a coach who breaks down patterns behind common coding interview questions.' },
    { name: 'Architecture Review', description: 'Get a second opinion on your application architecture from an engineer who has scaled similar systems before yours.' },
    { name: 'Open Source Guidance', description: 'Learn how to find, contribute to and get pull requests merged into open source projects with a mentor who has done it.' },
    { name: 'Pair Programming', description: 'Book a live pair-programming session with an engineer to write, refactor or debug code alongside someone experienced.' },
    { name: 'Tech Stack Advice', description: 'Get an experienced engineer\'s honest opinion on which languages, frameworks and tools actually fit your project.' },
    { name: 'Job Search Strategy', description: 'Plan your engineering job search with someone who can help you target roles, companies and timing that fit your goals.' },
    { name: 'Salary Negotiation', description: 'Prepare your counter-offer with an engineer who has negotiated compensation packages and knows what moves the number.' },
    { name: 'Promotion Coaching', description: 'Work with a senior engineer on building the case, evidence and narrative for your next promotion review cycle.' },
    { name: 'Referral Guidance', description: 'Learn how to reach out for referrals the right way from an engineer who has referred candidates successfully before.' },
    { name: 'Freelancing Guidance', description: 'Get practical advice on pricing, client sourcing and contracts from an engineer who is already freelancing full time.' },
    { name: 'Side Project Review', description: 'Show your side project to an engineer and get honest feedback on code quality, scope and what to build next in it.' },
    { name: 'Take-Home Assignment Help', description: 'Review your approach to a take-home coding assignment with an engineer before you submit it to a hiring team for review.' },
    { name: 'Switching Domains Advice', description: 'Get guidance on moving between engineering domains, such as backend to ML, from someone who has made that switch.' },
  ],
  'product-manager': ['1:1 Mentorship', 'Career Guidance', 'PM Interview Prep', 'Resume Review', 'Mock Interview', 'Product Case Practice', 'Product Strategy Review', 'Roadmap Review', 'PRD Review', 'Product Sense Coaching', 'Breaking Into PM', 'Portfolio Review', 'Product Teardown', 'Metrics And Analytics Coaching', 'Stakeholder Management Advice', 'Prioritization Coaching', 'Go-To-Market Review', 'User Research Guidance', 'APM Application Help', 'Salary Negotiation', 'Promotion Coaching', 'Product Discovery Coaching', 'Technical PM Guidance', 'AI Product Guidance'],
  'ux-designer': [
    { name: 'Portfolio Review', description: 'Have a hiring-minded UX designer review your project portfolio and suggest what to add, cut or rework before you apply.' },
    { name: '1:1 Mentorship', description: 'Get matched with a working UX designer for ongoing 1:1 mentorship on craft, process and long-term career direction.' },
    { name: 'Design Critique', description: 'Bring your current work to a UX designer for a structured critique on usability, flow and visual hierarchy choices.' },
    { name: 'Career Guidance', description: 'Talk through your UX career path with a designer who has navigated the same choices around specialisation and level.' },
    { name: 'Mock Interview', description: 'Practice a realistic UX interview with a designer and get direct feedback on your answers and presentation style.' },
    { name: 'Resume Review', description: 'Send your UX resume to a hiring-savvy designer and get edits that hold up against real recruiter screens and ATS filters.' },
    { name: 'Case Study Review', description: 'Get a UX designer to review your case study for clarity, structure and whether it actually tells a convincing story.' },
    { name: 'Design Interview Prep', description: 'Prepare for UX interviews with structured practice covering portfolio walkthroughs and live whiteboard exercises.' },
    { name: 'UX Strategy Session', description: 'Work through a product\'s UX strategy with a designer who has shipped and learned from similar problems before.' },
    { name: 'Usability Review', description: 'Get a usability review of your product from a UX designer who flags the friction points users are likely to hit.' },
    { name: 'Wireframe Feedback', description: 'Share your wireframes with a UX designer and get direct feedback on layout, flow and information hierarchy choices.' },
    { name: 'Prototype Review', description: 'Walk a UX designer through your prototype and get feedback on interaction flow before you commit to building it.' },
    { name: 'Design System Guidance', description: 'Get guidance on building or scaling a design system from a designer who has set one up from scratch before now.' },
    { name: 'Breaking Into UX', description: 'Get a roadmap for breaking into UX design from a designer who can point out what actually gets people hired today.' },
    { name: 'Whiteboard Challenge Practice', description: 'Practice live whiteboard design challenges with a UX designer who runs them in real interview loops regularly.' },
    { name: 'User Research Coaching', description: 'Learn how to plan and run user research with coaching from a designer experienced in qualitative research methods.' },
    { name: 'Figma Coaching', description: 'Get hands-on Figma coaching from a UX designer to speed up your daily workflow and clean up messy component files.' },
    { name: 'Portfolio Building Help', description: 'Get help structuring your UX portfolio from scratch with a designer who knows exactly what hiring teams look for.' },
    { name: 'Design Process Guidance', description: 'Learn how an experienced UX designer structures their process, from early discovery through to final design handoff.' },
    { name: 'Switching To Product Design', description: 'Get guidance on moving into product design from a related field, from someone who has already made that exact switch.' },
    { name: 'Freelance UX Guidance', description: 'Get practical advice on pricing, client sourcing and scoping projects from a designer already freelancing full time.' },
    { name: 'Accessibility Review', description: 'Have a UX designer review your product for accessibility gaps and give you practical fixes to close each one fast.' },
    { name: 'Interaction Design Coaching', description: 'Sharpen your interaction design skills with coaching from a designer focused on motion and micro-interactions.' },
  ],
  'data-scientist': ['1:1 Mentorship', 'Career Guidance', 'Resume Review', 'Mock Interview', 'Data Science Interview Prep', 'Project Help', 'Portfolio Review', 'Code Review', 'SQL Coaching', 'Machine Learning Guidance', 'Statistics Coaching', 'Case Study Practice', 'Breaking Into Data Science', 'Kaggle Coaching', 'Capstone Project Review', 'Take-Home Assignment Help', 'Model Review', 'Python Coaching', 'Analytics Career Guidance', 'Transition To Data Science', 'PhD To Industry Guidance', 'A/B Testing Coaching', 'Data Storytelling Coaching'],
  'ai-engineer': ['1:1 Mentorship', 'Career Guidance', 'Project Help', 'Resume Review', 'Mock Interview', 'AI Interview Prep', 'LLM Application Guidance', 'Model Review', 'Code Review', 'RAG System Guidance', 'Fine-Tuning Guidance', 'ML System Design Session', 'Portfolio Review', 'Breaking Into AI', 'Prompt Engineering Coaching', 'Agent Development Guidance', 'MLOps Guidance', 'Research Paper Guidance', 'Capstone Project Review', 'Deep Learning Coaching', 'Deployment Strategy Review', 'Transition To AI Engineering'],

  // ── Coaching & Consulting ───────────────────────────────────────────────────
  'career-coach': [
    { name: 'Career Guidance Session', description: 'Sit down with a career coach to map out your next move and leave the session with a concrete, written plan of action.' },
    { name: 'Resume Review', description: 'Have a career coach go through your resume line by line and tell you exactly what is holding your applications back.' },
    { name: 'Mock Interview', description: 'Rehearse your upcoming interview with a career coach who gives honest feedback on your answers, tone and pacing.' },
    { name: 'LinkedIn Profile Review', description: 'A career coach audits your LinkedIn profile line by line and shows you exactly what to change to attract recruiters.' },
    { name: 'Job Search Strategy', description: 'Build a focused job search plan with a coach who helps you prioritise roles, channels and outreach effort each week.' },
    { name: 'Career Change Coaching', description: 'Work through the risks and steps of switching careers with a coach who has guided others through the same shift.' },
    { name: 'Interview Preparation', description: 'Prepare answers, stories and questions for your next interview with structured coaching from an experienced pro.' },
    { name: 'Salary Negotiation', description: 'Practice your negotiation conversation with a coach before you respond to an offer letter or ask for a raise at work.' },
    { name: 'Cover Letter Review', description: 'Send your cover letter to a career coach for edits that make your application stand out to busy hiring managers.' },
    { name: 'Personal Branding Coaching', description: 'Shape how you present yourself professionally online and in interviews with a coach who builds personal brands.' },
    { name: 'Career Clarity Session', description: 'Untangle what you actually want from your career with a coach trained to ask the right clarifying questions early.' },
    { name: 'Networking Strategy', description: 'Learn how to build and use a professional network effectively with hands-on guidance from an experienced career coach.' },
    { name: 'Promotion Coaching', description: 'Get coached on how to position your achievements and make a compelling case for your next promotion review cycle.' },
    { name: 'Career Roadmap Planning', description: 'Lay out a multi-year career roadmap with a coach who helps you sequence skills, roles and milestones sensibly.' },
    { name: 'Skills Gap Assessment', description: 'Find out which skills are missing for your target role through a structured assessment session with a career coach.' },
    { name: 'Confidence Coaching', description: 'Work with a coach on the mindset and self-talk that show up in interviews, meetings and job applications alike.' },
    { name: 'Return To Work Coaching', description: 'Plan your return to the workforce after a career break with a coach who understands the specific challenges involved.' },
    { name: 'Graduate Career Coaching', description: 'Get early-career coaching built specifically for recent graduates figuring out their very first real job search.' },
    { name: 'Executive Job Search', description: 'Navigate a senior-level job search with a coach experienced in executive placements and leadership hiring processes.' },
    { name: 'Career Assessment', description: 'Take a structured career assessment with a coach to identify strengths, interests and roles worth pursuing next.' },
    { name: 'Personal Statement Review', description: 'Refine your personal statement with a career coach so it reads clearly and genuinely supports your application goals.' },
    { name: 'Layoff Recovery Coaching', description: 'Get support and a practical plan from a coach who helps people regroup and re-enter the job market after a layoff.' },
  ],
  'life-coach': ['1:1 Coaching Session', 'Goal Setting Session', 'Confidence Coaching', 'Motivation Coaching', 'Work-Life Balance Coaching', 'Mindset Coaching', 'Stress Management Coaching', 'Habit Building Coaching', 'Relationship Coaching', 'Self-Discovery Session', 'Productivity Coaching', 'Accountability Coaching', 'Personal Growth Coaching', 'Clarity And Purpose Session', 'Time Management Coaching', 'Emotional Wellness Coaching', 'Overcoming Procrastination', 'Life Transition Coaching', 'Self-Esteem Coaching', 'Vision Planning Session', 'Burnout Recovery Coaching'],
  'executive-coach': ['1:1 Executive Coaching', 'Leadership Coaching', 'Communication Coaching', 'Executive Presence Coaching', 'Strategic Thinking Session', 'Decision-Making Coaching', 'Stakeholder Management Coaching', 'Performance Coaching', 'Career Transition Coaching', 'Conflict Resolution Coaching', '360 Feedback Debrief', 'Influence And Persuasion Coaching', 'Time Management Coaching', 'Confidence Coaching', 'First 90 Days Coaching', 'Board Readiness Coaching', 'Public Speaking Coaching', 'Emotional Intelligence Coaching', 'Delegation Coaching', 'Change Leadership Coaching'],
  'leadership-coach': ['1:1 Leadership Coaching', 'New Manager Coaching', 'Team Management Coaching', 'Communication Coaching', 'Conflict Resolution Coaching', 'Delegation Coaching', 'Performance Management Coaching', 'Feedback Skills Coaching', 'Emotional Intelligence Coaching', 'Decision-Making Coaching', 'Strategic Leadership Session', 'Influence And Persuasion Coaching', 'Managing Up Coaching', 'Difficult Conversations Coaching', 'Team Building Coaching', 'Change Management Coaching', 'Leadership Presence Coaching', 'First Time Leader Program', 'Remote Team Leadership', 'Motivating Teams Coaching'],
  'business-coach': ['1:1 Business Coaching', 'Business Strategy Session', 'Growth Strategy Coaching', 'Marketing Strategy Session', 'Sales Coaching', 'Pricing Strategy Session', 'Business Plan Review', 'Mindset Coaching', 'Productivity Coaching', 'Scaling Strategy Session', 'Client Acquisition Coaching', 'Solopreneur Coaching', 'Accountability Coaching', 'Cash Flow Coaching', 'Branding Strategy Session', 'Team Building Coaching', 'Operations Coaching', 'Launch Strategy Session', 'Goal Setting Session', 'Exit Strategy Coaching'],

  // ── Health & Wellness ───────────────────────────────────────────────────────
  'psychologist': [
    { name: '1:1 Therapy Session', description: 'Talk to a licensed psychologist one-on-one in a confidential session focused on what you are currently working through.' },
    { name: 'Counselling Session', description: 'Book a counselling session with a psychologist to talk through a specific issue and get professional, structured support.' },
    { name: 'Anxiety Therapy', description: 'Work with a psychologist on practical techniques to understand and manage anxiety symptoms in everyday situations.' },
    { name: 'Depression Counselling', description: 'Get ongoing support from a psychologist trained in treating depression and rebuilding your day-to-day motivation.' },
    { name: 'Stress Management Therapy', description: 'Learn practical coping strategies for chronic stress in structured, ongoing sessions with a licensed psychologist.' },
    { name: 'Couples Counselling', description: 'Bring your partner to a psychologist for couples counselling that works through communication patterns and conflict.' },
    { name: 'Relationship Counselling', description: 'Get guidance from a psychologist on navigating relationship difficulties, boundaries and communication patterns.' },
    { name: 'Cognitive Behavioral Therapy', description: 'Work through negative thought patterns with a psychologist using structured cognitive behavioral therapy techniques.' },
    { name: 'Grief Counselling', description: 'Process loss with a psychologist trained in grief counselling who can support you through the stages of mourning.' },
    { name: 'Trauma Therapy', description: 'Get trauma-informed therapy from a psychologist experienced in helping clients process difficult past events safely.' },
    { name: 'Family Counselling', description: 'Bring family members together with a psychologist to work through conflict and improve how everyone communicates.' },
    { name: 'Career Counselling', description: 'Talk to a psychologist about career-related stress, indecision or burnout that is affecting your daily wellbeing.' },
    { name: 'Self-Esteem Therapy', description: 'Work with a psychologist on building self-worth and challenging the beliefs that quietly undermine your confidence.' },
    { name: 'Anger Management Therapy', description: 'Learn to recognise and manage anger triggers with structured therapy sessions from an experienced, licensed psychologist.' },
    { name: 'Mindfulness Session', description: 'Practice mindfulness techniques guided by a psychologist to help regulate stress and stay grounded in the present.' },
    { name: 'Sleep Therapy', description: 'Address sleep difficulties with a psychologist who can identify the psychological factors disrupting your rest.' },
    { name: 'Adolescent Counselling', description: 'Book counselling for a teenager with a psychologist experienced in adolescent mental health and healthy development.' },
    { name: 'Psychological Assessment', description: 'Get a formal psychological assessment from a licensed psychologist to understand a specific concern in more depth.' },
    { name: 'Workplace Stress Counselling', description: 'Talk to a psychologist about burnout, conflict or pressure at work and build strategies to cope with it better.' },
    { name: 'OCD Therapy', description: 'Work with a psychologist trained in treating OCD using evidence-based approaches to manage intrusive thoughts.' },
    { name: 'Addiction Counselling', description: 'Get confidential counselling from a psychologist experienced in supporting recovery from addictive behaviours.' },
    { name: 'Emotional Wellness Session', description: 'Check in with a psychologist for a session focused on general emotional wellbeing rather than a specific crisis.' },
  ],
  'nutritionist': [
    { name: '1:1 Nutrition Consultation', description: 'Sit down one-on-one with a nutritionist to review your current eating habits and build a plan around your goals.' },
    { name: 'Diet Plan Consultation', description: 'Work with a nutritionist on a personalised diet plan built around your goals, daily routine and food preferences.' },
    { name: 'Weight Loss Coaching', description: 'Get ongoing guidance from a nutritionist on sustainable weight loss through food choices, portions and habits.' },
    { name: 'Weight Gain Plan', description: 'Build a structured weight gain plan with a nutritionist who accounts for your metabolism, appetite and lifestyle.' },
    { name: 'Meal Planning Session', description: 'Leave with a full week of planned meals designed by a nutritionist around your schedule and specific dietary needs.' },
    { name: 'Sports Nutrition Consultation', description: 'Fine-tune your fuelling and recovery strategy with a nutritionist who works with athletes and active clients daily.' },
    { name: 'Gut Health Consultation', description: 'Talk to a nutritionist about digestive symptoms and get a practical, food-based plan to support better gut health.' },
    { name: 'PCOS Diet Consultation', description: 'Get a diet plan tailored to PCOS from a nutritionist who understands the hormonal factors at play in your case.' },
    { name: 'Diabetes Diet Consultation', description: 'Manage blood sugar with meal guidance from a nutritionist experienced in diabetes-friendly diet planning and habits.' },
    { name: 'Clinical Nutrition Consultation', description: 'Get nutrition guidance tied to a medical condition from a nutritionist trained specifically in clinical dietary care.' },
    { name: 'Vegan Diet Consultation', description: 'Build a balanced vegan diet plan with a nutritionist who can flag nutrient gaps and how to fill them properly.' },
    { name: 'Child Nutrition Consultation', description: 'Get age-appropriate feeding guidance for your child from a nutritionist who specialises in paediatric diet planning.' },
    { name: 'Prenatal Nutrition Consultation', description: 'Plan pregnancy-safe nutrition with a nutritionist who can guide you through each trimester\'s specific dietary needs.' },
    { name: 'Cholesterol Management Plan', description: 'Lower cholesterol through diet with a structured plan built by a nutritionist around your current lab results.' },
    { name: 'Thyroid Diet Consultation', description: 'Get a diet plan adjusted for thyroid function from a nutritionist familiar with metabolic health issues and symptoms.' },
    { name: 'Eating Habit Coaching', description: 'Work with a nutritionist to identify and change the eating patterns that are not serving your long-term health goals.' },
    { name: 'Body Composition Review', description: 'Review your body composition results with a nutritionist and translate the numbers into a practical food strategy.' },
    { name: 'Detox Plan Consultation', description: 'Get a short-term detox plan designed by a nutritionist to reset habits without resorting to extreme dietary restriction.' },
    { name: 'Hormonal Health Consultation', description: 'Address hormone-related symptoms through diet with guidance from an experienced, clinically trained nutritionist.' },
    { name: 'Lifestyle Coaching', description: 'Get broader lifestyle coaching from a nutritionist covering sleep, stress and food as they affect your health.' },
    { name: 'Supplement Guidance', description: 'Get a nutritionist\'s honest opinion on which supplements are actually worth taking based on your diet and lab work.' },
  ],
  'speech-therapist': ['1:1 Speech Therapy', 'Speech Assessment', 'Stuttering Therapy', 'Articulation Therapy', 'Language Development Therapy', 'Accent Reduction Coaching', 'Voice Therapy', 'Public Speaking Coaching', 'Pronunciation Coaching', 'Child Speech Therapy', 'Apraxia Therapy', 'Stammering Therapy', 'Communication Skills Coaching', 'Swallowing Therapy', 'Autism Speech Therapy', 'Fluency Therapy', 'Aphasia Therapy', 'Lisp Correction Therapy', 'Parent Guidance Session', 'Cognitive Communication Therapy'],

  // ── Education ───────────────────────────────────────────────────────────────
  'language-tutor': [
    { name: '1:1 Language Lessons', description: 'Book one-on-one lessons with a language tutor who builds a study plan around the specific language you want to learn.' },
    { name: 'Conversation Practice', description: 'Practice speaking with a language tutor in live conversation sessions focused on fluency rather than grammar drills.' },
    { name: 'Grammar Lessons', description: 'Work through grammar rules step by step with a tutor who explains the underlying logic, not just the rules to memorise.' },
    { name: 'Pronunciation Coaching', description: 'Get targeted pronunciation coaching from a language tutor to sound clearer and more natural whenever you are speaking.' },
    { name: 'Beginner Language Course', description: 'Start from scratch with a structured beginner course taught by an experienced, patient language tutor step by step.' },
    { name: 'Business Language Coaching', description: 'Learn workplace vocabulary and etiquette in a new language with a tutor who specialises in business communication.' },
    { name: 'Vocabulary Building Session', description: 'Expand your working vocabulary in a session designed by a language tutor around words you will actually use daily.' },
    { name: 'Writing Practice', description: 'Improve your written skills in the language with a tutor who reviews and corrects your practice pieces closely.' },
    { name: 'Reading Comprehension Lessons', description: 'Build reading comprehension with a language tutor who selects texts matched carefully to your current skill level.' },
    { name: 'Exam Preparation', description: 'Prepare for a language proficiency exam with a tutor who knows the exact format and common scoring pitfalls well.' },
    { name: 'Accent Coaching', description: 'Refine how you sound in a target language with a tutor who specialises in accent reduction and intonation coaching.' },
    { name: 'Spoken Fluency Coaching', description: 'Push past hesitation and build spoken fluency with a tutor who focuses lessons on real-time speaking practice.' },
    { name: 'Interview Language Prep', description: 'Prepare for an interview in a second language with a tutor who runs mock questions and corrects your answers live.' },
    { name: 'Travel Language Lessons', description: 'Learn practical phrases and etiquette for an upcoming trip with a tutor who tailors lessons to your travel needs.' },
    { name: 'Kids Language Lessons', description: 'Book age-appropriate language lessons for your child with a tutor experienced in teaching young learners well.' },
    { name: 'Listening Practice', description: 'Train your ear with guided listening practice from a language tutor who builds sessions around real speech patterns.' },
    { name: 'Translation Help', description: 'Get a language tutor to help translate a document or passage and explain the nuances behind the original wording.' },
    { name: 'Group Conversation Class', description: 'Join a small group conversation class run by a language tutor to practice speaking alongside other motivated learners.' },
    { name: 'Proficiency Test Prep', description: 'Get focused coaching for a language proficiency test from a tutor familiar with the exact scoring criteria used.' },
    { name: 'Crash Course Lessons', description: 'Fast-track your basics with an intensive crash course taught by an experienced language tutor over a few weeks.' },
  ],
  'ielts-coach': ['IELTS Coaching Session', 'Speaking Practice', 'Writing Evaluation', 'Mock Test', 'Band Score Assessment', 'Speaking Mock Test', 'Writing Task 1 Coaching', 'Writing Task 2 Coaching', 'Reading Strategy Session', 'Listening Practice', 'Grammar Improvement Session', 'Vocabulary Coaching', 'Pronunciation Coaching', 'Crash Course', 'Academic IELTS Prep', 'General IELTS Prep', 'One-On-One Doubt Session', 'Essay Review', 'Fluency Coaching', 'Test Day Strategy Session'],
  'study-abroad-consultant': ['1:1 Counselling Session', 'University Shortlisting', 'SOP Review', 'SOP Writing Help', 'LOR Guidance', 'Application Review', 'Profile Evaluation', 'Scholarship Guidance', 'Visa Guidance', 'Country Selection Counselling', 'Course Selection Guidance', 'Resume Review', 'Admissions Strategy Session', 'Essay Review', 'Interview Preparation', 'Pre-Departure Guidance', 'Education Loan Guidance', 'Application Document Review', 'Mock Visa Interview', 'Post-Admission Support'],

  // ── Business Services ───────────────────────────────────────────────────────
  'financial-advisor': [
    { name: '1:1 Financial Consultation', description: 'Sit down one-on-one with a financial advisor to review your money situation and walk away with a clear next step.' },
    { name: 'Financial Planning Session', description: 'Build a structured financial plan with a financial advisor covering savings, investments and your upcoming life goals.' },
    { name: 'Investment Advisory', description: 'Get guidance on where to invest from a financial advisor who reviews your risk profile and time horizon first.' },
    { name: 'Retirement Planning', description: 'Work with a financial advisor to plan how much to save and where, so retirement income matches your target lifestyle.' },
    { name: 'Tax Planning Consultation', description: 'Reduce your tax liability legally with a financial advisor who reviews your income and every available deduction.' },
    { name: 'Mutual Fund Advisory', description: 'Get fund recommendations from a financial advisor based on your goals, risk appetite and investment time frame.' },
    { name: 'Portfolio Review', description: 'Have a financial advisor review your existing investment portfolio and flag gaps, risks or overdue rebalancing needs.' },
    { name: 'Insurance Planning', description: 'Work out the right mix of insurance cover with an advisor who reviews your income, dependents and current risks.' },
    { name: 'Wealth Management Consultation', description: 'Get comprehensive wealth management guidance from an advisor coordinating your investments, tax and estate goals.' },
    { name: 'Goal-Based Planning', description: 'Map specific life goals like a home or education to a savings and investment plan with an experienced financial advisor.' },
    { name: 'Budgeting Consultation', description: 'Get a practical budget built with a financial advisor around your actual income and your real spending patterns.' },
    { name: 'Debt Management Advisory', description: 'Work with a financial advisor on a plan to pay down debt faster while keeping your other financial goals on track.' },
    { name: 'Estate Planning', description: 'Plan how your assets will be managed and passed on to family with guidance from an experienced financial advisor.' },
    { name: 'SIP Planning Session', description: 'Set up a systematic investment plan with a financial advisor based on your monthly capacity and long-term goals.' },
    { name: 'Stock Market Guidance', description: 'Get grounded guidance on equity investing from a financial advisor rather than relying on social media noise alone.' },
    { name: 'NRI Financial Planning', description: 'Get financial planning tailored to NRI status, covering cross-border tax rules and available investment options.' },
    { name: 'Child Education Planning', description: 'Plan ahead for education costs with a financial advisor who builds a savings timeline around your child\'s age.' },
    { name: 'Risk Assessment Session', description: 'Understand your true risk tolerance in a session with a financial advisor before committing to any investment strategy.' },
    { name: 'Financial Health Check', description: 'Get a full review of your finances from a financial advisor, covering savings, debt, insurance and investments.' },
    { name: 'Pension Planning', description: 'Work out a pension strategy with a financial advisor so your retirement income is planned well ahead of time each year.' },
  ],
  'startup-advisor': ['1:1 Advisory Session', 'Pitch Deck Review', 'Fundraising Guidance', 'Business Model Review', 'Go-To-Market Strategy', 'Product Strategy Session', 'Investor Connect Guidance', 'Startup Idea Validation', 'Financial Model Review', 'Growth Strategy Session', 'Term Sheet Guidance', 'Founder Mentorship', 'MVP Strategy Session', 'Market Entry Strategy', 'Hiring Strategy Session', 'Scaling Strategy Session', 'Equity And Cap Table Guidance', 'Business Plan Review', 'Customer Acquisition Strategy', 'Exit Strategy Advisory'],
  'business-consultant': ['1:1 Business Consultation', 'Business Strategy Session', 'Market Research Consultation', 'Growth Strategy Consulting', 'Operations Consulting', 'Financial Analysis Session', 'Business Plan Development', 'Process Improvement Consulting', 'Marketing Strategy Consulting', 'Sales Strategy Consulting', 'Feasibility Study', 'Competitive Analysis', 'Digital Transformation Consulting', 'Pricing Strategy Consulting', 'Organizational Strategy Session', 'Risk Management Consulting', 'Turnaround Strategy Session', 'Expansion Strategy Consulting', 'SOP Development', 'Performance Improvement Consulting'],
  'hr-consultant': ['1:1 HR Consultation', 'Recruitment Strategy Consulting', 'HR Policy Development', 'Employee Engagement Consulting', 'Performance Management Consulting', 'Compensation And Benefits Consulting', 'HR Compliance Consulting', 'Talent Acquisition Strategy', 'Onboarding Process Design', 'Organizational Development Consulting', 'HR Audit', 'Employee Handbook Development', 'Workplace Culture Consulting', 'Conflict Resolution Consulting', 'HR Process Setup', 'Training And Development Consulting', 'Exit Interview Consulting', 'Diversity And Inclusion Consulting', 'Payroll Setup Guidance', 'Workforce Planning Consulting'],

  // ── Marketing & Creative ────────────────────────────────────────────────────
  'content-creator': ['Brand Partnership Content', 'Sponsored Posts', 'Instagram Reels', 'YouTube Videos', 'TikTok Videos', 'Short-Form Video Creation', 'Product Reviews', 'Unboxing Videos', 'Photo Shoots', 'Lifestyle Content', 'Travel Content', 'Vlogging', 'Live Stream Hosting', 'Event Coverage', 'Brand Ambassadorship', 'Giveaway Collaborations', 'Content Strategy', 'Channel Management', 'UGC Creation', 'Podcast Hosting', 'Tutorial Content', 'Behind-The-Scenes Content', 'Shoutouts', 'Account Takeovers', 'Affiliate Promotions'],
  'content-writer': ['Blog Writing', 'Article Writing', 'Website Copywriting', 'SEO Content Writing', 'Product Descriptions', 'Email Copywriting', 'Landing Page Copy', 'Social Media Captions', 'Ghostwriting', 'Press Release Writing', 'Newsletter Writing', 'White Paper Writing', 'Case Study Writing', 'Technical Writing', 'Script Writing', 'Ad Copywriting', 'Resume Writing', 'eBook Writing', 'Editing & Proofreading', 'Content Strategy', 'Brand Storytelling', 'Speech Writing', 'Grant Writing', 'UX Microcopy', 'Translation & Localization'],
  'digital-marketer': [
    { name: 'Digital Marketing Strategy', description: 'Get a digital marketer to build a channel strategy that matches your budget, target audience and growth targets.' },
    { name: 'Search Engine Optimization (SEO)', description: 'Improve your search rankings with an SEO specialist who audits your site and builds a plan to grow organic traffic.' },
    { name: 'Google Ads Management', description: 'Hand your Google Ads account to a marketer who sets up campaigns and optimises spend toward real, tracked conversions.' },
    { name: 'Meta Ads Management', description: 'Get a digital marketer to run and optimise your Facebook and Instagram ad campaigns from setup through to reporting.' },
    { name: 'Social Media Marketing', description: 'Work with a digital marketer to plan and run social campaigns that grow your reach and engagement over time steadily.' },
    { name: 'Performance Marketing', description: 'Hire a performance marketer who manages paid campaigns across channels with a constant focus on measurable ROI.' },
    { name: 'Content Marketing', description: 'Build a content strategy with a marketer who plans, sequences and distributes content to attract your audience.' },
    { name: 'Email Marketing', description: 'Get an email marketer to build campaigns and automations that turn your subscriber list into recurring revenue.' },
    { name: 'Lead Generation', description: 'Work with a digital marketer on a lead generation plan built around the exact channels your customers actually use.' },
    { name: 'Conversion Rate Optimization (CRO)', description: 'Improve how many visitors convert with a marketer who audits your funnel and tests specific page changes over time.' },
    { name: 'Marketing Automation', description: 'Set up automated marketing workflows with a specialist who connects your tools and removes repetitive manual busywork.' },
    { name: 'Pay-Per-Click (PPC) Management', description: 'Get a PPC specialist to manage your paid search campaigns and keep cost-per-acquisition firmly under control each month.' },
    { name: 'Analytics & Reporting', description: 'Get a digital marketer to set up tracking and build reporting that actually tells you what is working and what is not.' },
    { name: 'Marketing Consulting', description: 'Bring in a digital marketer for consulting on strategy, channel mix and where your budget is best spent right now.' },
    { name: 'Marketing Audit', description: 'Get a full audit of your current marketing efforts from a specialist who flags the gaps and quick wins worth chasing.' },
    { name: 'Funnel Building', description: 'Work with a marketer to design and build a sales funnel that moves visitors from first click to final purchase.' },
    { name: 'Affiliate Marketing', description: 'Set up an affiliate program with a digital marketer who structures commissions and recruits the right partners.' },
    { name: 'E-commerce Marketing', description: 'Grow your online store with a digital marketer who specialises in e-commerce acquisition and customer retention.' },
    { name: 'LinkedIn Ads Management', description: 'Get a specialist to run LinkedIn ad campaigns precisely targeted at the professional audience you are trying to reach.' },
    { name: 'Local SEO', description: 'Improve visibility in local search results with a marketer who optimises your listings and local citations well.' },
    { name: 'Retargeting Campaigns', description: 'Bring back lost visitors with retargeting campaigns built and actively managed by an experienced digital marketer.' },
    { name: 'Influencer Marketing', description: 'Work with a digital marketer to plan and manage influencer partnerships that fit both your brand and your budget.' },
    { name: 'WhatsApp Marketing', description: 'Set up WhatsApp campaigns with a digital marketer who handles messaging, automation and compliance on your behalf.' },
    { name: 'Growth Marketing', description: 'Hire a growth marketer to run structured experiments across channels and find out what actually moves the needle.' },
  ],
  'social-media-manager': ['Social Media Management', 'Content Calendar Creation', 'Instagram Management', 'Community Management', 'Social Media Strategy', 'Content Creation', 'Post Scheduling', 'Social Media Audit', 'LinkedIn Management', 'Facebook Page Management', 'Engagement Management', 'Hashtag Strategy', 'Social Media Analytics', 'Caption Writing', 'Reels & Shorts Creation', 'Profile Optimization', 'Influencer Outreach', 'Paid Social Campaigns', 'Twitter/X Management', 'Pinterest Management', 'Brand Voice Development', 'Crisis Management', 'Giveaway Management'],
  'brand-consultant': ['Brand Strategy', 'Brand Identity Development', 'Brand Positioning', 'Brand Audit', 'Rebranding', 'Brand Messaging', 'Brand Guidelines', 'Naming & Taglines', 'Brand Architecture', 'Visual Identity Strategy', 'Brand Workshops', 'Competitive Analysis', 'Brand Storytelling', 'Customer Persona Development', 'Go-To-Market Strategy', 'Brand Voice & Tone', 'Personal Branding', 'Logo & Design Direction', 'Market Research', 'Brand Launch Strategy', 'Brand Refresh'],
  'graphic-designer': [
    { name: 'Logo Design', description: 'Get a custom logo designed by a graphic designer who builds concepts around your brand story, values and industry.' },
    { name: 'Brand Identity Design', description: 'Work with a designer to build a complete brand identity, from colours and typography to a usable style guide document.' },
    { name: 'Social Media Graphics', description: 'Get a designer to create on-brand social media graphics that keep your whole feed looking consistent and polished.' },
    { name: 'Poster Design', description: 'Hire a graphic designer to create a poster that grabs attention and fits your event or wider marketing campaign.' },
    { name: 'Brochure Design', description: 'Get a professional brochure designed to lay out your offering clearly for either print or digital distribution.' },
    { name: 'Flyer Design', description: 'Hire a designer to put together a flyer that communicates your offer quickly and looks genuinely professional.' },
    { name: 'Business Card Design', description: 'Get a business card designed by a graphic designer that matches your brand and makes a strong first impression.' },
    { name: 'Packaging Design', description: 'Work with a designer on packaging that stands out on the shelf and clearly reflects your product\'s positioning.' },
    { name: 'Banner Design', description: 'Get a designer to create banners sized and styled correctly for web, print or an in-person event you are running.' },
    { name: 'Infographic Design', description: 'Turn your data or process into a clear, shareable infographic designed by a graphic designer for easy reading.' },
    { name: 'Presentation Design', description: 'Hand your slides to a designer who rebuilds them into a clean, consistent and genuinely professional presentation deck.' },
    { name: 'Menu Design', description: 'Get a restaurant or cafe menu designed by a graphic designer that is easy to read and stays firmly on brand always.' },
    { name: 'Book Cover Design', description: 'Work with a designer to create a book cover that fits your genre and stands out on a shelf or online storefront.' },
    { name: 'Magazine Layout', description: 'Get a graphic designer to lay out your magazine pages with consistent typography and a genuinely clean visual flow.' },
    { name: 'Illustration', description: 'Commission a custom illustration from a graphic designer for a project, product launch or personal creative piece.' },
    { name: 'Icon Design', description: 'Get a set of custom icons designed by a graphic designer that match your product or brand style down to the detail.' },
    { name: 'Letterhead Design', description: 'Have a designer create a professional letterhead template that matches your existing brand identity down to the pixel.' },
    { name: 'Label Design', description: 'Get product labels designed by a graphic designer that meet exact print specs and reflect your brand accurately.' },
    { name: 'T-Shirt Design', description: 'Hire a designer to create original t-shirt artwork that is ready for printing on merchandise or everyday apparel.' },
    { name: 'Album Art Design', description: 'Get custom album art designed by a graphic designer that matches the mood and identity of your latest music release.' },
    { name: 'Signage Design', description: 'Work with a designer on signage that is legible, on-brand and sized correctly for its intended physical space.' },
    { name: 'Print Design', description: 'Get a graphic designer to prepare any print material with the correct bleed, colour profile and file specifications.' },
    { name: 'Digital Ad Design', description: 'Hire a designer to create digital ad creatives sized and optimised for the exact platforms you are running on.' },
  ],
  'voice-artist': ['Commercial Voice Over', 'Explainer Video Voice Over', 'Audiobook Narration', 'E-Learning Narration', 'IVR & Phone Prompts', 'Character Voices', 'Animation Voice Over', 'Documentary Narration', 'Podcast Intros', 'Radio Ad Voice Over', 'TV Ad Voice Over', 'Corporate Narration', 'Dubbing', 'Voice Acting', 'Jingle Singing', 'YouTube Voice Over', 'Video Game Voices', 'Audio Description', 'Multilingual Voice Over', 'Whiteboard Video Voice Over'],
  'music-producer': ['Music Production', 'Beat Making', 'Mixing', 'Mastering', 'Song Recording', 'Songwriting', 'Vocal Tuning', 'Audio Editing', 'Custom Beats', 'Instrumental Production', 'Jingle Production', 'Film Scoring', 'Podcast Editing', 'Sound Design', 'Arrangement', 'Remixing', 'Sample Pack Creation', 'Music Composition', 'Session Musician', 'Vocal Coaching', 'Ghost Production'],

  // ── Spiritual & Wellness ────────────────────────────────────────────────────
  'astrologer': ['Birth Chart Reading', 'Horoscope Reading', 'Daily Horoscope', 'Kundli Analysis', 'Match Making', 'Career Astrology', 'Love & Relationship Astrology', 'Marriage Compatibility', 'Vedic Astrology Consultation', 'Western Astrology Reading', 'Gemstone Recommendation', 'Muhurat Selection', 'Numerology Reading', 'Palmistry', 'Remedies & Solutions', 'Financial Astrology', 'Health Astrology', 'Transit Analysis', 'Name Correction', 'Vastu Consultation', 'Nadi Astrology', 'Yearly Predictions'],
  'tarot-reader': ['Tarot Card Reading', 'Love Tarot Reading', 'Career Tarot Reading', 'Relationship Reading', 'Yes/No Reading', 'General Life Reading', 'Money & Finance Reading', 'Oracle Card Reading', 'Past Life Reading', 'Spiritual Guidance', 'Decision-Making Reading', 'Monthly Forecast', 'Yearly Forecast', 'Angel Card Reading', 'Chakra Reading', 'Energy Reading', 'Tarot Coaching', 'Distance Reading', 'Twin Flame Reading'],
  'reiki-practitioner': ['Reiki Healing', 'Distance Reiki', 'Chakra Balancing', 'Energy Healing', 'Aura Cleansing', 'Crystal Healing', 'Reiki Attunement', 'Emotional Healing', 'Stress Relief Healing', 'Reiki Training', 'Pranic Healing', 'Sound Healing', 'Meditation Sessions', 'Chakra Reading', 'Spiritual Healing', 'Pet Reiki', 'Reiki Certification', 'Karuna Reiki', 'Holistic Wellness Consultation'],

  // ── Design & Advisory ───────────────────────────────────────────────────────
  'architect': ['Architectural Design', 'Residential Design', 'Commercial Design', 'Floor Plan Design', '3D Rendering', 'Building Elevation Design', 'Construction Drawings', 'Interior Architecture', 'Renovation Design', 'Site Planning', 'Landscape Architecture', 'Structural Consultation', 'Vastu-Compliant Design', 'Sustainable Design', 'Project Management', 'Design Consultation', 'Building Permits & Approvals', 'Space Planning', 'Concept Design', 'Walkthrough Animation', 'Feasibility Study', 'BIM Modeling'],
  'interior-designer': ['Interior Design', 'Residential Interior Design', 'Commercial Interior Design', 'Space Planning', '3D Interior Rendering', 'Modular Kitchen Design', 'Living Room Design', 'Bedroom Design', 'Office Interior Design', 'Home Staging', 'Furniture Selection', 'Color Consultation', 'Lighting Design', 'Decor Styling', 'Renovation Design', 'Wardrobe Design', 'Bathroom Design', 'Turnkey Interiors', 'Mood Board Creation', 'Vastu Interior Consultation', 'Restaurant Interior Design', 'Online Design Consultation'],
  'fashion-stylist': ['Personal Styling', 'Wardrobe Consultation', 'Wardrobe Makeover', 'Event Styling', 'Bridal Styling', 'Editorial Styling', 'Photoshoot Styling', 'Celebrity Styling', 'Color Analysis', 'Body Shape Analysis', 'Personal Shopping', 'Closet Organization', 'Red Carpet Styling', 'Corporate Styling', 'Capsule Wardrobe Creation', 'Image Consulting', 'Styling for Special Occasions', 'Virtual Styling', 'Maternity Styling', "Men's Styling"],

  // ── Teaching & Skills ───────────────────────────────────────────────────────
  'music-teacher': ['Guitar Lessons', 'Piano Lessons', 'Vocal Lessons', 'Keyboard Lessons', 'Violin Lessons', 'Drum Lessons', 'Music Theory Lessons', 'Singing Lessons', 'Ukulele Lessons', 'Flute Lessons', 'Online Music Lessons', 'Beginner Music Classes', 'Kids Music Classes', 'Songwriting Lessons', 'Music Exam Preparation', 'Ear Training', 'Sight Reading Lessons', 'Bass Guitar Lessons', 'Tabla Lessons', 'Harmonium Lessons', 'Music Composition Lessons'],
  'dance-teacher': ['Dance Classes', 'Bollywood Dance', 'Contemporary Dance', 'Hip Hop Dance', 'Classical Dance', 'Salsa Classes', 'Ballet Lessons', 'Kids Dance Classes', 'Wedding Choreography', 'Zumba Classes', 'Bharatanatyam Lessons', 'Kathak Lessons', 'Freestyle Dance', 'Couple Dance Lessons', 'Online Dance Classes', 'Belly Dance', 'Jazz Dance', 'Western Dance', 'Performance Choreography', 'Beginner Dance Classes'],
  'art-teacher': ['Drawing Classes', 'Painting Classes', 'Sketching Lessons', 'Watercolor Painting', 'Acrylic Painting', 'Oil Painting', 'Kids Art Classes', 'Digital Art Lessons', 'Calligraphy Classes', 'Doodling & Zentangle', 'Portrait Drawing', 'Mandala Art Classes', 'Online Art Classes', 'Beginner Art Classes', 'Charcoal Drawing', 'Canvas Painting', 'Anime & Manga Drawing', 'Art Therapy Sessions', 'Craft Classes', 'Fabric Painting', 'Resin Art Classes'],
  'coding-instructor': ['Coding Classes', 'Python Lessons', 'Web Development Classes', 'JavaScript Tutoring', 'Kids Coding Classes', 'Java Programming Lessons', 'Data Science Tutoring', 'Machine Learning Classes', 'App Development Classes', 'C/C++ Lessons', 'HTML & CSS Classes', 'React Tutoring', 'Coding Interview Prep', 'Competitive Programming Coaching', 'SQL & Database Lessons', 'Game Development Classes', 'Online Coding Classes', 'Beginner Programming Classes', 'Full Stack Development Course', 'Scratch Programming for Kids', 'Algorithm & DSA Coaching'],
  'public-speaking-coach': ['Public Speaking Coaching', 'Presentation Skills Training', 'Stage Fear Coaching', 'Speech Writing & Delivery', 'Confidence Building', 'Pitch Coaching', 'Interview Preparation', 'Storytelling Coaching', 'Voice & Diction Training', 'Body Language Coaching', 'TEDx Talk Preparation', 'Group Discussion Coaching', 'Debate Coaching', 'Corporate Speaking Training', 'Wedding Speech Coaching', 'Anchoring & Hosting Coaching', 'Impromptu Speaking Coaching', 'Toastmasters Coaching', 'Kids Public Speaking', 'Webinar Presentation Coaching'],
  'communication-coach': ['Communication Skills Coaching', 'Spoken English Coaching', 'Business Communication Training', 'Interpersonal Skills Coaching', 'Confidence Coaching', 'Accent Training', 'Soft Skills Training', 'Interview Communication Coaching', 'Email & Writing Skills', 'Professional Etiquette Coaching', 'Conversation Skills Coaching', 'Conflict Resolution Coaching', 'Assertiveness Training', 'Leadership Communication', 'Personality Development', 'Active Listening Coaching', 'Negotiation Skills Coaching', 'Cross-Cultural Communication', 'Telephone Etiquette Training', 'Group Discussion Coaching'],

  // ── Offline Hosts ───────────────────────────────────────────────────────────
  'makeup-artist': ['Bridal Makeup', 'Party Makeup', 'Engagement Makeup', 'Reception Makeup', 'Mehndi Makeup', 'Sangeet Makeup', 'HD Makeup', 'Airbrush Makeup', 'Editorial Makeup', 'Fashion Makeup', 'Photoshoot Makeup', 'Festive Makeup', 'Cocktail Makeup', 'Saree Draping', 'Eye Makeup', 'False Lash Application', 'Makeup Lessons', 'Special Effects Makeup', 'Maternity Shoot Makeup'],
  'hair-stylist': ['Haircut', 'Hair Coloring', 'Highlights', 'Balayage', 'Hair Spa', 'Keratin Treatment', 'Hair Smoothening', 'Blow Dry', 'Bridal Hairstyling', 'Party Hairstyling', 'Hair Straightening', 'Perming', 'Hair Extensions', 'Root Touch Up', 'Hair Botox', 'Scalp Treatment', 'Updo Styling', 'Beard Styling', 'Kids Haircut'],
  'nail-artist': ['Manicure', 'Pedicure', 'Gel Nails', 'Acrylic Nails', 'Nail Extensions', 'Nail Art', 'French Manicure', 'Gel Polish', 'Nail Refill', 'Nail Repair', 'Bridal Nails', '3D Nail Art', 'Chrome Nails', 'Cuticle Care', 'Spa Manicure', 'Spa Pedicure', 'Press On Nails', 'Nail Removal'],
  'tattoo-artist': ['Custom Tattoo', 'Small Tattoo', 'Name Tattoo', 'Portrait Tattoo', 'Cover Up Tattoo', 'Tattoo Touch Up', 'Black And Grey Tattoo', 'Color Tattoo', 'Minimalist Tattoo', 'Geometric Tattoo', 'Tribal Tattoo', 'Lettering Tattoo', 'Sleeve Tattoo', 'Watercolor Tattoo', 'Realism Tattoo', 'Fine Line Tattoo', 'Temporary Tattoo', 'Tattoo Removal', 'Tattoo Design Consultation', 'Permanent Makeup'],
  'photographer': [
    { name: 'Wedding Photography', description: 'Hire a wedding photographer to capture your ceremony, candids and couple portraits -- browse portfolios and book online.' },
    { name: 'Pre-Wedding Photography', description: 'Book a pre-wedding photoshoot with a photographer who plans locations, outfits and poses around your love story.' },
    { name: 'Engagement Photography', description: 'Get an engagement photoshoot with a photographer who captures the moment in a relaxed, natural setting for you.' },
    { name: 'Event Photography', description: 'Hire a photographer to cover your event from start to finish and deliver fully edited highlights shortly afterward.' },
    { name: 'Corporate Photography', description: 'Book a photographer for headshots, office shoots or corporate events that need a polished, consistently professional look.' },
    { name: 'Product Photography', description: 'Get clean, well-lit product photography from a photographer who understands e-commerce and catalogue listing needs.' },
    { name: 'Food Photography', description: 'Hire a food photographer who styles and shoots dishes so your restaurant menu or brand photography looks appetising.' },
    { name: 'Fashion Photography', description: 'Book a fashion photographer for lookbooks, editorials or portfolio shoots with a strong, consistent visual style.' },
    { name: 'Portrait Photography', description: 'Get a portrait session with a photographer who knows how to direct poses and light for a natural, flattering result.' },
    { name: 'Family Photography', description: 'Book a family photoshoot with a photographer experienced at keeping kids relaxed and the moments genuinely candid.' },
    { name: 'Maternity Photography', description: 'Capture your pregnancy with a maternity photographer who specialises in comfortable, flattering photo sessions.' },
    { name: 'Newborn Photography', description: 'Hire a newborn photographer experienced in safe posing and soft, gentle lighting for your baby\'s very first shoot.' },
    { name: 'Real Estate Photography', description: 'Get a property shot by a photographer who knows how to light and frame every room for listings that actually sell.' },
    { name: 'Travel Photography', description: 'Book a travel photographer to document a trip or destination shoot with a genuine eye for place, light and story.' },
    { name: 'Drone Photography', description: 'Hire a photographer with drone equipment for aerial shots of venues, properties or landscapes shot from above.' },
    { name: 'Photo Editing', description: 'Send your photos to a photographer for professional editing, retouching and colour correction before you use them.' },
  ],
  'videographer': ['Wedding Videography', 'Pre-Wedding Films', 'Event Videography', 'Corporate Videos', 'Promotional Videos', 'Product Videos', 'Music Videos', 'Documentary Filming', 'Social Media Reels', 'Brand Films', 'Explainer Videos', 'Drone Videography', 'Live Event Streaming', 'Highlight Reels', 'Interview Filming', 'Real Estate Videos', 'Video Editing', 'Color Grading', 'Animation Videos'],
  'physiotherapist': ['Back Pain Therapy', 'Neck Pain Therapy', 'Sports Injury Rehab', 'Post-Surgery Rehab', 'Knee Pain Therapy', 'Posture Correction', 'Sciatica Treatment', 'Frozen Shoulder Therapy', 'Joint Mobilization', 'Manual Therapy', 'Dry Needling', 'Pediatric Physiotherapy', 'Geriatric Physiotherapy', 'Neurological Rehab', 'Pre-Natal Physiotherapy', 'Post-Natal Physiotherapy', 'Cervical Therapy', 'Gait Training', 'Home Physiotherapy'],
  'dentist': ['Dental Checkup', 'Teeth Cleaning', 'Tooth Filling', 'Tooth Extraction', 'Root Canal Treatment', 'Teeth Whitening', 'Dental Crown', 'Dental Bridge', 'Dentures', 'Dental Implants', 'Braces', 'Invisible Aligners', 'Wisdom Tooth Removal', 'Gum Treatment', 'Pediatric Dentistry', 'Smile Makeover', 'Dental Veneers', 'Cavity Treatment', 'Oral Cancer Screening'],
  'dermatologist': ['Skin Consultation', 'Acne Treatment', 'Pigmentation Treatment', 'Anti-Aging Treatment', 'Chemical Peel', 'Laser Hair Removal', 'Hair Loss Treatment', 'Skin Whitening Treatment', 'Scar Removal', 'Mole Removal', 'Wart Removal', 'Tattoo Removal', 'Botox', 'Dermal Fillers', 'Microdermabrasion', 'PRP Therapy', 'Skin Tag Removal', 'Eczema Treatment', 'Psoriasis Treatment', 'Dark Circle Treatment'],
  'doctor': ['General Consultation', 'Health Checkup', 'Fever Treatment', 'Diabetes Management', 'Blood Pressure Management', 'Vaccination', 'Online Consultation', 'Follow Up Consultation', 'Diet Consultation', 'Chronic Disease Management', 'Allergy Treatment', 'Cardiac Consultation', 'Pediatric Consultation', "Women's Health Consultation", 'Geriatric Care', 'Travel Health Consultation', 'Home Visit Consultation', 'Pre-Employment Checkup', 'Second Opinion'],
  'yoga-trainer': ['Group Yoga Class', 'Personal Yoga Session', 'Hatha Yoga', 'Vinyasa Yoga', 'Power Yoga', 'Prenatal Yoga', 'Postnatal Yoga', 'Yoga For Beginners', 'Yoga For Weight Loss', 'Yoga For Back Pain', 'Meditation Session', 'Pranayama Session', 'Kids Yoga', 'Senior Yoga', 'Online Yoga Class', 'Yoga Therapy', 'Ashtanga Yoga', 'Corporate Yoga', 'Yoga Teacher Training'],
  'fitness-coach': ['Personal Training', 'Group Fitness Class', 'Weight Loss Program', 'Strength Training', 'Muscle Building', 'Online Coaching', 'Functional Training', 'HIIT Training', 'Diet Planning', 'Body Transformation', 'Home Workout Sessions', 'Cardio Training', 'Bodyweight Training', 'Fat Loss Program', 'Posture Training', 'Sports Conditioning', 'Senior Fitness', 'Pre-Wedding Fitness', 'Boot Camp'],
  'dance-studio': ['Beginner Dance Classes', 'Bollywood Dance', 'Hip Hop Dance', 'Western Dance', 'Classical Dance', 'Contemporary Dance', 'Salsa Classes', 'Zumba Classes', 'Wedding Choreography', 'Sangeet Choreography', 'Kids Dance Classes', 'Couple Dance Classes', 'Freestyle Dance', 'Belly Dancing', 'Breakdancing', 'Jazz Dance', 'Private Dance Lessons', 'Group Dance Classes', 'Dance Workshops'],
  'music-academy': ['Guitar Classes', 'Piano Classes', 'Keyboard Classes', 'Vocal Training', 'Drums Classes', 'Violin Classes', 'Music Theory', 'Western Vocals', 'Classical Vocals', 'Ukulele Classes', 'Flute Classes', 'Tabla Classes', 'Online Music Lessons', 'Kids Music Classes', 'Group Music Classes', 'Music Production', 'Songwriting Lessons', 'Exam Preparation', 'Music Workshops'],
  'coworking-space-owner': ['Hot Desk Booking', 'Dedicated Desk', 'Private Cabin', 'Meeting Room Booking', 'Conference Room Booking', 'Day Pass', 'Virtual Office', 'Event Space Rental', 'Training Room Booking', 'Team Workspace', 'Podcast Room Booking', 'Monthly Membership', 'Workshop Space', 'Phone Booth Booking', 'Mailbox Service', 'Reception Service', 'Networking Events'],
  'event-planner': ['Birthday Party Planning', 'Corporate Event Planning', 'Anniversary Planning', 'Baby Shower Planning', 'Engagement Planning', 'Conference Planning', 'Product Launch Planning', 'Theme Party Planning', 'Cocktail Party Planning', 'Festival Event Planning', 'Concert Planning', 'Exhibition Planning', 'Award Show Planning', 'Catering Coordination', 'Decor Planning', 'Entertainment Booking', 'Venue Sourcing', 'Guest Management', 'Logistics Management'],
  'wedding-planner': ['Full Wedding Planning', 'Destination Wedding Planning', 'Wedding Day Coordination', 'Engagement Planning', 'Sangeet Planning', 'Mehndi Planning', 'Reception Planning', 'Haldi Planning', 'Wedding Decor', 'Venue Selection', 'Catering Coordination', 'Wedding Photography Coordination', 'Guest Management', 'Wedding Invitations', 'Honeymoon Planning', 'Theme Wedding Planning', 'Intimate Wedding Planning', 'Bridal Entry Planning', 'Vendor Coordination'],
  'spa-owner': ['Full Body Massage', 'Swedish Massage', 'Deep Tissue Massage', 'Aromatherapy Massage', 'Thai Massage', 'Hot Stone Massage', 'Couple Massage', 'Foot Massage', 'Head Massage', 'Body Scrub', 'Body Polishing', 'Facial', 'Body Wrap', 'Steam Bath', 'Sauna Session', 'Reflexology', 'Ayurvedic Massage', 'Detox Therapy', 'Prenatal Massage', 'Spa Day Package'],
  'salon-owner': ['Haircut', 'Hair Coloring', 'Hair Spa', 'Facial', 'Cleanup', 'Manicure', 'Pedicure', 'Waxing', 'Threading', 'Bleach', 'Bridal Package', 'Groom Package', 'Hair Straightening', 'Makeup', 'Head Massage', 'Body Polishing', 'De-Tan Treatment', 'Beard Grooming', 'Party Package', 'Hair Treatment'],
  'recording-studio-owner': ['Song Recording', 'Vocal Recording', 'Instrument Recording', 'Mixing', 'Mastering', 'Music Production', 'Voice Over Recording', 'Podcast Recording', 'Jingle Production', 'Audiobook Recording', 'Dubbing', 'Beat Making', 'Sound Design', 'Live Session Recording', 'Cover Song Recording', 'Rehearsal Space Booking', 'Album Production', 'Audio Editing', 'Studio Rental'],

  // ── Sports & Venues ─────────────────────────────────────────────────────────
  // Sports facility / arena operators renting time-slots of a court, turf, ground
  // or lane (and the coaching/membership they sell on the same facility). All
  // OUTSIDE GST §9(5) — facility rental is not accommodation/transport/food.
  // NOTE (product): today's booking flow is appointment-shaped (one calendar, flat
  // price, no advance/deposit, no per-court parallel resources). These services work
  // for a single-court arena + the coaching side; multi-court, advance-collection
  // and peak/off-peak pricing are a separate build (see GROWTH-STRATEGY.md gaps).
  'sports-arena': ['Football Turf', 'Box Cricket', 'Cricket Nets', 'Badminton Court', 'Pickleball Court', 'Tennis Court', 'Basketball Court', 'Volleyball Court', 'Futsal Court', 'Table Tennis', 'Squash Court', 'Swimming Pool Lane', 'Gaming Arena', 'Snooker & Pool Table', 'Golf Simulator', 'Skating Rink', 'Bowling Lane', 'Multipurpose Ground', 'Full Ground Rental', 'Cricket Coaching', 'Football Coaching', 'Tennis Coaching', 'Swimming Lessons', 'Monthly Membership', 'Sports Event Booking'],

  // ── Sync-back: professions added directly to the DB after this file was first
  // written (admin UI, not the seed). Mirrored here so the file matches the live
  // `categories` / `service_categories` tables (source of truth). Names are the
  // DB rows verbatim; the DB has NULL descriptions for these, so they are
  // name-only arrays like the rest of the string-form entries above. All are
  // professional/advisory services — OUTSIDE GST §9(5). (The internal
  // `office-of-book-a-sloth` category is deliberately NOT mirrored: it is BAS's
  // own office account, not a public profession.) Verified vs prod 2026-09-23.
  'advocate': ['1:1 Legal Consultation', 'Case Evaluation', 'Civil Case Advisory', 'Contract Review', 'Corporate Legal Advisory', 'Criminal Case Advisory', 'Divorce Consultation', 'Family Law Consultation', 'Legal Document Drafting', 'Legal Notice Drafting', 'Property Legal Advice', 'Startup Legal Advisory', 'Tax Law Consultation', 'Will & Estate Consultation'],
  'chartered-accountant': ['1:1 Consultation', 'Audit Advisory', 'Bookkeeping Guidance', 'Business Registration Advisory', 'CA Exam Mentorship', 'Company Incorporation Guidance', 'Financial Statement Review', 'GST Consultation', 'Income Tax Planning', 'Investment & Tax Saving', 'ROC Compliance Advisory', 'Startup Compliance Advisory', 'Tax Filing Assistance', 'TDS Consultation'],
  'business-analyst': ['1:1 Mentorship', 'Agile/Scrum Guidance', 'BA Interview Prep', 'Business Process Review', 'Career Guidance', 'Data Analysis Guidance', 'Documentation Review', 'Mock Interview', 'Portfolio Review', 'Requirement Gathering Session', 'Resume Review', 'Stakeholder Management Coaching', 'Tools Training (Jira/SQL)', 'User Story Review'],
  'qa-engineer': ['1:1 Mentorship', 'API Testing Session', 'Automation Testing Guidance', 'Career Guidance', 'Manual Testing Guidance', 'Mock Interview', 'Performance Testing Guidance', 'Portfolio Review', 'QA Interview Prep', 'Resume Review', 'Selenium/Automation Coaching', 'Test Case Review', 'Test Strategy Review', 'Tools Training (Jira/Postman)'],
  'video-editor': ['1:1 Editing Mentorship', 'Career Guidance', 'Client Project Review', 'Color Grading Session', 'Editing Software Training', 'Freelancing Guidance', 'Motion Graphics Guidance', 'Portfolio Review', 'Project Feedback', 'Short-Form/Reel Editing Session', 'Showreel Review', 'Sound & Audio Editing', 'Workflow Optimization Session', 'YouTube Video Editing Help'],
  'visual-designer': ['1:1 Design Mentorship', 'Branding & Identity Session', 'Design Career Guidance', 'Design Challenge Review', 'Design Critique', 'Design System Guidance', 'Freelancing Guidance', 'Illustration Guidance', 'Mock Interview', 'Portfolio Review', 'Project Feedback', 'Tools Training (Figma)', 'Typography Session', 'UI Design Feedback'],
  'fashion-designer': ['1:1 Design Consultation', 'Boutique Setup Advisory', 'Brand/Label Guidance', 'Collection Planning', 'Design Mentorship', 'Fabric & Material Advisory', 'Fashion Business Consultation', 'Fashion Career Guidance', 'Personal Styling Session', 'Portfolio Review', 'Sketching & Illustration Review', 'Styling for Events', 'Trend Forecasting Session', 'Wardrobe Consultation'],
  'marketing-agency': ['1:1 Strategy Consultation', 'Analytics Review', 'Branding Session', 'Campaign Planning Session', 'Competitor Analysis', 'Content Strategy Session', 'Email Marketing Consultation', 'Go-To-Market Planning', 'Lead Generation Advisory', 'Marketing Audit', 'Paid Ads Consultation', 'SEO Consultation', 'Social Media Strategy', 'Website/Funnel Review'],
  'marketing-strategist': ['1:1 Strategy Session', 'Analytics & Metrics Session', 'Brand Positioning Session', 'Campaign Strategy Review', 'Career Guidance (Marketing)', 'Channel Strategy Advisory', 'Content Strategy Session', 'Customer Persona Workshop', 'Go-To-Market Strategy', 'Growth Strategy Consultation', 'Marketing Plan Review', 'Mock Interview', 'Portfolio Review', 'Product Marketing Guidance'],
  'career-counselling': ['1:1 Career Counselling', 'Aptitude Assessment', 'Career Change Guidance', 'Career Path Guidance', 'Higher Studies Guidance', 'Interview Preparation', 'Job Search Strategy', 'LinkedIn Profile Review', 'Mock Interview', 'Personal Branding Session', 'Resume Review', 'Salary Negotiation Coaching', 'Skill Gap Assessment', 'Stream Selection Session'],
  'education-consulting': ['1:1 Education Consultation', 'Admission Strategy', 'Application Review', 'Career-After-Course Guidance', 'Course Selection Advisory', 'Education Loan Advisory', 'Interview Preparation', 'Profile Evaluation', 'Scholarship Guidance', 'SOP Review', 'Study Abroad Guidance', 'Test Prep Guidance (IELTS/GRE)', 'University Selection', 'Visa Guidance'],
  'production': ['1:1 Production Consultation', 'Ad Film Production Advisory', 'Crew & Casting Guidance', 'Equipment Advisory', 'Location Scouting Advisory', 'Music Video Planning', 'Portfolio Review', 'Post-Production Guidance', 'Pre-Production Planning', 'Production Budgeting Advisory', 'Production Career Guidance', 'Script Breakdown Session', 'Shoot Planning Session', 'Short Film Guidance'],
  'cricket-critic': ['1:1 Match Analysis', 'Batting Technique Analysis', 'Bowling Analysis', 'Career Guidance (Cricket Media)', 'Commentary Coaching', 'Cricket Statistics Session', 'Cricket Writing Session', 'Fantasy Cricket Guidance', 'Match Prediction Discussion', 'Player Performance Review', 'Podcast Guest Session', 'Strategy Breakdown', 'Team Selection Analysis', 'Youth Coaching Advice'],
};

module.exports = { SERVICE_CATEGORY_SEED };
