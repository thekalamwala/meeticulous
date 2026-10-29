import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Stethoscope, Scissors, Dumbbell, BookOpen, Camera, Scale, Laptop, Palette, PartyPopper, ArrowRight, LayoutGrid } from 'lucide-react';
import { businessCategories } from '../../data/howItWorksData';

const iconMap = {
    consultant: Briefcase,
    doctor: Stethoscope,
    salon: Scissors,
    trainer: Dumbbell,
    tutor: BookOpen,
    photographer: Camera,
    lawyer: Scale,
    freelancer: Laptop,
    agency: Palette,
    event: PartyPopper
};

const BusinessCategories = () => (
    <section className="section categories-section">
        <div className="container">
            <div className="section-head">
                <div className="section-label">
                    <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                    Use cases
                </div>
                <h2 className="section-title">
                    Built for every kind of appointment-based business
                </h2>
                <p className="section-desc">
                    If your business runs on appointments, Meeticulous fits right in.
                </p>
            </div>

            <div className="category-grid">
                {businessCategories.map((category, index) => {
                    const Icon = iconMap[category.icon] || Briefcase;
                    return (
                        <motion.div
                            key={index}
                            className="category-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: (index % 4) * 0.08 }}
                        >
                            <div className="category-icon">
                                <Icon className="w-6 h-6" aria-hidden="true" />
                            </div>
                            <h3 className="category-title">{category.title}</h3>
                            <p className="category-service">{category.service}</p>
                            <p className="category-desc">{category.desc}</p>
                            <a href="#demo-booking-section" className="category-link">
                                See how it works
                                <ArrowRight className="w-4 h-4" aria-hidden="true" />
                            </a>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    </section>
);

export default BusinessCategories;
