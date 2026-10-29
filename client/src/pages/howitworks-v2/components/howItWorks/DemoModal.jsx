import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';
import Button from '../common/Button';

const DemoModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        businessName: '',
        businessCategory: '',
        staffCount: '',
        preferredDate: '',
        preferredTime: '',
        message: ''
    });

    const businessCategories = [
        'Consultants and advisors',
        'Doctors and clinics',
        'Salons and spas',
        'Personal trainers',
        'Tutors and educators',
        'Photographers',
        'Lawyers and accountants',
        'Freelancers',
        'Agencies and creative teams',
        'Event professionals'
    ];

    const timeSlots = ['9:00 AM', '10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:00 PM'];

    const openModal = useCallback(() => {
        setErrors({});
        setIsSubmitted(false);
        setIsOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        setIsOpen(false);
        setErrors({});
    }, []);

    // Allow any "Book a Demo" button to open this modal via a custom event
    useEffect(() => {
        window.addEventListener('open-demo-modal', openModal);
        return () => window.removeEventListener('open-demo-modal', openModal);
    }, [openModal]);

    // Escape to close + lock background scroll while open
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') closeModal();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, closeModal]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
        if (!formData.email.trim()) newErrors.email = 'Work email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Enter a valid email address';
        if (formData.phone && !/^[+\d][\d\s-]{7,}$/.test(formData.phone.trim())) newErrors.phone = 'Enter a valid phone number';
        if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
        if (!formData.businessCategory) newErrors.businessCategory = 'Please select a category';
        if (!formData.preferredDate) newErrors.preferredDate = 'Please pick a date';
        if (!formData.preferredTime) newErrors.preferredTime = 'Please pick a time';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (validate()) {
            setIsSubmitted(true);
            setTimeout(() => {
                closeModal();
                setFormData({
                    fullName: '',
                    email: '',
                    phone: '',
                    businessName: '',
                    businessCategory: '',
                    staffCount: '',
                    preferredDate: '',
                    preferredTime: '',
                    message: ''
                });
            }, 2500);
        }
    };

    const renderField = (label, field, type = 'text', placeholder = '', required = false, options = null) => (
        <div className={`demo-field ${errors[field] ? 'has-error' : ''}`}>
            <label htmlFor={`demo-${field}`}>
                {label}
                {required && <span style={{ color: 'var(--primary)' }}> *</span>}
            </label>
            {options ? (
                <select
                    id={`demo-${field}`}
                    value={formData[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                >
                    <option value="">Select…</option>
                    {options.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            ) : (
                <input
                    id={`demo-${field}`}
                    type={type}
                    value={formData[field]}
                    placeholder={placeholder}
                    onChange={(e) => handleChange(field, e.target.value)}
                />
            )}
            {errors[field] && <p className="demo-field-error">{errors[field]}</p>}
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="demo-modal-overlay"
                    onClick={closeModal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="demo-modal-title"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.25 }}
                        className="demo-modal-body"
                        onClick={e => e.stopPropagation()}
                    >
                        {!isSubmitted ? (
                            <>
                                <div className="demo-modal-head">
                                    <div>
                                        <h3 id="demo-modal-title" className="demo-modal-title">
                                            Book a Personal Demo
                                        </h3>
                                        <p className="demo-modal-subtitle">
                                            See how Meeticulous works for your business
                                        </p>
                                    </div>
                                    <button className="demo-modal-close" onClick={closeModal} aria-label="Close demo booking form">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <form className="demo-modal-form" onSubmit={handleSubmit} noValidate>
                                    <div className="demo-form-grid">
                                        {renderField('Full name', 'fullName', 'text', 'Priya Sharma', true)}
                                        {renderField('Work email', 'email', 'email', 'you@business.com', true)}
                                        {renderField('Phone number', 'phone', 'tel', '+91 98765 43210')}
                                        {renderField('Business name', 'businessName', 'text', "Sandy's Salon", true)}
                                        {renderField('Business category', 'businessCategory', 'text', '', true, businessCategories)}
                                        {renderField('Number of staff members', 'staffCount', 'text', '', false, ['Just me', '2–5', '6–20', '21+'])}
                                        {renderField('Preferred demo date', 'preferredDate', 'date', '', true)}
                                        {renderField('Preferred time', 'preferredTime', 'text', '', true, timeSlots)}
                                    </div>

                                    <div className="demo-field" style={{ marginBottom: '1.5rem' }}>
                                        <label htmlFor="demo-message">Message</label>
                                        <textarea
                                            id="demo-message"
                                            rows={3}
                                            value={formData.message}
                                            placeholder="Tell us a little about your business…"
                                            onChange={(e) => handleChange('message', e.target.value)}
                                        />
                                    </div>

                                    <Button type="submit" variant="primary" size="lg" style={{ width: '100%' }}>
                                        Request Demo
                                    </Button>
                                    <p className="demo-note">Frontend-only form · nothing is sent to a server</p>
                                </form>
                            </>
                        ) : (
                            <div className="demo-modal-success">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', delay: 0.1 }}
                                    className="demo-success-icon"
                                >
                                    <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
                                </motion.div>
                                <h3 className="demo-success-title">Thanks!</h3>
                                <p className="demo-success-sub">
                                    Your demo request has been received. Our team will reach out shortly.
                                </p>
                                <Button variant="primary" onClick={closeModal}>Done</Button>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default DemoModal;
