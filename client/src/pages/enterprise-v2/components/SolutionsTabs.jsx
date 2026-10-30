import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Users,
  MessageSquare,
  CreditCard,
  Puzzle,
  ShieldCheck,
  Check,
} from 'lucide-react'

const tabs = [
  {
    id: 'scheduling',
    label: 'Scheduling',
    icon: CalendarDays,
    color: '#960D32',
    softColor: '#FFF4ED',
  },
  {
    id: 'teams',
    label: 'Teams',
    icon: Users,
    color: '#F984E5',
softColor: '#FDE7F8',
  },
  
  {
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    color: '#16A34A',
    softColor: '#ECFDF5',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: Puzzle,
    color: '#171717',
    softColor: '#F5F5F5',
  },
  {
    id: 'security',
    label: 'Security',
    icon: ShieldCheck,
    color: '#960D32',
    softColor: '#eff6ff',
  },
  {
    id: 'experience',
    label: 'Customer Experience',
    icon: MessageSquare,
    color: '#EC4899',
    softColor: '#FDF2F8',
  },
]

const tabContent = {
  scheduling: {
    title: 'Scheduling',
    description:
      'Manage calendars, resources, recurring appointments, and team availability from one place.',
    features: [
      'Multiple calendars for departments, locations, and resources',
      'Round-robin assignment and staff load balancing',
      'Equipment and room booking',
      'Recurring schedules with exception handling',
      'Buffer rules between appointments',
      'Holiday management and shift planning',
    ],
  },

  teams: {
    title: 'Teams',
    description:
      'Organize unlimited staff with roles, approval flows, attendance, and branch-level controls.',
    features: [
      'Unlimited staff across all locations',
      'Custom permissions for every role',
      'Manager and department approval chains',
      'Attendance tracking and reports',
      'Role delegation and team hierarchy',
      'Branch-level staff controls',
    ],
  },


  payments: {
    title: 'Payments',
    description:
      'Manage online and offline payments, invoicing, deposits, and subscriptions.',
    features: [
      'Razorpay integration',
      'Stripe and Cashfree support',
      'GST-compliant invoicing',
      'Offline payment recording',
      'Subscriptions and recurring billing',
      'Advance, deposit, and split payments',
    ],
  },

  integrations: {
    title: 'Integrations',
    description:
      'Connect Meeticulous with the tools your organization already uses.',
    features: [
      'Google Calendar synchronization',
      'Microsoft Outlook integration',
      'Zoom and Google Meet links',
      'WhatsApp Business API',
      'REST API and webhook access',
      'ERP and CRM connectors',
    ],
  },

  security: {
    title: 'Security',
    description:
      'Protect your organization with enterprise access controls, encryption, and auditability.',
    features: [
      'Single Sign-On',
      'Complete audit logs',
      'Role-based access permissions',
      'Encrypted data storage',
      'Automated backups',
      'Data export and compliance controls',
    ],
  },
  
  experience: {
    title: 'Customer Experience',
    description:
      'Deliver a consistent booking experience across every customer touchpoint.',
    features: [
      'White-label booking pages',
      'Custom domain and brand styling',
      'Multi-language booking experience',
      'Email and WhatsApp notifications',
      'SMS appointment reminders',
      'Invoices, receipts, and customer portal',
    ],
  },
}

export function SolutionsTabs() {
  const [activeTab, setActiveTab] = useState('scheduling')
  const content = tabContent[activeTab]
  const activeItem = tabs.find((tab) => tab.id === activeTab)
const ActiveIcon = activeItem.icon

  return (
    <section
  className="solutionsTabs"
  id="capabilities"
  style={
    {
      '--tab-color': activeItem.color,
      '--tab-soft-color': activeItem.softColor,
    }
  }
>
      <div className="solutionsTabs__container">
        <motion.div
          className="solutionsTabs__header"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >

          <h2 className="solutionsTabs__title">
            Everything your organization needs.
          </h2>
        </motion.div>

        <div
          className="solutionsTabs__navigation"
          role="tablist"
          aria-label="Enterprise capabilities"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
  key={tab.id}
  type="button"
  role="tab"
  aria-selected={isActive}
  aria-controls={`panel-${tab.id}`}
  className={`solutionsTab ${
    isActive ? 'solutionsTab--active' : ''
  }`}
  style={
    {
      '--item-color': tab.color,
      '--item-soft-color': tab.softColor,
    }
  }
  onClick={() => setActiveTab(tab.id)}
>
                <Icon size={18} strokeWidth={1.8} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            id={`panel-${activeTab}`}
            role="tabpanel"
            className="solutionsTabs__panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="solutionsTabs__panelIntro">
              <div className="solutionsTabs__panelIcon">
  <ActiveIcon size={27} strokeWidth={1.7} />
</div>

              <span className="solutionsTabs__moduleLabel">
                Enterprise module
              </span>

              <h3>{content.title}</h3>
              <p>{content.description}</p>
            </div>

            <div className="solutionsTabs__features">
              {content.features.map((feature, index) => (
                <motion.div
                  key={feature}
                  className="solutionsFeature"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <span className="solutionsFeature__check">
                    <Check size={14} strokeWidth={2.4} />
                  </span>

                  <span>{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}