import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";
import Button from "../common/Button";
import VideoModal from "../common/VideoModal";
import {
    tutorials,
    tutorialCategories,
} from "../../data/howItWorksData";

// Add your 7 YouTube Video IDs here
const VIDEO_IDS = [
    "M7lc1UVf-VE",
    "aqz-KE-bpKQ",
    "LXb3EKWsInQ",
    "ScMzIvxBSi4",
    "5v-WAEvA7C4",
    "ysz5S6PUM-U",
    "3JZ_D3ELwOQ",
];

const TutorialLibrary = () => {
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedVideo, setSelectedVideo] = useState(null);

    const filteredTutorials =
        selectedCategory === "all"
            ? tutorials
            : tutorials.filter(
                  (tutorial) => tutorial.category === selectedCategory
              );

    const categoryLabel = (id) =>
        tutorialCategories.find((c) => c.id === id)?.label || id;

    const openVideo = (tutorial, videoId) => {
        setSelectedVideo({
            ...tutorial,
            videoUrl: `https://www.youtube.com/embed/${videoId}`,
        });
    };

    const closeVideo = () => {
        setSelectedVideo(null);
    };

    return (
        <section className="section tutorial-section">
            <div className="container">

                <div className="section-head">
                    <h2 className="section-title">
                        Learn at your own pace
                    </h2>

                    <p className="section-desc">
                        Short tutorials to help you set up, customize,
                        and grow with Meeticulous.
                    </p>
                </div>

                <div className="tutorial-filters">
                    {tutorialCategories.map((category) => (
                        <button
                            key={category.id}
                            type="button"
                            className={`tutorial-filter ${
                                selectedCategory === category.id
                                    ? "active"
                                    : ""
                            }`}
                            onClick={() =>
                                setSelectedCategory(category.id)
                            }
                        >
                            {category.label}
                        </button>
                    ))}
                </div>

                <motion.div layout className="tutorial-grid">
                    <AnimatePresence mode="popLayout">

                        {filteredTutorials.map((tutorial, index) => {

                            const videoId =
                                VIDEO_IDS[index % VIDEO_IDS.length];

                            return (
                                <motion.article
                                    key={tutorial.id}
                                    layout
                                    initial={{
                                        opacity: 0,
                                        scale: 0.96,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                    }}
                                    exit={{
                                        opacity: 0,
                                        scale: 0.96,
                                    }}
                                    transition={{
                                        duration: 0.3,
                                    }}
                                    className="tutorial-card"
                                >
                                    <div
                                        className="tutorial-thumb"
                                        style={{
                                            cursor: "pointer",
                                        }}
                                        onClick={() =>
                                            openVideo(
                                                tutorial,
                                                videoId
                                            )
                                        }
                                    >
                                        <img
                                            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                            alt={tutorial.title}
                                            className="tutorial-thumbnail"
                                            onError={(e) => {
                                                e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                            }}
                                        />

                                        <div className="tutorial-overlay" />

                                        <span className="tutorial-thumb-play">
                                            <Play className="w-5 h-5 fill-current" />
                                        </span>

                                        <span className="tutorial-duration">
                                            {tutorial.duration}
                                        </span>

                                        <span className="tutorial-badge">
                                            {categoryLabel(
                                                tutorial.category
                                            )}
                                        </span>
                                    </div>

                                    <div className="tutorial-body">
                                        <h3 className="tutorial-title">
                                            {tutorial.title}
                                        </h3>

                                        <p className="tutorial-desc">
                                            {tutorial.description}
                                        </p>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                openVideo(
                                                    tutorial,
                                                    videoId
                                                )
                                            }
                                        >
                                            Watch Video
                                        </Button>
                                    </div>
                                </motion.article>
                            );
                        })}

                    </AnimatePresence>
                </motion.div>

            </div>

            {selectedVideo && (
                <VideoModal
                    isOpen={true}
                    onClose={closeVideo}
                    videoSrc={`${selectedVideo.videoUrl}?autoplay=1&rel=0`}
                    title={`${selectedVideo.title} (${selectedVideo.duration})`}
                />
            )}
        </section>
    );
};

export default TutorialLibrary;