import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Fullscreen-friendly video modal with custom play/pause/mute/progress controls.
const VideoModal = ({ isOpen, onClose, videoSrc, title }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [progress, setProgress] = useState(0);
    const videoRef = useRef(null);

    // Keep the latest handler in a ref so the keydown listener stays stable.
    const togglePlayRef = useRef(null);

    const togglePlay = () => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
        } else {
            videoRef.current.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        }
    };

    togglePlayRef.current = togglePlay;

    // Lock background scroll + close on Escape while open
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === ' ') {
                e.preventDefault();
                if (togglePlayRef.current) togglePlayRef.current();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Reset state whenever the modal is closed
    useEffect(() => {
        if (!isOpen) {
            setIsPlaying(false);
            setProgress(0);
        }
    }, [isOpen]);

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (videoRef.current) videoRef.current.muted = !isMuted;
    };

    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen().catch(() => {});
            setIsFullscreen(true);
        } else {
            await document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
        }
    };

    const handleTimeUpdate = () => {
        const video = videoRef.current;
        if (video && video.duration) {
            setProgress((video.currentTime / video.duration) * 100);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(100);
    };

    const handleProgressClick = (e) => {
        const video = videoRef.current;
        if (!video || !video.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
        setProgress(pos * 100);
    };

    const isYouTube =
        typeof videoSrc === 'string' &&
        /(youtube\.com|youtu\.be)/i.test(videoSrc);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="video-modal-overlay"
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    aria-label={title || 'Video player'}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.25 }}
                        className="video-modal-body"
                        onClick={e => e.stopPropagation()}
                    >
                        <button className="video-modal-close" onClick={onClose} aria-label="Close video">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="video-modal-frame">
                            {isYouTube ? (
                                <iframe
                                    className="video-modal-embed"
                                    src={videoSrc}
                                    title={title || 'Video'}
                                    frameBorder="0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerPolicy="strict-origin-when-cross-origin"
                                    allowFullScreen
                                />
                            ) : (
                                <video
                                    ref={videoRef}
                                    className="w-100 h-100"
                                    src={videoSrc}
                                    muted={isMuted}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEnded}
                                    onClick={togglePlay}
                                    controls={false}
                                    playsInline
                                    preload="metadata"
                                />
                            )}
                        </div>

                        {!isYouTube && (
                            <div className="video-modal-controls">
                                <button onClick={togglePlay} aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                                </button>
                                <button onClick={toggleMute} aria-label={isMuted ? 'Unmute video' : 'Mute video'}>
                                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                                <span className="video-modal-timer">
                                    {title || 'Video'}
                                </span>
                                <div className="video-progress" onClick={handleProgressClick} role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                                    <div className="video-progress-fill" style={{ width: `${progress}%` }} />
                                </div>
                                <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                                </button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default VideoModal;
