const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const { getUserSettings, updateUserSettings } = require('../controllers/userSettingsController');

router.get('/', auth.authMiddleware, getUserSettings);
router.patch('/', auth.authMiddleware, updateUserSettings);

module.exports = router;
