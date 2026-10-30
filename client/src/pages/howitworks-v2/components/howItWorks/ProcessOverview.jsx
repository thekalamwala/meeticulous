import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Pen,
    Briefcase,
    Share2,
    CalendarCheck2,
    IndianRupee,
    LayoutDashboard,
    ArrowLeft,
    ArrowRight,
} from 'lucide-react';

const steps = [
    {
        icon: Pen,
        title: 'Create your page',
        desc: 'Build a professional booking profile for your business.',
        color: '#960D32',
        softColor: '#FFF0E8',
    },
    {
        icon: Briefcase,
        title: 'Add your services',
        desc: 'Set service duration, pricing, availability, and booking rules.',
        color: '#F59E0B',
        softColor: '#FFF7E3',
    },
    {
        icon: Share2,
        title: 'Share your link',
        desc: 'Add it to WhatsApp, Instagram, Google, or your website.',
        color: '#EC4899',
        softColor: '#FFF0F7',
    },
    {
        icon: CalendarCheck2,
        title: 'Receive bookings',
        desc: 'Customers book from your live availability without back-and-forth messages.',
        color: '#8B5CF6',
        softColor: '#F5F0FF',
    },
    {
        icon: IndianRupee,
        title: 'Get paid',
        desc: 'Collect full payments or deposits during the booking process.',
        color: '#3B82F6',
        softColor: '#EEF6FF',
    },
    {
        icon: LayoutDashboard,
        title: 'Manage everything',
        desc: 'Track bookings, customers, payments, staff, and schedules from one dashboard.',
        color: '#10B981',
        softColor: '#EBFFF8',
    },
];

const ProcessOverview = () => {
    const [activeIndex, setActiveIndex] = useState(2);
    const [spacing, setSpacing] = useState(() => {
        if (typeof window === 'undefined') return 185;
        const width = Math.min(window.innerWidth - 40, 1200);
        return Math.min(185, Math.max(130, Math.round(width * 0.45)));
    });
    const trackRef = useRef(null);

    // Scale the carousel spacing with the container width so the side cards
    // stay visible on narrow (mobile) screens instead of hiding behind the
    // active card.
    useEffect(() => {
        const updateSpacing = () => {
            const track = trackRef.current;
            if (!track) return;
            const width = track.clientWidth;
            setSpacing(Math.min(185, Math.max(130, Math.round(width * 0.45))));
        };

        updateSpacing();
        window.addEventListener('resize', updateSpacing);
        return () => window.removeEventListener('resize', updateSpacing);
    }, []);

    const handlePrevious = () => {
        setActiveIndex((current) =>
            current === 0 ? steps.length - 1 : current - 1
        );
    };

    const handleNext = () => {
        setActiveIndex((current) =>
            current === steps.length - 1 ? 0 : current + 1
        );
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'ArrowLeft') {
                handlePrevious();
            }

            if (event.key === 'ArrowRight') {
                handleNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return (
        <section
            className="section process-section"
            id="process-overview"
        >
            <div className="container process-container">
                <motion.div
                    className="section-head process-heading"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55 }}
                >

                    <h2 className="section-title process-main-title">
                        One link.{' '}
                        <span>Get booked, get paid, get your time back.</span>
                    </h2>

                    <p className="section-desc">
                        Six simple steps between you and getting booked, getting
                        paid over UPI, and getting your time back.
                    </p>
                </motion.div>

                <div className="process-carousel">
                    <div className="process-track" ref={trackRef}>
                        {steps.map((step, index) => {
                            const Icon = step.icon;
                            const distance = index - activeIndex;
                            const isActive = index === activeIndex;

                            return (
                                <motion.button
                                    type="button"
                                    key={step.title}
                                    className={`process-card ${
                                        isActive ? 'active' : ''
                                    }`}
                                    onClick={() => setActiveIndex(index)}
                                    animate={{
                                        x: distance * spacing,
                                        y: isActive ? -10 : Math.abs(distance) * 5,
                                        scale: isActive
                                            ? 1
                                            : Math.max(
                                                  0.78,
                                                  0.92 -
                                                      Math.abs(distance) * 0.04
                                              ),
                                        opacity:
                                            Math.abs(distance) > 3
                                                ? 0
                                                : Math.max(
                                                      0.42,
                                                      1 -
                                                          Math.abs(distance) *
                                                              0.16
                                                  ),
                                        zIndex: steps.length - Math.abs(distance),
                                    }}
                                    transition={{
                                        type: 'spring',
                                        stiffness: 220,
                                        damping: 24,
                                    }}
                                    style={{
                                        '--step-color': step.color,
                                        '--step-soft': step.softColor,
                                        pointerEvents:
                                            Math.abs(distance) > 3
                                                ? 'none'
                                                : 'auto',
                                    }}
                                    aria-label={`View step ${index + 1}: ${step.title}`}
                                    aria-pressed={isActive}
                                >
                                    <div className="process-card-header">
    <div className="process-card-icon">
        <Icon
            size={isActive ? 30 : 26}
            strokeWidth={1.8}
            aria-hidden="true"
        />
    </div>

    <span className="process-card-number">
        {String(index + 1).padStart(2, '0')}
    </span>
</div>

<div className="process-card-body">
    <h3 className="process-card-title">
        {step.title}
    </h3>

    <p className="process-card-desc">
        {step.desc}
    </p>
</div>

                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                <div className="process-navigation">
                    <button
                        type="button"
                        className="process-arrow"
                        onClick={handlePrevious}
                        aria-label="Show previous step"
                    >
                        <ArrowLeft size={22} />
                    </button>

                    <div className="process-dots">
                        {steps.map((step, index) => (
                            <button
                                type="button"
                                key={step.title}
                                className={`process-dot ${
                                    activeIndex === index ? 'active' : ''
                                }`}
                                onClick={() => setActiveIndex(index)}
                                aria-label={`Go to step ${index + 1}`}
                                style={{
                                    '--dot-color': step.color,
                                }}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        className="process-arrow process-arrow-next"
                        onClick={handleNext}
                        aria-label="Show next step"
                    >
                        <ArrowRight size={22} />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default ProcessOverview;