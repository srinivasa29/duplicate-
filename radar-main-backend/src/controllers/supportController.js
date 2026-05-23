const asyncHandler = require('express-async-handler');
const SupportMessage = require('../models/SupportMessage');
const sendEmail = require('../services/mailService');

const normalizeString = (value) => String(value || '').trim();

const submitSupportMessage = asyncHandler(async (req, res) => {
    const name = normalizeString(req.body.name || req.body.fullName);
    const email = normalizeString(req.body.email).toLowerCase();
    const subject = normalizeString(req.body.subject || req.body.topic);
    const message = normalizeString(req.body.message || req.body.comments);
    const page = normalizeString(req.body.page || req.body.source || 'support');

    if (!name || !email || !subject || !message) {
        return res.status(400).json({
            success: false,
            error: 'Name, email, subject, and message are required',
        });
    }

    const supportMessage = await SupportMessage.create({
        userId: req.user?._id || null,
        name,
        email,
        subject,
        message,
        page,
    });

    const supportInbox = process.env.SUPPORT_EMAIL || process.env.FROM_EMAIL || 'noreply@radar.com';
    await sendEmail({
        to: supportInbox,
        replyTo: email,
        subject: `[Support] ${subject}`,
        message: `Name: ${name}\nEmail: ${email}\nPage: ${page}\n\n${message}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
                <h2 style="margin: 0 0 12px;">New Support Message</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Page:</strong> ${page}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <div style="margin-top: 16px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
                    ${String(message).replace(/\n/g, '<br />')}
                </div>
            </div>
        `,
    });

    res.status(201).json({
        success: true,
        message: 'Support message received and emailed',
        data: {
            _id: supportMessage._id,
            name: supportMessage.name,
            email: supportMessage.email,
            subject: supportMessage.subject,
            message: supportMessage.message,
            page: supportMessage.page,
            status: supportMessage.status,
            createdAt: supportMessage.createdAt,
        },
    });
});

module.exports = {
    submitSupportMessage,
};
