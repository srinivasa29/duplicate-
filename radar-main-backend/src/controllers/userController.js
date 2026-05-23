const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const { calculatePortfolioRisk } = require('../services/portfolioRiskService');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const sendEmail = require('../services/mailService');
const logger = require('../config/logger');


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const normalizeIdentifier = (value) => String(value || '').trim().toLowerCase();

const registerUser = asyncHandler(async (req, res) => {
    const { username, password, email, identifier } = req.body;

    const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long and contain a mix of letters, numbers, and symbols.' });
    }

    try {
        const normalizedUsername = String(username || '').trim();
        const normalizedEmail = normalizeIdentifier(email || identifier || '');
        const userExists = await User.findOne({
            $or: [
                { username: normalizedUsername },
                ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
            ],
        });
        if (userExists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = await User.create({
            username: normalizedUsername,
            password,
            ...(normalizedEmail ? { email: normalizedEmail } : {}),
        });

        if (user) {
            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email || null,
                preferredMode: user.preferredMode,
                token: generateToken(user._id)
            });
        }
    } catch (error) {
        logger.error('Error during user registration:', error);
        res.status(400).json({ error: 'Invalid user data', details: error.message });
    }
});

const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); 

const googleAuth = asyncHandler(async (req, res) => {
    const { token, isSignup } = req.body;

    try {
        let name, email, picture;

        // An ID token (JWT) has 3 parts separated by dots. An access token usually does not.
        if (token.split('.').length === 3) {
            const ticket = await client.verifyIdToken({
                idToken: token,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            name = payload.name;
            email = payload.email;
            picture = payload.picture;
        } else {
            // It's an access token from useGoogleLogin
            const axios = require('axios');
            const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${token}` }
            });
            name = response.data.name;
            email = response.data.email;
            picture = response.data.picture;
        }

        let user = await User.findOne({ email });

        if (user) {
            // Retroactively stamp authProvider for users created before this field existed
            if (!user.authProvider || user.authProvider === 'email') {
                user.authProvider = 'google';
                await user.save();
            }
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                preferredMode: user.preferredMode,
                token: generateToken(user._id),
                picture: picture,
                isNewUser: false
            });
        } else {
            if (!isSignup) {
                return res.status(404).json({ error: 'Account not found. Please sign up first.' });
            }
            
            const randomPassword = crypto.randomBytes(16).toString('hex');
            user = await User.create({
                username: name,
                email: email,
                password: randomPassword,
                authProvider: 'google'
            });

            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                preferredMode: user.preferredMode,
                token: generateToken(user._id),
                picture: picture,
                isNewUser: true
            });
        }
    } catch (error) {
        logger.error('Error during Google login:', error);
        res.status(400).json({ error: 'Google Login Failed', details: error.message });
    }
});


const loginUser = asyncHandler(async (req, res) => {
    const { username, identifier, password } = req.body;
    const loginId = String(username || identifier || '').trim();
    const normalized = normalizeIdentifier(loginId);

    try {
        if (!loginId || !password) {
            return res.status(400).json({ error: 'Username/email and password are required' });
        }

        const user = await User.findOne({
            $or: [
                { username: loginId },
                { email: normalized },
            ],
        });

        if (user && (await user.matchPassword(password))) {
            res.json({
                _id: user._id,
                username: user.username,
                email: user.email || null,
                preferredMode: user.preferredMode,
                token: generateToken(user._id)
            });
        } else {
            res.status(401).json({ error: 'Invalid username or password' });
        }
    } catch (error) {
        logger.error('Error during user login:', error);
        res.status(500).json({ error: error.message });
    }
});

const getUserProfile = asyncHandler(async (req, res) => {
    const u = req.user;
    res.json({
        _id:          u._id,
        username:     u.username,
        email:        u.email || null,
        preferredMode: u.preferredMode,
        createdAt:    u.createdAt,
        joinedDate:   u.createdAt
            ? `Joined ${new Date(u.createdAt).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`
            : null,
        watchlist:    u.watchlist,
        settings:     u.settings || {},
        investorDNA:  u.investorDNA || null,
        notificationPreferences: u.notificationPreferences || {
            priceAlerts: true,
            earningsUpdates: true,
            importantNews: true
        },
        authProvider: u.authProvider || 'email'
    });
});

const updateUserProfile = asyncHandler(async (req, res) => {
    const { username, email } = req.body;
    logger.info(`[updateUserProfile] Received: username=${username}, email=${email}, userId=${req.user?._id}`);

    const user = await User.findById(req.user._id);
    if (!user) {
        logger.error('[updateUserProfile] User not found in DB for id:', req.user._id);
        return res.status(404).json({ error: 'User not found' });
    }

    if (username && username !== user.username) {
        const taken = await User.findOne({ username, _id: { $ne: user._id } });
        if (taken) return res.status(400).json({ error: 'Username already taken' });
        user.username = username.trim();
    }
    if (email && email !== user.email) {
        const normalizedEmail = email.trim().toLowerCase();
        const taken = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (taken) return res.status(400).json({ error: 'Email already taken' });
        user.email = normalizedEmail;
    }

    try {
        await user.save();
        logger.info('[updateUserProfile] Saved successfully for user:', user._id);
    } catch (saveErr) {
        logger.error('[updateUserProfile] Save FAILED:', saveErr.message, saveErr.errors);
        return res.status(500).json({ error: 'Failed to save profile', details: saveErr.message });
    }

    res.json({
        success: true,
        data: { username: user.username, email: user.email }
    });
});

const updatePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user || !(await user.matchPassword(currentPassword))) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
});

// For Google users who never set a password — no current password required
const setPassword = asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = newPassword;
    user.authProvider = 'email'; // They now have a real password
    await user.save();

    res.json({ success: true, message: 'Password set successfully' });
});

const saveInvestorDNA = asyncHandler(async (req, res) => {
    const {
        dominant, personaName, personaDescription,
        investorPercent, traderPercent, traits,
        hybridLine, confidence, metrics
    } = req.body;

    const user = await User.findById(req.user._id);
    user.investorDNA = {
        dominant,
        personaName,
        personaDescription,
        investorPercent,
        traderPercent,
        traits: traits || [],
        hybridLine,
        confidence,
        metrics: metrics || {},
        completedAt: new Date()
    };
    // Also update preferredMode to match DNA result
    if (dominant === 'TRADER' || dominant === 'INVESTOR') {
        user.preferredMode = dominant;
    }

    await user.save();
    res.json({ success: true, data: user.investorDNA });
});

const updateNotificationPreferences = asyncHandler(async (req, res) => {
    const { priceAlerts, earningsUpdates, importantNews } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.notificationPreferences) {
        user.notificationPreferences = {};
    }
    if (priceAlerts     !== undefined) user.notificationPreferences.priceAlerts     = Boolean(priceAlerts);
    if (earningsUpdates !== undefined) user.notificationPreferences.earningsUpdates = Boolean(earningsUpdates);
    if (importantNews   !== undefined) user.notificationPreferences.importantNews   = Boolean(importantNews);

    // Mark the nested path as modified (Mongoose quirk for nested objects)
    user.markModified('notificationPreferences');
    await user.save();

    res.json({ success: true, data: user.notificationPreferences });
});

const getMode = asyncHandler(async (req, res) => {
    res.json({ preferredMode: req.user.preferredMode });
});

const updateMode = asyncHandler(async (req, res) => {
    const { mode } = req.body;
    
    const user = await User.findById(req.user._id);

    user.preferredMode = mode;
    await user.save();
    res.json({ message: "Mode updated", preferredMode: user.preferredMode });
});

// Investor Dashboard APIs Implementation

const getUserPortfolio = asyncHandler(async (req, res) => {
    const riskData = await calculatePortfolioRisk(req.user._id);
    const portfolio = await Portfolio.findOne({ user: req.user._id });
    
    // Calculate total investment (sum of qty * avgBuyPrice)
    const totalInvestment = (portfolio?.holdings || []).reduce((sum, h) => sum + (h.quantity * h.avgBuyPrice), 0);
    const currentValue = riskData.totalValue - (portfolio?.cashBalance || 100000); // Only holdings value
    const pnlValue = currentValue - totalInvestment;
    const pnlPercent = totalInvestment > 0 ? (pnlValue / totalInvestment) * 100 : 0;
    const dayChange = (currentValue * 0.012) * (Math.random() > 0.5 ? 1 : -1); // Mock day change

    res.json({
        totalInvestment: Number(totalInvestment.toFixed(2)),
        currentValue: Number(currentValue.toFixed(2)),
        overallPnL: Number(pnlValue.toFixed(2)),
        overallPnLPercent: Number(pnlPercent.toFixed(2)),
        dayChange: Number(dayChange.toFixed(2)),
        dayChangePercent: Number(((dayChange / currentValue) * 100).toFixed(2)),
        riskLevel: riskData.riskLevel,
        sectorWeights: riskData.sectorWeights,
        chartData: [2100, 2150, 2120, 2180, 2200, 2190, 2250] // Mock growth chart
    });
});

const getUserPerformance = asyncHandler(async (req, res) => {
    // Mock performance comparison with Nifty 50
    res.json({
        portfolioReturn: 12.8,
        indexReturn: 8.6,
        alpha: 4.2,
        timeframe: '1Y',
        history: [
            { date: '2024-01', portfolio: 100, index: 100 },
            { date: '2024-02', portfolio: 105, index: 103 },
            { date: '2024-03', portfolio: 102, index: 101 },
            { date: '2024-04', portfolio: 110, index: 106 },
            { date: '2024-05', portfolio: 115, index: 108 }
        ]
    });
});

const getUserHoldings = asyncHandler(async (req, res) => {
    const riskData = await calculatePortfolioRisk(req.user._id);
    const holdings = riskData.concentration.map(c => ({
        symbol: c.symbol,
        sector: c.sector,
        currentPrice: c.price,
        allocation: c.weightPct,
        value: c.value
    }));
    
    res.json(holdings);
});

const getUserInsights = asyncHandler(async (req, res) => {
    const riskData = await calculatePortfolioRisk(req.user._id);
    const insights = [];
    
    if (riskData.riskLevel === 'high') {
        insights.push({ type: 'warning', text: "Your portfolio risk is high. Consider diversifying into defensive sectors." });
    }
    
    if (riskData.concentration.length > 0 && riskData.concentration[0].weightPct > 30) {
        insights.push({ type: 'info', text: `High exposure to ${riskData.concentration[0].symbol} (${riskData.concentration[0].weightPct.toFixed(1)}%). Consider rebalancing.` });
    }

    if (riskData.sectorWeights.length > 0 && riskData.sectorWeights[0].weightPct > 40) {
        insights.push({ type: 'info', text: `${riskData.sectorWeights[0].name} sector allocation (${riskData.sectorWeights[0].weightPct.toFixed(1)}%) is higher than typical benchmarks.` });
    }

    // Dynamic positive insight
    const user = req.user;
    if (user.investorDNA?.personaName) {
        insights.push({ type: 'success', text: `Your ${user.investorDNA.personaName} persona is currently aligned with the market mood.` });
    } else {
        insights.push({ type: 'success', text: "Portfolio strategy is currently aligned with market mood." });
    }

    res.json(insights);
});

const getUserNews = asyncHandler(async (req, res) => {
    // Mock news relevant to portfolio
    res.json([
        { title: "Reliance Industries shares hit record high as profits soar", source: "Mint", time: "2h ago", sentiment: "positive" },
        { title: "Infosys Q4 results: What to expect from IT major?", source: "MoneyControl", time: "5h ago", sentiment: "neutral" },
        { title: "TATA Motors wins massive EV order in Europe", source: "Bloomberg", time: "1d ago", sentiment: "positive" }
    ]);
});

const getUserEvents = asyncHandler(async (req, res) => {
    // Mock upcoming events for held stocks
    res.json([
        { symbol: "RELIANCE", event: "Q4 Earnings Call", date: "May 25, 2024", type: "earnings" },
        { symbol: "INFY", event: "Dividend Record Date", date: "June 02, 2024", type: "dividend" },
        { symbol: "TATAMOTORS", event: "Annual General Meeting", date: "June 15, 2024", type: "agm" }
    ]);
});

const forgotPassword = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return res.status(404).json({ error: 'There is no user with that email' });
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    await user.save({ validateBeforeSave: false });

    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    const message = `You are receiving this email because you (or someone else) has requested the reset of a password. Please click the link below to reset your password: \n\n ${resetUrl}`;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Password recovery link',
            message,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #10706B;">Password Reset Request</h2>
                    <p>You are receiving this email because you (or someone else) has requested the reset of a password for your RADAR account.</p>
                    <p>Please click the button below to reset your password. This link is valid for 10 minutes.</p>
                    <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #10706B; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
                    <p style="margin-top: 20px; font-size: 0.8em; color: #777;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
                </div>
            `
        });

        res.status(200).json({ success: true, data: 'Email sent' });
    } catch (err) {
        console.error(err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        return res.status(500).json({ error: 'Email could not be sent' });
    }
});

const resetPassword = asyncHandler(async (req, res) => {
    // Get hashed token
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(req.params.resetToken)
        .digest('hex');

    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res.status(200).json({
        success: true,
        data: 'Password reset successful',
        token: generateToken(user._id)
    });
});

module.exports = { 
    registerUser, 
    loginUser, 
    googleAuth,
    forgotPassword,
    resetPassword,
    getUserProfile,
    updateUserProfile,
    updatePassword,
    setPassword,
    saveInvestorDNA,
    updateNotificationPreferences,
    getMode, 
    updateMode, 
    googleAuth,
    getUserPortfolio,
    getUserPerformance,
    getUserHoldings,
    getUserInsights,
    getUserNews,
    getUserEvents
};
