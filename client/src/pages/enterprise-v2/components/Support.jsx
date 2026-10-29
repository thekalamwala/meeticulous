import { motion } from 'framer-motion'

const supportItems = [
  'Dedicated Onboarding',
  'Data Migration',
  'Implementation',
  'Training',
  'Priority Support',
  'Dedicated Account Manager',
  'Technical Consulting',
  'API Consulting',
  'Custom Development',
  'SLA Guarantee',
]

export function Support() {
  return (
    <section className="supportSection" id="support">
      <div className="supportSection__container">
        <motion.div
          className="supportSection__header"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >

          <h2 className="supportSection__title">
            Support beyond software.
          </h2>

          <p className="supportSection__subtitle">
            From onboarding and migration to consulting and priority support,
            our enterprise team stays with you at every stage.
          </p>
        </motion.div>

        <div className="supportGrid">
          {supportItems.map((item, index) => (
            <motion.article
              key={item}
              className="supportCard"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.04,
              }}
              viewport={{ once: true, amount: 0.2 }}
            >
              <h3 className="supportCard__title">
                {item}
              </h3>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}