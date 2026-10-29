import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Play, ArrowRight, MonitorPlay } from 'lucide-react';
import VideoModal from '../common/VideoModal';

// A single alternating journey step: text on one side, video preview on the other.
const JourneyStep = ({ number, icon, title, description, checklist, videoPath, isReversed = false }) => {
    const [isVideoOpen, setIsVideoOpen] = useState(false);

    return (
        <motion.article
            className={`journey-step ${isReversed ? 'reverse' : ''}`}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6 }}
        >
            {/* Text content */}
            <div className="journey-content">
                <div className="journey-step-header">
                    <span className="journey-step-number">{number}</span>
                    <span className="journey-step-icon">
                        {React.createElement(icon, { className: 'w-5 h-5' })}
                    </span>
                    <h3 className="journey-step-title">{title}</h3>
                </div>

                <p className="journey-step-desc">{description}</p>

                <div className="journey-checklist">
                    <p className="journey-checklist-title">What you get</p>
                    <ul>
                        {checklist.map((item, idx) => (
                            <li key={idx}>
                                <Check className="w-4 h-4" aria-hidden="true" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <a href="#demo-booking-section" className="journey-learn-more">
                    Learn more
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
            </div>

            {/* Video preview */}
            <div className="journey-media">
                <div
                    className="journey-video-preview"
                    onClick={() => setIsVideoOpen(true)}
                    role="button"
                    aria-label={`Play video for ${title}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setIsVideoOpen(true);
                    }}
                >
                    <div className="journey-video-content">
                        <span className="journey-video-play">
                            <Play className="w-6 h-6 fill-current" aria-hidden="true" />
                        </span>
                        <p className="journey-video-label">Watch demo</p>
                        <p className="journey-video-path">
                            <MonitorPlay className="w-3 h-3" aria-hidden="true" style={{ display: 'inline', marginRight: 4 }} />
                            {videoPath}
                        </p>
                    </div>
                </div>
            </div>

            <VideoModal
                isOpen={isVideoOpen}
                onClose={() => setIsVideoOpen(false)}
                videoSrc={videoPath}
                title={title}
            />
        </motion.article>
    );
};

export default JourneyStep;
