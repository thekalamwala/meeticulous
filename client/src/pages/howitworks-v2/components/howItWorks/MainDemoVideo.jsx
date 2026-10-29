import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X } from 'lucide-react';

const MainDemoVideo = () => {
    const [isVideoOpen, setIsVideoOpen] = useState(false);

    const openVideo = () => {
        setIsVideoOpen(true);
    };

    const closeVideo = () => {
        setIsVideoOpen(false);
    };

    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                closeVideo();
            }
        };

        if (isVideoOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isVideoOpen]);

    const handleBackdropClick = (event) => {
        if (event.target === event.currentTarget) {
            closeVideo();
        }
    };

    return (
        <>
            <section className="section video-section">
                <div className="container">
                    <div className="section-head">
                        <h2 className="section-title">
                            See Meeticulous in action
                        </h2>

                        <p className="section-desc">
                            Watch how a customer discovers a service, chooses
                            a time, completes payment, and receives a confirmed
                            booking.
                        </p>
                    </div>

                    <motion.button
                        type="button"
                        className="video-frame video-preview"
                        onClick={openVideo}
                        aria-label="Play Meeticulous demo video"
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <img
                            src="https://img.youtube.com/vi/x5Oag4hISgU/maxresdefault.jpg"
                            alt="Meeticulous demo video preview"
                            className="video-preview-image"
                        />

                        <span className="video-preview-overlay" />

                        <span className="video-preview-play">
                            <Play size={30} fill="currentColor" />
                        </span>

                        <span className="video-preview-text">
                            Watch demo
                        </span>
                    </motion.button>
                </div>
            </section>

            <AnimatePresence>
                {isVideoOpen && (
                    <motion.div
                        className="video-modal-backdrop"
                        onClick={handleBackdropClick}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Meeticulous demo video"
                    >
                        <motion.div
                            className="video-modal"
                            initial={{
                                opacity: 0,
                                scale: 0.92,
                                y: 30
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.92,
                                y: 30
                            }}
                            transition={{
                                duration: 0.25,
                                ease: 'easeOut'
                            }}
                        >
                            <button
                                type="button"
                                className="video-modal-close"
                                onClick={closeVideo}
                                aria-label="Close video"
                            >
                                <X size={22} />
                            </button>

                            <div className="video-modal-player">
                                <iframe
                                    src="https://www.youtube.com/embed/x5Oag4hISgU?autoplay=1&rel=0"
                                    title="Meeticulous demo"
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default MainDemoVideo;