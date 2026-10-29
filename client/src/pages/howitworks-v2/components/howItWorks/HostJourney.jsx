import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Briefcase, CalendarClock, Share2, CreditCard, LayoutDashboard, Building2 } from 'lucide-react';
import JourneyStep from './JourneyStep';
import { hostJourneySteps } from '../../data/howItWorksData';

// Maps a data icon key to a lucide icon component.
const iconMap = {
    create: FileText,
    services: Briefcase,
    availability: CalendarClock,
    share: Share2,
    payments: CreditCard,
    manage: LayoutDashboard
};

const HostJourney = () => (
    <section className="section journey-section">
        <div className="container">
            <div className="section-head">
                <div className="section-label">
                    <Building2 className="w-4 h-4" aria-hidden="true" />
                    For businesses
                </div>
                <h2 className="section-title">
                    Set up your booking system in six simple steps
                </h2>
                <p className="section-desc">
                    Everything you need to go from sign-up to taking paid bookings — in one afternoon.
                </p>
            </div>

            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                {hostJourneySteps.map((step, index) => (
                    <JourneyStep
                        key={index}
                        number={index + 1}
                        icon={iconMap[step.icon] || FileText}
                        title={step.title}
                        description={step.description}
                        checklist={step.checklist}
                        videoPath={step.videoPath}
                        isReversed={index % 2 === 1}
                    />
                ))}
            </motion.div>
        </div>
    </section>
);

export default HostJourney;
