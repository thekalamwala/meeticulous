import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  ShieldCheck,
} from 'lucide-react'
import { submitEnterpriseLead } from '../../../services/api'
import { analytics, EVENTS } from '../../../services/analytics'

const initialFormData = {
  name: '',
  organizationName: '',
  website: '',
  industry: '',
  teamSize: '',
  locations: '',
  monthlyBookings: '',
  phone: '',
  businessEmail: '',
  company_hp: '', // honeypot — humans never fill it; server drops non-empty
}

// Design form field names → backend contract (see enterpriseLeadController.js).
// The design has a contact "name" the backend has no column for, so it rides
// along in `requirements` rather than being dropped.
export function toLeadPayload(f) {
  return {
    orgName: f.organizationName,
    email: f.businessEmail,
    phone: f.phone,
    website: f.website,
    industry: f.industry,
    teamSize: f.teamSize,
    locations: f.locations,
    monthlyBookings: f.monthlyBookings,
    requirements: f.name ? `Contact: ${f.name}` : '',
    company_hp: f.company_hp,
  }
}

const trustIndicators = [
  {
    icon: Clock3,
    title: 'Quick response',
    text: 'Hear from our enterprise team within four business hours.',
  },
  {
    icon: Headphones,
    title: 'Dedicated specialist',
    text: 'Speak directly with someone who understands complex workflows.',
  },
  {
    icon: ShieldCheck,
    title: 'Private enquiry',
    text: 'Your business information is handled securely and confidentially.',
  },
]

export function EnterpriseForm() {
  const [formData, setFormData] = useState(initialFormData)

  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError('')

    try {
      await submitEnterpriseLead(toLeadPayload(formData))
      setSubmitted(true)
      analytics.track(EVENTS.ENTERPRISE_LEAD_SUBMITTED)
    } catch (err) {
      setSubmitError(
        err?.response?.data?.error ||
          'Could not send your request. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData(initialFormData)
    setSubmitted(false)
    setSubmitError('')
  }

  return (
    <section className="enterpriseContactSection" id="contact">
      <div className="enterpriseContactSection__container">
        <motion.div
          className="enterpriseContactSection__intro"
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true }}
        >
          <h2 className="enterpriseContactSection__title">
            Let’s design the right setup for your organization.
          </h2>

          <p className="enterpriseContactSection__description">
            Tell us how your teams, locations, bookings, and existing
            systems work. Our enterprise team will recommend a setup
            built around your requirements.
          </p>

          <div className="enterpriseContactTrust">
            {trustIndicators.map(({ icon: Icon, title, text }) => (
              <div
                className="enterpriseContactTrust__item"
                key={title}
              >
                <div className="enterpriseContactTrust__icon">
                  <Icon size={20} strokeWidth={1.7} />
                </div>

                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="enterpriseContactSection__formColumn"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true }}
        >
          {submitted ? (
            <div
              className="enterpriseContactSuccess"
              role="status"
              aria-live="polite"
            >
              <div className="enterpriseContactSuccess__icon">
                <CheckCircle2 size={34} strokeWidth={1.8} />
              </div>

              <span className="enterpriseContactSuccess__eyebrow">
                Enquiry received
              </span>

              <h3>Thank you for reaching out.</h3>

              <p>
                An enterprise specialist will review your requirements
                and contact you within four business hours.
              </p>

              <button
                type="button"
                className="enterpriseContactSuccess__button"
                onClick={resetForm}
              >
                Submit another enquiry
              </button>
            </div>
          ) : (
            <form
              className="enterpriseForm"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="enterpriseForm__fields">
                <FormField
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your name"
                  required
                  fullWidth
                />

                <FormField
                  label="Organization name"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="Your organization"
                  required
                  fullWidth
                />

                <FormField
                  label="Website"
                  name="website"
                  type="url"
                  value={formData.website}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />

                <SelectField
                  label="Industry"
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  placeholder="Select industry"
                  options={[
                    'Healthcare',
                    'Education',
                    'Fitness',
                    'Corporate',
                    'Government',
                    'Consulting',
                    'Hospitality',
                    'Beauty',
                    'Other',
                  ]}
                  required
                />

                <SelectField
                  label="Team size"
                  name="teamSize"
                  value={formData.teamSize}
                  onChange={handleChange}
                  placeholder="Select team size"
                  options={[
                    '1–10',
                    '11–50',
                    '51–200',
                    '201–1,000',
                    '1,000+',
                  ]}
                  required
                />

                <SelectField
                  label="Number of locations"
                  name="locations"
                  value={formData.locations}
                  onChange={handleChange}
                  placeholder="Select locations"
                  options={[
                    '1–3',
                    '4–10',
                    '11–30',
                    '31–100',
                    '100+',
                  ]}
                  required
                />

                <SelectField
                  label="Estimated monthly bookings"
                  name="monthlyBookings"
                  value={formData.monthlyBookings}
                  onChange={handleChange}
                  placeholder="Select booking volume"
                  options={[
                    'Below 500',
                    '500–2,000',
                    '2,000–10,000',
                    '10,000+',
                  ]}
                  required
                  fullWidth
                />

                <FormField
                  label="Phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  required
                />

                <FormField
                  label="Business email"
                  name="businessEmail"
                  type="email"
                  value={formData.businessEmail}
                  onChange={handleChange}
                  placeholder="you@company.com"
                  required
                />
              </div>

              {/* Honeypot — off-screen for humans, left fillable for bots. */}
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  width: 1,
                  height: 1,
                  overflow: 'hidden',
                }}
              >
                <label htmlFor="company_hp">Company</label>
                <input
                  id="company_hp"
                  name="company_hp"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.company_hp}
                  onChange={handleChange}
                />
              </div>

              {submitError && (
                <p
                  role="alert"
                  style={{ color: '#DC2626', fontSize: 14, marginTop: 4 }}
                >
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                className="enterpriseForm__submit"
                disabled={isSubmitting}
              >
                <span>
                  {isSubmitting
                    ? 'Sending enquiry...'
                    : 'Request Enterprise Consultation'}
                </span>

                {!isSubmitting && (
                  <ArrowRight size={18} strokeWidth={2} />
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  fullWidth = false,
}) {
  return (
    <div
      className={`enterpriseFormField ${
        fullWidth ? 'enterpriseFormField--full' : ''
      }`}
    >
      <label htmlFor={name}>
        {label}

        {required && (
          <span aria-hidden="true">*</span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
    </div>
  )
}

function SelectField({
  label,
  name,
  value,
  onChange,
  placeholder,
  options,
  required = false,
  fullWidth = false,
}) {
  return (
    <div
      className={`enterpriseFormField ${
        fullWidth ? 'enterpriseFormField--full' : ''
      }`}
    >
      <label htmlFor={name}>
        {label}

        {required && (
          <span aria-hidden="true">*</span>
        )}
      </label>

      <div className="enterpriseFormField__select">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
        >
          <option value="" disabled>
            {placeholder}
          </option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
