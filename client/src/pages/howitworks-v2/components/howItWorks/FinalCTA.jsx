import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

const FinalCTA = () => {
    const openDemoModal = () => {
        window.dispatchEvent(new Event('open-demo-modal'));
    };

    return (
        <section id="final-cta-section" className="final-cta">
            <div className="container">
                <motion.div
                    className="final-cta-content"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <h2 className="final-cta-title">Ready to make booking easier?</h2>
                    <p className="final-cta-desc">
                        Create your booking page today or book a personalized demo to see how Meeticulous can work for your business.
                    </p>

                    <div className="final-cta-actions">
                        <button className="final-cta-btn-primary" onClick={openDemoModal}>
                            Start for Free
                        </button>
                        <button className="final-cta-btn-ghost" onClick={openDemoModal}>
                            <Play className="w-4 h-4 fill-current" aria-hidden="true" style={{ display: 'inline', marginRight: 6 }} />
                            Book a Demo
                        </button>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default FinalCTA;
