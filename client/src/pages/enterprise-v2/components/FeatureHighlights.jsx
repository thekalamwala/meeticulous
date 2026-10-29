import { motion } from 'framer-motion'
import {
  Users,
  MapPin,
  GitBranch,
  Headphones,
  Server,
  Workflow,
  Shield,
  Rocket,
} from 'lucide-react'

const features = [
  {
    icon: Users,
    title: 'Unlimited Staff',
    description:
      'Add unlimited team members across all locations with granular permissions.',
  },
  {
    icon: MapPin,
    title: 'Multiple Locations',
    description:
      'Manage branches independently or as one unified organization.',
  },
  {
    icon: GitBranch,
    title: 'Custom Integrations',
    description:
      'Connect your existing tools through our open API and webhooks.',
  },
  {
    icon: Headphones,
    title: 'Priority Support',
    description:
      'Get dedicated support from specialists who understand your organization.',
  },
  {
    icon: Server,
    title: 'Dedicated Infrastructure',
    description:
      'Run on isolated infrastructure designed for reliability and scale.',
  },
  {
    icon: Workflow,
    title: 'Custom Workflows',
    description:
      'Create booking flows that match your exact business processes.',
  },
  {
    icon: Shield,
    title: 'Role-based Access',
    description:
      'Control access with fine-grained roles and team permissions.',
  },
  {
    icon: Rocket,
    title: 'Implementation Support',
    description:
      'Get help with migration, setup, onboarding, and launch.',
  },
]

export function FeatureHighlights() {
  return (
    <section className="enterpriseFeatures" id="features">
      <div className="enterpriseFeatures__container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          viewport={{ once: true, amount: 0.3 }}
          className="enterpriseFeatures__header"
        >
          <h2 className="enterpriseFeatures__title">
            Enterprise-grade, from day one.
          </h2>

          <p className="enterpriseFeatures__subtitle">
            Everything your organization needs to manage bookings at scale,
            with full control and visibility.
          </p>
        </motion.div>

        <div className="enterpriseFeatures__grid">
          {features.map((feature, index) => {
            const Icon = feature.icon

            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.05,
                }}
                viewport={{ once: true, amount: 0.2 }}
                className="enterpriseFeatureCard"
              >
                <div className="enterpriseFeatureCard__content">
  <div className="enterpriseFeatureCard__icon">
    <Icon size={24} strokeWidth={1.7} />
  </div>

  <h3 className="enterpriseFeatureCard__title">
    {feature.title}
  </h3>
</div>

              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}