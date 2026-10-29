import { motion } from 'framer-motion'

import calendarLogo from '../assets/logo/calendar.svg'
import meetLogo from '../assets/logo/meet.svg'
import zoomLogo from '../assets/logo/zoom.svg'
import outlookLogo from '../assets/logo/outlook.svg'
import whatsappLogo from '../assets/logo/wpbusiness.svg'
import stripeLogo from '../assets/logo/stripe.svg'
import razorpayLogo from '../assets/logo/razorpay.png'
import cashfreeLogo from '../assets/logo/cashfree.ico'
import restApiLogo from '../assets/logo/rest-api.svg'
import webhookLogo from '../assets/logo/webhook.svg'

const integrations = [
  {
    name: 'Google Calendar',
    logo: calendarLogo,
  },
  {
    name: 'Google Meet',
    logo: meetLogo,
  },
  {
    name: 'Zoom',
    logo: zoomLogo,
  },
  {
    name: 'Microsoft Outlook',
    logo: outlookLogo,
  },
  {
    name: 'WhatsApp Business API',
    logo: whatsappLogo,
  },
  {
    name: 'Stripe',
    logo: stripeLogo,
  },
  {
    name: 'Razorpay',
    logo: razorpayLogo,
  },
  {
    name: 'Cashfree',
    logo: cashfreeLogo,
  },
  {
    name: 'REST API',
    logo: restApiLogo,
  },
  {
    name: 'Webhooks',
    logo: webhookLogo,
  },
]

export function Integrations() {
  return (
    <section className="integrationsSection" id="integrations">
      <div className="integrationsSection__container">
        <motion.div
          className="integrationsSection__header"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <h2 className="integrationsSection__title">
            Works with everything you use.
          </h2>
        </motion.div>

        <div className="integrationsGrid">
          {integrations.map((integration, index) => {
            return (
              <motion.article
                key={integration.name}
                className="integrationCard"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.35,
                  delay: index * 0.04,
                }}
                viewport={{ once: true }}
              >
                <div className="integrationCard__logoWrapper">
                  <img
                    src={integration.logo}
                    alt={`${integration.name} logo`}
                    className="integrationCard__icon"
                    loading="lazy"
                  />
                </div>

                <h3 className="integrationCard__title">
                  {integration.name}
                </h3>
              </motion.article>
            )
          })}
        </div>
      </div>
    </section>
  )
}