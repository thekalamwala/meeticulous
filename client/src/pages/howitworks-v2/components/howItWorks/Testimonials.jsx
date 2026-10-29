import React from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { testimonials } from '../../data/howItWorksData';

const Testimonials = () => (
    <section className="section testimonials-section">
        <div className="container">
            <div className="section-head">
                <div className="section-label">
                    <Quote className="w-4 h-4" aria-hidden="true" />
                    Testimonials
                </div>
                <h2 className="section-title">Businesses spend less time scheduling</h2>
                <p className="section-desc">
                    Sample stories based on common results. Individual outcomes may vary.
                </p>
            </div>

            <div className="testimonials-grid">
                {testimonials.map((t, index) => (
                    <motion.figure
                        key={index}
                        className="testimonial-card"
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                        <span className="testimonial-quote-bg">
                            <Quote className="w-12 h-12" aria-hidden="true" />
                        </span>

                        <div className="testimonial-head">
                            <div className="testimonial-avatar">{t.avatar}</div>
                            <div>
                                <figcaption className="testimonial-name">{t.name}</figcaption>
                                <p className="testimonial-business">{t.business}</p>
                            </div>
                        </div>

                        <div className="testimonial-stars" aria-label={`${t.rating} out of 5 stars`}>
                            {Array.from({ length: t.rating }).map((_, i) => (
                                <Star key={i} className="w-5 h-5 fill-current" aria-hidden="true" />
                            ))}
                        </div>

                        <blockquote className="testimonial-quote">&quot;{t.quote}&quot;</blockquote>

                        <span className="testimonial-metric">{t.metric}</span>
                    </motion.figure>
                ))}
            </div>
        </div>
    </section>
);

export default Testimonials;
