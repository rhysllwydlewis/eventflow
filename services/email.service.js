const postmark = require('postmark');
const logger = require('../utils/logger');

let client = null;

function getEmailClient() {
  if (!client && process.env.POSTMARK_API_TOKEN) {
    client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN);
  }
  return client;
}

async function sendEmail({ to, subject, text, html }) {
  const emailClient = getEmailClient();
  if (!emailClient) {
    logger.warn('Email not configured, skipping send');
    return false;
  }

  try {
    await emailClient.sendEmail({
      From: process.env.FROM_EMAIL || 'noreply@event-flow.co.uk',
      To: to,
      Subject: subject,
      TextBody: text,
      HtmlBody: html,
    });
    logger.info(`Email sent to ${to}`);
    return true;
  } catch (error) {
    logger.error('Email failed:', error);
    throw error;
  }
}

module.exports = { sendEmail };
