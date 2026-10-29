import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="enterpriseCtaSection" id="demo">
      <div className="enterpriseCtaSection__container">
        <motion.div
          className="enterpriseCtaSection__content"
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="enterpriseCtaSection__title">
            Let’s build your booking
            <br />
            infrastructure.
          </h2>

          <p className="enterpriseCtaSection__subtitle">
            Tell us about your organization and we’ll get back with a scoped
            plan.
          </p>

          <div className="enterpriseCtaSection__actions">
            <a
              href="#contact"
              className="
                enterpriseCtaSection__button
                enterpriseCtaSection__button--primary
              "
            >
              <span>Talk to Enterprise Sales</span>
              <ArrowRight size={16} strokeWidth={1.8} />
            </a>

            <a
              href="#demo-booking"
              className="
                enterpriseCtaSection__button
                enterpriseCtaSection__button--secondary
              "
            >
              Book a Demo
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}