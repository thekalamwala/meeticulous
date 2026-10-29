import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import Button from '../common/Button';

// Floating "Book a Demo" button: visible after the process section, hidden at the final CTA.
const StickyDemoButton = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            const startEl = document.querySelector('#process-overview') || document.querySelector('section');
            const ctaEl = document.getElementById('final-cta-section');

            if (!startEl) {
                setIsVisible(false);
                return;
            }

            const startBottom = startEl.getBoundingClientRect().bottom;
            const ctaTop = ctaEl ? ctaEl.getBoundingClientRect().top : Infinity;

            // Show once the process section has scrolled past and the final CTA hasn't entered yet.
            setIsVisible(startBottom < 0 && ctaTop > window.innerHeight * 0.8);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const openDemoModal = () => {
        window.dispatchEvent(new Event('open-demo-modal'));
    };

    return (
        <>
            {isMobile ? (
                <motion.div
                    className="sticky-demo sticky-demo-mobile"
                    initial={{ y: 100 }}
                    animate={{ y: isVisible ? 0 : 120 }}
                    transition={{ duration: 0.3 }}
                >
                    <Button variant="primary" size="lg" onClick={openDemoModal}>
                        <CalendarDays className="w-5 h-5" aria-hidden="true" />
                        Book a Demo
                    </Button>
                </motion.div>
            ) : (
                <motion.button
                    className="sticky-demo sticky-demo-desktop"
                    initial={{ x: 100, opacity: 0 }}
                    animate={{ x: isVisible ? 0 : 100, opacity: isVisible ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={openDemoModal}
                    aria-label="Book a Demo"
                >
                    <CalendarDays className="w-6 h-6" aria-hidden="true" />
                </motion.button>
            )}
        </>
    );
};

export default StickyDemoButton;
