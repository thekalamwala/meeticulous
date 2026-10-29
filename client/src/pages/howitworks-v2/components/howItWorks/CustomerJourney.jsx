import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Link2,
    Sparkles,
    CalendarDays,
    User,
    CreditCard,
    BellRing,
    Check
} from 'lucide-react';

const CustomerJourney = () => {
    const [activeStep, setActiveStep] = useState(0);

    const steps = [
        { icon: Link2, title: 'Open your booking link' },
        { icon: Sparkles, title: 'Select a service' },
        { icon: CalendarDays, title: 'Choose an available date and time' },
        { icon: User, title: 'Enter booking information' },
        { icon: CreditCard, title: 'Complete payment' },
        { icon: BellRing, title: 'Receive confirmation and reminders' }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((currentStep) =>
                (currentStep + 1) % steps.length
            );
        }, 3000);

        return () => clearInterval(interval);
    }, [steps.length]);

    const phoneScreens = [
        {
            title: "Sandy's Salon",
            subtitle: '@sandyssalon',
            body: (
                <div className="mockup-card">
                    <p className="mockup-card-title">Services</p>

                    <div className="mockup-row">
                        <span>Haircut & Style · 45 min</span>
                        <span className="mockup-row-price">$45</span>
                    </div>

                    <div className="mockup-row">
                        <span>Manicure · 30 min</span>
                        <span className="mockup-row-price">$35</span>
                    </div>

                    <div
                        className="mockup-row"
                        style={{ border: '2px solid var(--primary)' }}
                    >
                        <span>Haircut & Style</span>
                        <span className="mockup-row-price">$45</span>
                    </div>
                </div>
            )
        },

        {
            title: 'Select a service',
            subtitle: 'Choose what you need',
            body: (
                <div className="mockup-card">
                    <p className="mockup-card-title">Popular services</p>

                    <div
                        className="mockup-row"
                        style={{ border: '2px solid var(--primary)' }}
                    >
                        <span>Haircut & Style</span>
                        <span className="mockup-row-price">$45</span>
                    </div>

                    <div className="mockup-row">
                        <span>Hair Colour</span>
                        <span className="mockup-row-price">$65</span>
                    </div>

                    <div className="mockup-row">
                        <span>Manicure</span>
                        <span className="mockup-row-price">$35</span>
                    </div>
                </div>
            )
        },

        {
            title: 'Pick a time',
            subtitle: 'Today · live availability',
            body: (
                <div className="mockup-card">
                    <p className="mockup-card-title">Available today</p>

                    <div className="mockup-times">
                        <span className="mockup-time">10:00</span>
                        <span className="mockup-time">11:30</span>
                        <span className="mockup-time selected">2:00 PM</span>
                        <span className="mockup-time">4:00</span>
                        <span className="mockup-time">5:30</span>
                    </div>
                </div>
            )
        },

        {
            title: 'Your details',
            subtitle: 'Almost done',
            body: (
                <div className="mockup-card">
                    <p className="mockup-card-title">Booking information</p>

                    <div className="mockup-row">
                        <span>Name</span>
                        <span style={{ fontWeight: 600 }}>Priya Sharma</span>
                    </div>

                    <div className="mockup-row">
                        <span>Phone</span>
                        <span style={{ fontWeight: 600 }}>
                            +91 98765 43210
                        </span>
                    </div>

                    <div className="mockup-row">
                        <span>Email</span>
                        <span style={{ fontWeight: 600 }}>
                            priya@email.com
                        </span>
                    </div>
                </div>
            )
        },

        {
            title: 'Payment',
            subtitle: 'Secure checkout',
            body: (
                <div className="mockup-card">
                    <p className="mockup-card-title">Payment summary</p>

                    <div className="mockup-row">
                        <span>Haircut & Style</span>
                        <span className="mockup-row-price">$45</span>
                    </div>

                    <div
                        className="mockup-status"
                        style={{ marginBottom: 0 }}
                    >
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            <CreditCard size={16} />
                            Pay securely
                        </span>

                        <span>$45</span>
                    </div>
                </div>
            )
        },

        {
            title: 'Booking confirmed',
            subtitle: "You're all set!",
            body: (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '1rem 0'
                    }}
                >
                    <div
                        style={{
                            width: 60,
                            height: 60,
                            background: 'rgba(34, 197, 94, 0.12)',
                            borderRadius: '50%',
                            margin: '0 auto 1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--success)'
                        }}
                    >
                        <Check size={32} />
                    </div>

                    <p
                        style={{
                            fontWeight: 700,
                            fontSize: '1rem',
                            marginBottom: '0.25rem'
                        }}
                    >
                        Haircut & Style
                    </p>

                    <p
                        style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            marginBottom: '0.75rem'
                        }}
                    >
                        Today · 2:00 PM
                    </p>

                    <div
                        className="mockup-status"
                        style={{
                            marginBottom: 0,
                            justifyContent: 'center',
                            background: 'var(--primary-soft)',
                            borderColor: 'rgba(254,81,0,0.2)',
                            color: 'var(--primary)'
                        }}
                    >
                        Confirmation sent · Reminder scheduled
                    </div>
                </div>
            )
        }
    ];

    const currentScreen = phoneScreens[activeStep];

    return (
        <section className="section customer-section">
            <div className="container">
                <div className="section-head">
                    <h2 className="section-title">
                        A fast booking experience your customers will enjoy
                    </h2>
                </div>

                <div className="customer-layout">
                    <div className="phone-mockup">
                        <div
                            className="phone-notch"
                            aria-hidden="true"
                        />

                        <div className="phone-screen">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeStep}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.25 }}
                                >
                                    <div
                                        className="mockup-header"
                                        style={{ paddingTop: '0.5rem' }}
                                    >
                                        <div className="mockup-avatar">
                                            S
                                        </div>

                                        <div>
                                            <p className="mockup-name">
                                                {currentScreen.title}
                                            </p>

                                            <p className="mockup-handle">
                                                {currentScreen.subtitle}
                                            </p>
                                        </div>
                                    </div>

                                    {currentScreen.body}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>

                    <div className="customer-steps">
                        {steps.map((step, index) => {
                            const StepIcon = step.icon;

                            return (
                                <button
                                    key={step.title}
                                    type="button"
                                    className={`customer-step ${
                                        activeStep === index ? 'active' : ''
                                    }`}
                                    onClick={() => setActiveStep(index)}
                                    aria-pressed={activeStep === index}
                                >
                                    <span className="customer-step-icon">
                                        <StepIcon size={20} />
                                    </span>

                                    <span className="customer-step-title">
                                        <span className="customer-step-num">
                                            {index + 1}.
                                        </span>

                                        {step.title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CustomerJourney;