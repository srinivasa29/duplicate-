import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ContactForm from './components/ContactForm';
import ContactInfo from './components/ContactInfo';
import FAQAccordion from './components/FAQAccordion';
import './HelpSupportPage.css';

const HelpSupportPage = ({ embedded = false, dashboardPath = '/trader/dashboard' } = {}) => {
  const navigate = useNavigate();

  const handleBackToDashboard = () => {
    navigate(dashboardPath);
  };

  return (
    <div className="help-support-page">
      {/* Gradient Background */}
      <div className="help-gradient-bg" />

      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="help-header"
      >
        <div className="help-header-content">
          <div className="help-header-left">
            {!embedded && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToDashboard}
                className="back-to-dashboard-btn help-back-left-btn"
              >
                <ArrowLeft size={18} />
                Back to Dashboard
              </motion.button>
            )}
            <h1 className="help-title">Help & Support</h1>
            <p className="help-subtitle">
              Get help with insights, charts, and account access
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Container */}
      <div className="help-container">
        {/* Two-Column Layout */}
        <div className="help-main-content">
          <div className="help-left-column">
            <ContactForm />
          </div>
          <div className="help-middle-column">
            <ContactInfo />
          </div>
        </div>

        {/* FAQ Section */}
        <div className="help-faq-container">
          <FAQAccordion />
        </div>
      </div>
    </div>
  );
};

export default HelpSupportPage;
