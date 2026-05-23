const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getOrCreateDevUser = async () => {
    let u = await User.findOne();
    if (!u) {
        const dummy = new User({
            username: 'devuser',
            email: 'dev@radar.com',
            password: 'password123',
            preferredMode: 'INVESTOR'
        });
        await dummy.save();
        u = dummy;
    }
    return u;
};

const authMiddleware = async (req, res, next) => {
    let token;

    // Check for development bypass
    const isBypassEnabled = process.env.DEV_BYPASS_AUTH === 'true';

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id);

            if (!req.user) {
                if (isBypassEnabled) {
                    req.user = await getOrCreateDevUser();
                    return next();
                }
                return res.status(401).json({ error: 'Not authorized, user not found' });
            }

            next();
        } catch (error) {
            if (isBypassEnabled) {
                req.user = await getOrCreateDevUser();
                return next();
            }
            const reason = error?.name === 'JsonWebTokenError' ? 'invalid signature' : error?.message || 'unknown';
            console.warn(`[auth] Token rejected (${reason}) — client should re-login`);
            res.status(401).json({ error: 'Not authorized, token failed' });
        }
    } else {
        // Support legacy x-auth-token header
        if (req.headers['x-auth-token']) {
            try {
                token = req.headers['x-auth-token'];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = await User.findById(decoded.id);
                if (!req.user) {
                    if (isBypassEnabled) {
                        req.user = await getOrCreateDevUser();
                        return next();
                    }
                    return res.status(401).json({ error: 'Not authorized, user not found' });
                }
                next();
            } catch (error) {
                if (isBypassEnabled) {
                    req.user = await getOrCreateDevUser();
                    return next();
                }
                res.status(401).json({ error: 'Not authorized, token failed' });
            }
        } else {
            if (isBypassEnabled) {
                req.user = await getOrCreateDevUser();
                if (req.user) {
                    return next();
                }
                return res.status(401).json({ error: 'Not authorized, no users in DB to bypass' });
            }
            res.status(401).json({ error: 'Not authorized, no token' });
        }
    }
};

module.exports = { authMiddleware };
