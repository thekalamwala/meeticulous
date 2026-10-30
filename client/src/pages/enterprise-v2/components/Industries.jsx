import { motion } from 'framer-motion'
import {
  HeartPulse,
  GraduationCap,
  Dumbbell,
  Building2,
  Landmark,
  BriefcaseBusiness,
  Hotel,
  Sparkles,
  Check,
} from 'lucide-react'

const industries = [
  {
    icon: HeartPulse,
    title: 'Healthcare',
    desc: 'Multi-department appointments, referrals, and patient communication across sites.',
    feature:
      'Department and location calendars, approval flows, and automated reminders reduce no-shows.',
    featured: true,
    color: '#E11D48',
    softColor: '#FFF1F2',
    shadowColor: 'rgba(225, 29, 72, 0.18)',
  },
  {
    icon: GraduationCap,
    title: 'Education',
    desc: 'Counselling, admissions, and faculty slots across campuses.',
    feature:
      'Round-robin assignment and per-department calendars route students to the right staff.',
    color: '#4F46E5',
    softColor: '#EEF2FF',
    shadowColor: 'rgba(79, 70, 229, 0.18)',
  },
  {
    icon: Dumbbell,
    title: 'Fitness',
    desc: 'Class schedules, trainer availability, and equipment booking across branches.',
    feature:
      'Resource and equipment booking with recurring schedules keeps every location in sync.',
    color: '#16A34A',
    softColor: '#ECFDF5',
    shadowColor: 'rgba(22, 163, 74, 0.18)',
  },
  {
    icon: Building2,
    title: 'Corporate',
    desc: 'Internal scheduling, HR interviews, and facility bookings at scale.',
    feature:
      'Role-based access and approval hierarchy match your reporting structure.',
    color: '#960D32',
    softColor: '#EFF6FF',
    shadowColor: 'rgba(37, 99, 235, 0.18)',
  },
  {
    icon: Landmark,
    title: 'Government',
    desc: 'High-volume citizen appointments with audit and compliance requirements.',
    feature:
      'Audit logs, permissions, and data export support accountability and record-keeping.',
    color: '#D97706',
    softColor: '#FFFBEB',
    shadowColor: 'rgba(217, 119, 6, 0.18)',
  },
  {
    icon: BriefcaseBusiness,
    title: 'Consulting',
    desc: 'Client sessions across consultants, time zones, and billing terms.',
    feature:
      'Advance payments, invoices, and calendar sync handle scheduling and revenue together.',
    color: '#1DA1F2',
    softColor: '#FFF1F4',
    shadowColor: 'rgba(124, 58, 237, 0.18)',
  },
  {
    icon: Hotel,
    title: 'Hospitality',
    desc: 'Bookings across properties with branded guest communication.',
    feature:
      'White-label pages, custom domains, and WhatsApp automation keep guests informed.',
    color: '#36D8FF',
    softColor: '#ECFEFF',
    shadowColor: 'rgba(8, 145, 178, 0.18)',
  },
  {
    icon: Sparkles,
    title: 'Beauty',
    desc: 'Salon and spa chains with staff, services, and buffer rules per branch.',
    feature:
      'Buffer rules, shift planning, and location calendars prevent overbooking.',
    color: '#DB2777',
    softColor: '#FDF2F8',
    shadowColor: 'rgba(219, 39, 119, 0.18)',
  },
]

export function Industries() {
  return (
    <section className="industriesSection" id="industries">
      <div className="industriesSection__container">
        <motion.div
          className="industriesSection__header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="industriesSection__title">
            Built for how your industry runs.
          </h2>
        </motion.div>

        <div className="industriesGrid">
          {industries.map((industry, index) => {
            const Icon = industry.icon

            const industryStyles = {
              '--industry-color': industry.color,
              '--industry-soft': industry.softColor,
              '--industry-shadow': industry.shadowColor,
            }

            return (
              <motion.article
                key={industry.title}
                className={`industryCard ${
                  industry.featured ? 'industryCard--featured' : ''
                }`}
                style={industryStyles}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.05,
                }}
                viewport={{ once: true, amount: 0.2 }}
              >
                <div className="industryCard__decoration" />

                <div className="industryCard__top">
                  <div className="industryCard__icon">
                    <Icon size={24} strokeWidth={1.7} />
                  </div>
                </div>

                <div className="industryCard__content">
                  <h3>{industry.title}</h3>

                  <p className="industryCard__description">
                    {industry.desc}
                  </p>

                  <div className="industryCard__divider" />

                  <div className="industryCard__feature">
                    <Check size={15} strokeWidth={2.2} />
                    <p>{industry.feature}</p>
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}