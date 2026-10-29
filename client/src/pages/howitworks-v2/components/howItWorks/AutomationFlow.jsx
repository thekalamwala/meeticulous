import React from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck2, CreditCard, CalendarDays, MailCheck, Clock, LayoutDashboard, Zap, BellRing, ShieldCheck, CalendarClock, Users, BarChart3 } from 'lucide-react';

const AutomationFlow = () => {
    const flowSteps = [
        { icon: CalendarCheck2, label: 'Booking created' },
        { icon: CreditCard, label: 'Payment verified' },
        { icon: CalendarDays, label: 'Calendar updated' },
        { icon: MailCheck, label: 'Confirmation sent' },
        { icon: Clock, label: 'Reminder scheduled' },
        { icon: LayoutDashboard, label: 'Dashboard updated' }
    ];

    const features = [
        { icon: Zap, title: 'Instant confirmation', desc: 'Customers receive their booking confirmation the moment they complete checkout.' },
        { icon: BellRing, title: 'Automatic reminders', desc: 'SMS and email reminders go out automatically to reduce no-shows.' },
        { icon: ShieldCheck, title: 'Secure payments', desc: 'Payments are verified and captured securely before the slot is locked in.' },
        { icon: CalendarClock, title: 'Calendar synchronization', desc: 'Every booking syncs to your calendar so nothing is ever double-booked.' },
        { icon: Users, title: 'Customer records', desc: 'Bookings build a complete, searchable customer history automatically.' },
        { icon: BarChart3, title: 'Booking analytics', desc: 'Revenues, bookings, and trends are tracked for you in real time.' }
    ];

    return (
        <section className="section automation-section">
            <div className="container">
                <div className="section-head">
                    <h2 className="section-title">What happens after a customer books?</h2>
                    <p className="section-desc">
                        Meeticulous handles every repetitive booking task automatically—so you can focus on your customers.
                    </p>
                </div>

                {/* Automation flow */}
                <div className="automation-flow">
                    {flowSteps.map((step, index) => (
                        <motion.div
                            key={index}
                            className="automation-node"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                        >
                            <div className="automation-node-icon">
                                {React.createElement(step.icon, { className: 'w-6 h-6' })}
                            </div>
                            <span className="automation-node-label">{step.label}</span>
                        </motion.div>
                    ))}
                </div>

                {/* Feature cards */}
                <div className="automation-cards">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            className="automation-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.08 }}
                        >
                            <div className="automation-card-icon">
                                {React.createElement(feature.icon, { className: 'w-6 h-6' })}
                            </div>
                            <h3 className="automation-card-title">{feature.title}</h3>
                            <p className="automation-card-desc">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default AutomationFlow;
