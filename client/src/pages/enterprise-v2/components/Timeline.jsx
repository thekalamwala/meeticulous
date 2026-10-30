import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Database,
  FileText,
  GraduationCap,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
} from 'lucide-react'

const phases = [
  {
    title: 'Discovery',
    desc: 'We understand your business, workflows, and requirements through a structured discovery process.',
    color: '#960D32',
    softColor: '#FFF0E8',
    icon: Search,
  },
  {
    title: 'Requirement Mapping',
    desc: 'Detailed mapping of departments, roles, permissions, and booking requirements across all locations.',
    color: '#6C4CF1',
    softColor: '#F0ECFF',
    icon: ClipboardList,
  },
  {
    title: 'Proposal',
    desc: 'A comprehensive implementation plan with timeline, milestones, and transparent pricing.',
    color: '#F5A623',
    softColor: '#FFF5E2',
    icon: FileText,
  },
  {
    title: 'Implementation',
    desc: 'Custom configuration, integrations, and data migration executed by our engineering team.',
    color: '#EC3F8F',
    softColor: '#FDEAF3',
    icon: Settings,
  },
  {
    title: 'Migration',
    desc: 'Seamless data import from your existing systems with validation and integrity checks.',
    color: '#13A997',
    softColor: '#E7F8F5',
    icon: Database,
  },
  {
    title: 'Testing',
    desc: 'Full regression testing, UAT with your team, and performance validation across all branches.',
    color: '#347CEF',
    softColor: '#EAF2FF',
    icon: ShieldCheck,
  },
  {
    title: 'Training',
    desc: 'On-site and virtual training sessions for all staff levels with comprehensive documentation.',
    color: '#8055EF',
    softColor: '#F1ECFF',
    icon: GraduationCap,
  },
  {
    title: 'Launch',
    desc: 'Go-live with 24/7 support during the critical launch window and ongoing optimization.',
    color: '#42A62A',
    softColor: '#EDF8E9',
    icon: Rocket,
  },
]

const pathData = `
  M 90 150

  C 165 200, 260 190, 345 145
  C 470 82, 610 58, 735 75
  C 885 92, 1035 135, 1115 205
  C 1170 260, 1170 340, 1115 395
  C 1035 468, 870 505, 720 485
  C 555 465, 430 420, 305 412

  C 220 405, 145 430, 90 478
`

export function Timeline() {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectedPhase = phases[selectedIndex]
  const SelectedIcon = selectedPhase.icon

  const openPreviousPhase = () => {
    setSelectedIndex((current) => Math.max(current - 1, 0))
  }

  const openNextPhase = () => {
    setSelectedIndex((current) =>
      Math.min(current + 1, phases.length - 1),
    )
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowRight') {
        setSelectedIndex((current) =>
          Math.min(current + 1, phases.length - 1),
        )
      }

      if (event.key === 'ArrowLeft') {
        setSelectedIndex((current) =>
          Math.max(current - 1, 0),
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <section className="timelineSection" id="timeline">
      <div className="timelineSection__container">
        <motion.div
          className="timelineSection__header"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >

          <h2 className="timelineSection__title">
            Your journey with us.
          </h2>

          <p className="timelineSection__subtitle">
            Follow our proven eight-phase enterprise implementation
            journey from the first conversation to launch.
          </p>
        </motion.div>

        <div className="timelineMap">
          <svg
            className="timelineMap__path"
            viewBox="0 0 1200 560"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <motion.path
              d={pathData}
              fill="none"
              stroke="#960D32"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              transition={{
                duration: 1.5,
                ease: 'easeInOut',
              }}
              viewport={{ once: true, amount: 0.2 }}
            />
          </svg>

          <div className="timelineMap__nodes">
            {phases.map((phase, index) => (
              <motion.button
                key={phase.title}
                type="button"
                className={`
                  timelineNode
                  timelineNode--${index + 1}
                  ${
                    selectedIndex === index
                      ? 'timelineNode--active'
                      : ''
                  }
                `}
                aria-label={`Open phase ${index + 1}: ${phase.title}`}
                aria-pressed={selectedIndex === index}
                onClick={() => setSelectedIndex(index)}
                initial={{ opacity: 0, scale: 0.78 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.38,
                  delay: 0.18 + index * 0.06,
                  type: 'spring',
                  stiffness: 180,
                  damping: 15,
                }}
                viewport={{ once: true }}
                whileTap={{ scale: 0.96 }}
              >
                <span
                  className="timelineNode__circle"
                  style={
                    {
                      '--phase-color': phase.color,
                      '--phase-soft-color': phase.softColor,
                    }
                  }
                >
                  {index + 1}
                </span>
              </motion.button>
            ))}
          </div>

          <motion.div
            key={selectedIndex}
            className="timelineCenter"
            style={
              {
                '--phase-color': selectedPhase.color,
                '--phase-soft-color': selectedPhase.softColor,
              }
            }
            initial={{
              opacity: 0,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
          >
            <svg
              className="timelineCenter__shape"
              viewBox="-18 -18 476 386"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id={`timelineCardGradient-${selectedIndex}`}
                  x1="0"
                  y1="0"
                  x2="1"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#ffffff"
                  />

                  <stop
                    offset="100%"
                    stopColor={selectedPhase.softColor}
                  />
                </linearGradient>
              </defs>

              {/* Dashed outer shape */}
              <path
                className="timelineCenter__shapeOutline"
                d="
                  M 200 8
                  C 310 6, 395 48, 430 120
                  C 458 178, 449 235, 405 280
                  C 365 322, 295 344, 208 342
                  C 98 340, 18 280, 12 186
                  C 6 90, 88 15, 200 8
                  Z
                "
              />

              {/* Main custom information shape */}
              <path
                className="timelineCenter__shapeMain"
                d="
                  M 200 8
                  C 310 6, 395 48, 430 120
                  C 458 178, 449 235, 405 280
                  C 365 322, 295 344, 208 342
                  C 98 340, 18 280, 12 186
                  C 6 90, 88 15, 200 8
                  Z
                "
                fill={`url(#timelineCardGradient-${selectedIndex})`}
              />
            </svg>

            <div className="timelineCenter__content">
              <div className="timelineCenter__icon">
                <SelectedIcon
                  size={29}
                  strokeWidth={1.8}
                />
              </div>

              <span className="timelineCenter__phase">
                Phase {selectedIndex + 1} of {phases.length}
              </span>

              <h3>{selectedPhase.title}</h3>

              <p>{selectedPhase.desc}</p>

              <div className="timelineCenter__navigation">
                <button
                  type="button"
                  onClick={openPreviousPhase}
                  disabled={selectedIndex === 0}
                  aria-label="Previous phase"
                >
                  <ArrowLeft
                    size={17}
                    strokeWidth={2}
                  />
                </button>

                <span>
                  {selectedIndex + 1} / {phases.length}
                </span>

                <button
                  type="button"
                  onClick={openNextPhase}
                  disabled={
                    selectedIndex === phases.length - 1
                  }
                  aria-label="Next phase"
                >
                  <ArrowRight
                    size={17}
                    strokeWidth={2}
                  />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}