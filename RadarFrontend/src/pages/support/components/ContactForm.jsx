import React, { useState } from 'react';
import { CheckCircle, AlertTriangle, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { submitSupportMessage } from '../../../api/supportApi';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    topic: 'Dashboard Issue',
    message: '',
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await submitSupportMessage({
        fullName: formData.fullName,
        email: formData.email,
        topic: formData.topic,
        message: formData.message,
        page: 'help-support',
      });

      setSubmitted(true);
      setToast({ type: 'success', message: 'Message sent successfully.' });
      setFormData({
        fullName: '',
        email: '',
        topic: 'Dashboard Issue',
        message: '',
      });

      setTimeout(() => {
        setSubmitted(false);
      }, 3000);
    } catch (submitError) {
      const nextError = submitError?.response?.data?.error || submitError?.response?.data?.message || 'Failed to send message';
      setError(nextError);
      setToast({ type: 'error', message: nextError });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="help-contact-form"
    >
      <h3 className="form-title">Send us a Message</h3>

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-semibold flex items-center gap-3 ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
        </motion.div>
      )}

      {submitted && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="form-success-message"
        >
          Message sent! We'll get back to you soon.
        </motion.div>
      )}

      {error && (
        <div className="form-error-message" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="contact-form-container">
        <div className="form-group">
          <label htmlFor="fullName" className="form-label">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder="John Doe"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="topic" className="form-label">
            Topic
          </label>
          <select
            id="topic"
            name="topic"
            value={formData.topic}
            onChange={handleChange}
            className="form-select"
          >
            <option value="Dashboard Issue">Dashboard Issue</option>
            <option value="Data Issue">Data Issue</option>
            <option value="Login Issue">Login Issue</option>
            <option value="Feedback">General Feedback</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="message" className="form-label">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            placeholder="Describe your issue or feedback..."
            className="form-textarea"
            rows="5"
            required
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          disabled={loading}
          className="form-submit-btn"
        >
          {loading ? (
            <span className="btn-loading">Sending...</span>
          ) : (
            <>
              <Send size={18} />
              Send Message
            </>
          )}
        </motion.button>

        <p className="form-helper-text">
          We usually respond within 24 hours.
        </p>
      </form>
    </motion.div>
  );
};

export default ContactForm;
