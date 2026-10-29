import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section className="enterpriseHero" id="enterprise">
      <div className="enterpriseHero__glow enterpriseHero__glow--top" />
      <div className="enterpriseHero__glow enterpriseHero__glow--bottom" />

      <div className="enterpriseHero__container">
        <div className="enterpriseHero__grid">
          <motion.div
            className="enterpriseHero__content"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <h1 className="enterpriseHero__title">
              Built around your business,
              <span>not the other way around.</span>
            </h1>

            <p className="enterpriseHero__description">
              Meeticulous Enterprise helps organizations manage teams,
              locations, bookings, payments, and customer communication through
              an appointment booking platform designed around their workflow.
            </p>

            <div className="enterpriseHero__actions">
              <a
                href="#contact"
                className="enterpriseHero__button enterpriseHero__button--primary"
              >
                Talk to Enterprise Sales
                <ArrowRight size={19} />
              </a>

              <a
                href="#demo"
                className="enterpriseHero__button enterpriseHero__button--secondary"
              >
                Book a Demo
              </a>
            </div>
          </motion.div>

          <motion.div
            className="enterpriseHero__imageWrapper"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.15,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <img
              src="/enterprise-team.png"
              alt="Employees collaborating and managing enterprise operations"
              className="enterpriseHero__image"
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}