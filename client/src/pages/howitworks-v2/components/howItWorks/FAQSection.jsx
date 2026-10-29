import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Clock, Globe, Wallet, CalendarClock, Users, ShieldCheck, MonitorSmartphone, Palette, BellRing, Smartphone, HelpCircle } from 'lucide-react';
import { faqs } from '../../data/howItWorksData';

const iconMap = [
    Clock,
    Globe,
    Wallet,
    CalendarClock,
    Users,
    ShieldCheck,
    MonitorSmartphone,
    Palette,
    BellRing,
    Smartphone
];

const FAQSection = () => {
    // Only one question open at a time; -1 means none open.
    const [openIndex, setOpenIndex] = useState(0);

    const handleToggle = (index) => {
        setOpenIndex(openIndex === index ? -1 : index);
    };

    return (
        <section className="section faq-section">
            <div className="container">
                <div className="section-head">
                    <h2 className="section-title">Everything you need to know</h2>
                </div>

                <div className="faq-list">
                    {faqs.map((faq, index) => {
                        const isOpen = openIndex === index;
                        const Icon = iconMap[index % iconMap.length] || HelpCircle;

                        return (
                            <motion.div
                                key={index}
                                className={`faq-item ${isOpen ? 'open' : ''}`}
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.3, delay: index * 0.04 }}
                            >
                                <button
                                    className="faq-button"
                                    onClick={() => handleToggle(index)}
                                    aria-expanded={isOpen}
                                    aria-controls={`faq-panel-${index}`}
                                    id={`faq-button-${index}`}
                                >
                                    <span className="faq-question">
                                        <span className="faq-question-icon">
                                            <Icon className="w-4 h-4" aria-hidden="true" />
                                        </span>
                                        {faq.question}
                                    </span>
                                    <span className="faq-toggle">
                                        {isOpen
                                            ? <Minus className="w-4 h-4" aria-hidden="true" />
                                            : <Plus className="w-4 h-4" aria-hidden="true" />}
                                    </span>
                                </button>

                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            id={`faq-panel-${index}`}
                                            role="region"
                                            aria-labelledby={`faq-button-${index}`}
                                            className="faq-answer"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            <div className="faq-answer-inner">{faq.answer}</div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default FAQSection;
