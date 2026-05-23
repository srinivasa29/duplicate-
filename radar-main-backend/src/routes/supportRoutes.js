const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { submitSupportMessage } = require('../controllers/supportController');
const { validateRequest } = require('../middleware/validationMiddleware');

router.post(
    '/messages',
    [
        body('name').optional().isString().trim().isLength({ min: 2, max: 120 }),
        body('fullName').optional().isString().trim().isLength({ min: 2, max: 120 }),
        body('email').exists().isEmail().withMessage('Valid email is required'),
        body('subject').optional().isString().trim().isLength({ min: 2, max: 180 }),
        body('topic').optional().isString().trim().isLength({ min: 2, max: 180 }),
        body('message').exists().isString().trim().isLength({ min: 10, max: 5000 }),
        body('comments').optional().isString().trim().isLength({ min: 10, max: 5000 }),
        validateRequest,
    ],
    submitSupportMessage,
);

module.exports = router;
