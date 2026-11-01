import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageCircle,
  UserCheck,
  X,
} from 'lucide-react'

const steps = [
  {
    icon: Calendar,
    label: 'Customer',
    desc: 'Books an appointment online or through WhatsApp.',
  },
  {
    icon: MapPin,
    label: 'Location',
    desc: 'The booking is automatically routed to the correct branch.',
  },
  {
    icon: Briefcase,
    label: 'Department',
    desc: 'The customer is matched with the right department.',
  },
  {
    icon: UserCheck,
    label: 'Staff',
    desc: 'Staff is assigned using round-robin or skill-based routing.',
  },
  {
    icon: Briefcase,
    label: 'Service',
    desc: 'Service type, duration and availability are confirmed.',
  },
  {
    icon: UserCheck,
    label: 'Approval',
    desc: 'Manager approval is requested when required.',
  },
  {
    icon: CreditCard,
    label: 'Payment',
    desc: 'Secure payment through Razorpay, Stripe or Cashfree.',
  },
  {
    icon: CheckCircle2,
    label: 'Confirmation',
    desc: 'The booking confirmation is generated automatically.',
  },
  {
    icon: MessageCircle,
    label: 'WhatsApp',
    desc: 'The customer receives booking details on WhatsApp.',
  },
  {
    icon: BarChart3,
    label: 'Reminders',
    desc: 'Automated reminders help reduce customer no-shows.',
  },
  {
    icon: BarChart3,
    label: 'Reports',
    desc: 'Booking, customer and revenue data appears in reports.',
  },
  {
    icon: UserCheck,
    label: 'CRM',
    desc: 'Customer history, notes and booking records are updated automatically.',
  },
]

export function Workflow() {
  const [activeStep, setActiveStep] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const activeItem = steps[activeStep]
  const ActiveIcon = activeItem.icon

  const openModal = () => {
    setIsModalOpen(true)
    setIsPaused(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setIsPaused(false)
  }

  const openStep = (index) => {
    setActiveStep(index)
    openModal()
  }

  const showNextStep = () => {
    setActiveStep((current) => (current + 1) % steps.length)
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeModal()
      }
    }

    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isModalOpen])

  return (
    <>
      <section className="workflowOrbit" id="workflow">
        <div className="workflowOrbit__container">
          <div className="workflowOrbit__split">
            {/* Left content */}
            <motion.div
              className="workflowOrbit__header"
              initial={{ opacity: 0, x: -32 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.65,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              viewport={{
                once: true,
                amount: 0.25,
              }}
            >

              <h2 className="workflowOrbit__title">
                From inquiry
                <br />
                to insight.
              </h2>

              <p className="workflowOrbit__subtitle">
                Every step of the customer journey is automated, tracked and
                optimized through one connected booking workflow.
              </p>

              <div className="workflowOrbit__highlights">
                <div className="workflowOrbit__highlight">
                  <span>01</span>

                  <div>
                    <strong>Automated routing</strong>

                    <p>
                      Send every booking to the correct location, department
                      and staff member.
                    </p>
                  </div>
                </div>

                <div className="workflowOrbit__highlight">
                  <span>02</span>

                  <div>
                    <strong>Connected communication</strong>

                    <p>
                      Keep customers informed through confirmations and
                      automatic WhatsApp reminders.
                    </p>
                  </div>
                </div>

                <div className="workflowOrbit__highlight">
                  <span>03</span>

                  <div>
                    <strong>Real-time insights</strong>

                    <p>
                      Track booking activity, customer history and revenue
                      through one reporting system.
                    </p>
                  </div>
                </div>
              </div>

            </motion.div>

            {/* Right circle */}
            <motion.div
              className="workflowOrbit__visual"
              initial={{ opacity: 0, x: 32 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.7,
                delay: 0.08,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              viewport={{
                once: true,
                amount: 0.2,
              }}
            >
              <div
                className={`workflowOrbit__stage ${
                  isPaused ? 'workflowOrbit__stage--paused' : ''
                }`}
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => {
                  if (!isModalOpen) {
                    setIsPaused(false)
                  }
                }}
              >
                <div className="workflowOrbit__glow" />

                <div className="workflowOrbit__outerRing" />
                <div className="workflowOrbit__middleRing" />
                <div className="workflowOrbit__innerRing" />

                <div className="workflowOrbit__rotator">
                  {steps.map((step, index) => {
                    const StepIcon = step.icon
                    const angle = (360 / steps.length) * index

                    return (
                      <div
                        className="workflowOrbit__position"
                        style={
                          {
                            '--step-angle': `${angle}deg`,
                          }
                        }
                        key={step.label}
                      >
                        <button
                          type="button"
                          className={`workflowOrbit__node ${
                            activeStep === index
                              ? 'workflowOrbit__node--active'
                              : ''
                          }`}
                          onClick={() => openStep(index)}
                          aria-label={`View ${step.label} workflow step`}
                        >
                          <span className="workflowOrbit__counterRotate">
                            <span className="workflowOrbit__nodeIcon">
                              <StepIcon size={20} strokeWidth={1.8} />
                            </span>

                            <span className="workflowOrbit__nodeLabel">
                              {step.label}
                            </span>
                          </span>
                        </button>
                      </div>
                    )
                  })}
                </div>

                <motion.button
                  type="button"
                  className="workflowOrbit__slothButton"
                  onClick={openModal}
                  aria-label="Open Meeticulous workflow details"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="workflowOrbit__slothGlow" />

                  <img
                    src="/brand/meeticulous-icon.svg"
                    alt="Meeticulous mascot"
                    className="workflowOrbit__slothImage"
                  />
                  
                </motion.button>
              </div>

              <p className="workflowOrbit__helper">
                Select a workflow step or click the sloth to see how it works.
              </p>
            </motion.div>
          </div>

          {/* Mobile workflow cards */}
          <div className="workflowOrbitMobile">
            {steps.map((step, index) => {
              const StepIcon = step.icon

              return (
                <motion.button
                  type="button"
                  className={`workflowOrbitMobile__card ${
                    activeStep === index
                      ? 'workflowOrbitMobile__card--active'
                      : ''
                  }`}
                  key={step.label}
                  onClick={() => openStep(index)}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: index * 0.04,
                  }}
                  viewport={{ once: true }}
                >
                  <span className="workflowOrbitMobile__number">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span className="workflowOrbitMobile__icon">
                    <StepIcon size={21} strokeWidth={1.7} />
                  </span>

                  <span className="workflowOrbitMobile__content">
                    <strong>{step.label}</strong>
                    <small>{step.desc}</small>
                  </span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </section>

      {/* Workflow modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="workflowModal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal()
              }
            }}
          >
            <motion.div
              className="workflowModal__card"
              initial={{
                opacity: 0,
                y: 30,
                scale: 0.94,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 20,
                scale: 0.96,
              }}
              transition={{ duration: 0.3 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="workflow-modal-title"
            >
              <button
                type="button"
                className="workflowModal__close"
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>

              <div className="workflowModal__visual">
  <div className="workflowModal__imageCircle">
    <ActiveIcon
      className="workflowModal__largeIcon"
      size={104}
      strokeWidth={1.35}
      aria-hidden="true"
    />
  </div>
</div>

              <div className="workflowModal__content">
                <span className="workflowModal__eyebrow">
                  Step {String(activeStep + 1).padStart(2, '0')} of{' '}
                  {String(steps.length).padStart(2, '0')}
                </span>

            

                <h3 id="workflow-modal-title">
                  {activeItem.label}
                </h3>

                <p>{activeItem.desc}</p>

                <div className="workflowModal__progress">
                  <span
                    style={{
                      width: `${
                        ((activeStep + 1) / steps.length) * 100
                      }%`,
                    }}
                  />
                </div>

                <button
                  type="button"
                  className="workflowModal__next"
                  onClick={showNextStep}
                >
                  Next step
                  <ArrowRight size={17} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}