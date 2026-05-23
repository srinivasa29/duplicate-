const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // Create a transporter
    // For production, use a real service like SendGrid, Mailgun, or Gmail
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: process.env.SMTP_PORT || 2525,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your_') || !process.env.SMTP_PASS) {
        console.warn('⚠️ SMTP credentials not configured. Skipping email send to:', options.to || options.email);
        return;
    }

    const message = {
        from: `${process.env.FROM_NAME || 'RADAR Support'} <${process.env.FROM_EMAIL || 'noreply@radar.com'}>`,
        to: options.to || options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
        replyTo: options.replyTo,
    };

    try {
        const info = await transporter.sendMail(message);
        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Failed to send email:', error.message);
        // We do not throw here to prevent crashing calling functions unless absolutely required
        return null;
    }
};

module.exports = sendEmail;
