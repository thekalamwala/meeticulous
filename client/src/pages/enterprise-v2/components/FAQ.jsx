import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'

// Exported so the page's JSON-LD (seo.js → faqJsonLd) stays in sync with the
// questions actually rendered here — one source of truth for the FAQ copy.
export const faqs = [
  {
    q: 'What is an enterprise appointment booking app?',
    a: 'An enterprise appointment booking app is scheduling software built for organizations with multiple teams, locations, and workflows. Meeticulous Enterprise provides configurable calendars, role-based access, payments, and integrations as booking infrastructure for your organization.',
  },
  {
    q: 'Can we use our own domain?',
    a: 'Yes. Enterprise plans support custom domains and white-label booking pages so the experience carries your brand.',
  },
  {
    q: 'Can we use our own WhatsApp Business API?',
    a: 'Yes. You can connect your own WhatsApp Business API sender for confirmations, reminders, and updates.',
  },
  {
    q: 'Can we use our own Razorpay account?',
    a: 'Yes. Connect your own Razorpay, Stripe, or Cashfree account so payments settle directly to you.',
  },
  {
    q: 'Can staff have different permissions?',
    a: 'Yes. Permissions are role-based and configurable, with managers, department heads, and staff seeing only what they need.',
  },
  {
    q: 'Can every location have separate calendars?',
    a: 'Yes. Each location and department runs its own calendar with independent availability, staff, and services.',
  },
  {
    q: 'Can you build custom integrations?',
    a: 'Yes. We build integrations with your ERP, CRM, and internal systems using REST APIs and webhooks.',
  },
  {
    q: 'Do you offer SLAs?',
    a: 'Yes. Service-level agreements are available on enterprise plans, with priority support and a dedicated account manager.',
  },
  {
    q: 'Can we self-host?',
    a: 'Dedicated instance and private cloud deployments are available today; on-premise is on our roadmap.',
  },
  {
    q: 'Do you provide API documentation?',
    a: 'Yes. REST API documentation and webhook references are provided for your integration work.',
  },
  {
    q: 'Can we integrate our ERP?',
    a: 'Yes. ERP integration is scoped and built during implementation.',
  },
  {
    q: 'Does it support multiple languages?',
    a: 'Yes. Booking pages and communication can be configured for multiple languages.',
  },
  {
    q: 'Can we set approval workflows?',
    a: 'Yes. Bookings can route through managers or department heads before they are confirmed.',
  },
  {
    q: 'Do you support GST invoicing?',
    a: 'Yes. GST-compliant invoices and corporate invoicing are supported.',
  },
  {
    q: 'Can we book resources and equipment?',
    a: 'Yes. Resource and equipment booking prevents double-booking of rooms, devices, and shared assets.',
  },
  {
    q: 'How are reminders sent?',
    a: 'Reminders are automated over email, WhatsApp, and SMS to reduce no-shows.',
  },
  {
    q: 'Is our data secure?',
    a: 'Data is stored encrypted with audit logs, configurable permissions, backups, and data export.',
  },
  {
    q: 'How do we get started?',
    a: 'Request an enterprise consultation and our team maps your workflow, then proposes a scoped implementation plan.',
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0)

  const leftFaqs = faqs.slice(0, 9)
  const rightFaqs = faqs.slice(9)

  const toggleFAQ = (index) => {
    setOpenIndex((current) => (current === index ? null : index))
  }

  const renderFaqItem = (faq, actualIndex, animationIndex) => {
    const isOpen = openIndex === actualIndex
    const buttonId = `faq-button-${actualIndex}`
    const panelId = `faq-panel-${actualIndex}`

    return (
      <motion.article
        key={faq.q}
        className={`faqItem ${isOpen ? 'faqItem--open' : ''}`}
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.35,
          delay: animationIndex * 0.04,
        }}
        viewport={{ once: true, amount: 0.15 }}
      >
        <button
          type="button"
          id={buttonId}
          className="faqItem__button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => toggleFAQ(actualIndex)}
        >
          <span className="faqItem__number">
            {String(actualIndex + 1).padStart(2, '0')}
          </span>

          <span className="faqItem__question">{faq.q}</span>

          <span className="faqItem__toggle" aria-hidden="true">
            <Plus size={17} strokeWidth={2} />
          </span>
        </button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="faqItem__panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.3 },
                opacity: { duration: 0.2 },
              }}
            >
              <div className="faqItem__answer">
                <p>{faq.a}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    )
  }

  return (
    <section className="faqSection" id="faq">
      <div className="faqSection__container">
        <motion.div
          className="faqSection__header"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <span className="faqSection__eyebrow">
            Frequently asked questions
          </span>

          <h2 className="faqSection__title">
            Common questions, clearly answered.
          </h2>

          <p className="faqSection__subtitle">
            Everything you need to know about implementation, integrations,
            security, migration, and enterprise support.
          </p>
        </motion.div>

        <div className="faqAccordion">
          <div className="faqAccordion__column">
            {leftFaqs.map((faq, index) =>
              renderFaqItem(faq, index, index),
            )}
          </div>

          <div className="faqAccordion__column">
            {rightFaqs.map((faq, index) =>
              renderFaqItem(faq, index + 9, index),
            )}
          </div>
        </div>
      </div>
    </section>
  )
}