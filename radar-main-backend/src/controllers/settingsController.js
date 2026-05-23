const UserSettings = require('../models/UserSettings');

// @desc    Get user settings
// @route   GET /api/user/settings
// @access  Private
exports.getSettings = async (req, res) => {
    try {
        let settings = await UserSettings.findOne({ user: req.user._id });
        
        if (!settings) {
            // Create default settings if not found
            settings = await UserSettings.create({ user: req.user._id });
        }
        
        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({
            success: false,
            error: err.message || 'Server Error'
        });
    }
};

// @desc    Update user settings
// @route   POST /api/user/settings
// @access  Private
exports.updateSettings = async (req, res) => {
    try {
        let settings = await UserSettings.findOne({ user: req.user._id });
        
        if (!settings) {
            settings = new UserSettings({ user: req.user._id, ...req.body });
        } else {
            // Update fields
            Object.keys(req.body).forEach(key => {
                settings[key] = req.body[key];
            });
            settings.updatedAt = Date.now();
        }
        
        await settings.save();
        
        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(400).json({
            success: false,
            error: err.message
        });
    }
};
