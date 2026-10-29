import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Briefcase, Dumbbell, Camera, MousePointerClick } from 'lucide-react';
import { demoBookingServices } from '../../data/howItWorksData';

const iconMap = {
    consultation: Briefcase,
    training: Dumbbell,
    photography: Camera
};

const InteractiveBookingDemo = () => {
    const [service, setService] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [name, setName] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [errors, setErrors] = useState({});

    const dates = ['Mon 4', 'Tue 5', 'Wed 6', 'Thu 7', 'Fri 8'];
    const times = ['09:00', '10:30', '12:00', '14:00', '15:30', '17:00'];

    const selectedService = demoBookingServices.find(s => s.id === service);

    const handleConfirm = () => {
        const newErrors = {};
        if (!service) newErrors.service = 'Please select a service';
        if (!date) newErrors.date = 'Please choose a date';
        if (!time) newErrors.time = 'Please choose a time';
        if (!name.trim()) newErrors.name = 'Please enter your name';
        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            setConfirmed(true);
        }
    };

    const resetDemo = () => {
        setService('');
        setDate('');
        setTime('');
        setName('');
        setErrors({});
        setConfirmed(false);
    };

    return (
        <section id="demo-booking-section" className="section demo-section">
            <div className="container">
                <div className="demo-layout">
                    {/* Copy */}
                    <div>
                        <div className="section-label">
                            <MousePointerClick className="w-4 h-4" aria-hidden="true" />
                            Interactive demo
                        </div>
                        <h2 className="section-title">Try booking right now</h2>
                        <p className="section-desc" style={{ marginBottom: '1.5rem' }}>
                            This is how easy it is for your customers. Pick a sample service, choose a time, and confirm—no backend needed.
                        </p>
                        <div className="demo-note" style={{ textAlign: 'left', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} /> No account or sign-up required
                            </p>
                            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} /> See the exact customer flow
                            </p>
                            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--success)' }} /> Works perfectly on mobile
                            </p>
                        </div>
                    </div>

                    {/* Mini booking form */}
                    <div className="demo-card">
                        <AnimatePresence mode="wait">
                            {confirmed ? (
                                <motion.div
                                    key="success"
                                    className="demo-success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <motion.div
                                        className="demo-success-icon"
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: 'spring', delay: 0.1 }}
                                    >
                                        <CheckCircle2 className="w-10 h-10" aria-hidden="true" />
                                    </motion.div>
                                    <h3 className="demo-success-title">Your demo booking is confirmed!</h3>
                                    <p className="demo-success-sub">
                                        {selectedService?.label} · {date} at {time}
                                    </p>
                                    <div className="journey-checklist" style={{ background: 'var(--white)', textAlign: 'left' }}>
                                        <p className="journey-checklist-title">Booked for</p>
                                        <p style={{ fontWeight: 600 }}>{name}</p>
                                    </div>
                                    <button className="demo-success-again" onClick={resetDemo}>
                                        Book another demo
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                >
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                                        Book a Demo
                                    </h3>

                                    {/* Step 1: Service */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="demo-step-label">1. Choose a service</label>
                                        {demoBookingServices.map(s => (
                                            <button
                                                key={s.id}
                                                className={`demo-service-option ${service === s.id ? 'selected' : ''}`}
                                                onClick={() => setService(s.id)}
                                            >
                                                {React.createElement(iconMap[s.id] || Briefcase, { className: 'demo-service-icon w-5 h-5' })}
                                                <span className="demo-service-info">
                                                    <span className="demo-service-name">{s.label}</span>
                                                    <br />
                                                    <span className="demo-service-meta">{s.duration}</span>
                                                </span>
                                                <span className="demo-service-price">{s.price}</span>
                                            </button>
                                        ))}
                                        {errors.service && <p className="demo-error">{errors.service}</p>}
                                    </div>

                                    {/* Step 2: Date */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="demo-step-label">2. Choose a date</label>
                                        <div className="demo-chip-grid">
                                            {dates.map(d => (
                                                <button
                                                    key={d}
                                                    className={`demo-chip ${date === d ? 'selected' : ''}`}
                                                    onClick={() => setDate(d)}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                        {errors.date && <p className="demo-error">{errors.date}</p>}
                                    </div>

                                    {/* Step 3: Time */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label className="demo-step-label">3. Choose a time</label>
                                        <div className="demo-chip-grid">
                                            {times.map(t => (
                                                <button
                                                    key={t}
                                                    className={`demo-chip ${time === t ? 'selected' : ''}`}
                                                    onClick={() => setTime(t)}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                        {errors.time && <p className="demo-error">{errors.time}</p>}
                                    </div>

                                    {/* Step 4: Name */}
                                    <div style={{ marginBottom: '1.75rem' }}>
                                        <label className="demo-step-label">4. Your name</label>
                                        <input
                                            type="text"
                                            className="demo-input"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="e.g. Priya Sharma"
                                        />
                                        {errors.name && <p className="demo-error">{errors.name}</p>}
                                    </div>

                                    <button className="demo-submit" onClick={handleConfirm}>
                                        Confirm Demo Booking
                                    </button>
                                    <p className="demo-note">Frontend demo only · no payment collected</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default InteractiveBookingDemo;
