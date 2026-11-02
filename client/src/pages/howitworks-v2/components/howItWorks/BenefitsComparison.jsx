import React from 'react';
import { motion } from 'framer-motion';
import { X, Check, MessageCircle, CalendarX2, BellOff, CreditCard, CalendarOff, FolderX, Link2, CalendarCheck2, BellRing, ShieldCheck, FolderCheck, Wallet } from 'lucide-react';

const BenefitsComparison = () => {
    const without = [
        { icon: MessageCircle, title: 'Repeated WhatsApp messages', desc: 'Customers message back and forth just to find a free slot.' },
        { icon: CalendarX2, title: 'Manual availability checks', desc: 'You juggle calendars, messages, and phone calls by hand.' },
        { icon: BellOff, title: 'Missed appointments', desc: 'No reminders means no-shows and wasted time slots.' },
        { icon: CreditCard, title: 'Payment follow-ups', desc: 'You chase payments days after the appointment.' },
        { icon: CalendarOff, title: 'Double bookings', desc: 'Overlapping slots slip through when scheduling is manual.' },
        { icon: FolderX, title: 'Scattered customer details', desc: 'Client info lives across chats, calls, and notebooks.' }
    ];

    const withMeeticulous = [
        { icon: Link2, title: 'One self-service booking link', desc: 'Customers pick a slot themselves—24/7, no messages needed.' },
        { icon: CalendarCheck2, title: 'Real-time availability', desc: 'Your live calendar is always up to date and accurate.' },
        { icon: BellRing, title: 'Automated reminders', desc: 'SMS and email reminders drastically cut no-shows.' },
        { icon: Wallet, title: 'Upfront payments', desc: 'Collect full payment or deposits at the time of booking.' },
        { icon: ShieldCheck, title: 'Conflict-free scheduling', desc: 'Built-in protection means no more double bookings.' },
        { icon: FolderCheck, title: 'Centralized customer records', desc: 'Every customer and their history in one dashboard.' }
    ];

    return (
        <section className="section benefits-section">
            <div className="container">
                <div className="section-head">
                    <h2 className="section-title">
                        Less admin work. More time for your customers.
                    </h2>
                </div>

                <div className="benefits-grid">
                    {/* Without */}
                    <motion.div
                        className="benefit-col without"
                        initial={{ opacity: 0, x: -30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="benefit-head">
                            <span className="benefit-head-icon">
                                <X className="w-5 h-5" aria-hidden="true" />
                            </span>
                            <h3 className="benefit-head-title">Without Meeticulous</h3>
                        </div>
                        <div className="benefit-items">
                            {without.map((item, index) => (
                                <div className="benefit-item" key={index}>
                                    <span className="benefit-item-icon">
                                        {React.createElement(item.icon, { className: 'w-5 h-5' })}
                                    </span>
                                    <div>
                                        <p className="benefit-item-title">{item.title}</p>
                                        <p className="benefit-item-desc">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* With */}
                    <motion.div
                        className="benefit-col with"
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="benefit-head">
                            <span className="benefit-head-icon">
                                <Check className="w-5 h-5" aria-hidden="true" />
                            </span>
                            <h3 className="benefit-head-title">With Meeticulous</h3>
                        </div>
                        <div className="benefit-items">
                            {withMeeticulous.map((item, index) => (
                                <div className="benefit-item" key={index}>
                                    <span className="benefit-item-icon">
                                        {React.createElement(item.icon, { className: 'w-5 h-5' })}
                                    </span>
                                    <div>
                                        <p className="benefit-item-title">{item.title}</p>
                                        <p className="benefit-item-desc">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default BenefitsComparison;
