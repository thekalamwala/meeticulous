import { motion } from 'framer-motion'

const deploymentOptions = [
  {
    title: 'Cloud',
    desc: 'Managed multi-tenant cloud. Fastest to launch, maintained and scaled by us.',
  },
  {
    title: 'Dedicated Instance',
    desc: 'An isolated instance for your organization with dedicated resources.',
  },
  {
    title: 'Private Cloud',
    desc: 'Deployment inside your own cloud account for data-residency and control.',
  },
  {
    title: 'On-premise',
    desc: 'Run within your own infrastructure.',
    comingSoon: true,
  },
]

export function Deployment() {
  return (
    <section className="deploymentSection" id="deployment">
      <div className="deploymentSection__container">
        <motion.div
          className="deploymentSection__header"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="deploymentSection__title">
            Deploy the way that fits your organization.
          </h2>
        </motion.div>

        <div className="deploymentGrid">
          {deploymentOptions.map((option, index) => (
            <motion.article
              key={option.title}
              className="deploymentCard"
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.42,
                delay: index * 0.06,
              }}
              viewport={{ once: true, amount: 0.2 }}
            >

              <div className="deploymentCard__heading">
                <h3>{option.title}</h3>

                {option.comingSoon && (
                  <span className="deploymentCard__status">
                    Coming soon
                  </span>
                )}
              </div>

              <p>{option.desc}</p>

            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}