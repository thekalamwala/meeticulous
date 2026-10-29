import React from "react";

const VideoModal = ({ isOpen, onClose, videoSrc, title }) => {
    if (!isOpen) return null;
    console.log(videoSrc);

    return (
        <div className="video-modal-overlay" onClick={onClose}>
            <div
                className="video-modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="video-modal-close"
                    onClick={onClose}
                >
                    ✕
                </button>

                <div className="video-wrapper">
                    <iframe
                        src={videoSrc}
                        title={title}
                        width="100%"
                        height="100%"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
};

export default VideoModal;