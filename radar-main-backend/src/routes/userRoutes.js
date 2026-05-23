const express = require('express');
const router = express.Router();
const { 
    getUserProfile,
    updateUserProfile,
    updatePassword,
    setPassword,
    saveInvestorDNA,
    updateNotificationPreferences,
    getMode, 
    updateMode,
    getUserPortfolio,
    getUserPerformance,
    getUserHoldings,
    getUserInsights,
    getUserNews,
    getUserEvents
} = require('../controllers/userController');
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.get('/profile', authMiddleware, getUserProfile);
router.patch('/profile', authMiddleware, updateUserProfile);
router.patch('/password', authMiddleware, updatePassword);
router.post('/set-password', authMiddleware, setPassword);
router.post('/dna', authMiddleware, saveInvestorDNA);
router.patch('/notifications', authMiddleware, updateNotificationPreferences);
router.get('/mode', authMiddleware, getMode);
router.patch('/mode', authMiddleware, updateMode);
router.get('/settings', authMiddleware, getSettings);
router.patch('/settings', authMiddleware, updateSettings);
router.post('/settings', authMiddleware, updateSettings);

// Investor Dashboard APIs
router.get('/portfolio', authMiddleware, getUserPortfolio);
router.get('/performance', authMiddleware, getUserPerformance);
router.get('/holdings', authMiddleware, getUserHoldings);
router.get('/insights', authMiddleware, getUserInsights);
router.get('/news', authMiddleware, getUserNews);
router.get('/events', authMiddleware, getUserEvents);

module.exports = router;
