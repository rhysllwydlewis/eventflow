/**
 * Postmark Email Utility (POSTMARK ONLY)
 * Provides secure, server-side email sending exclusively via Postmark API
 *
 * Environment Variables Required:
 * - POSTMARK_API_KEY: Your Postmark Server API key
 * - POSTMARK_FROM: Sender email address (must be verified in Postmark - use admin@event-flow.co.uk)
 * - BASE_URL or APP_BASE_URL: Application base URL for email links
 *
 * TEMPLATE USAGE:
 * ===============
 * This utility uses LOCAL HTML templates from /email-templates/ directory.
 * No Postmark-hosted templates are required.
 *
 * Example:
 *    sendMail({
 *      to: 'user@example.com',
 *      subject: 'Password Reset',
 *      template: 'password-reset',
 *      templateData: { name: 'John', resetLink: 'https://...' },
 *      messageStream: 'password-reset'  // Use 'password-reset' stream for resets
 *    });
 *
 * MESSAGE STREAMS:
 * ================
 * - 'outbound': Default for transactional emails (verification, notifications)
 * - 'password-reset': For password reset emails
 * - 'broadcasts': For marketing emails
 *
 * FALLBACK BEHAVIOR:
 * ==================
 * If Postmark is not configured (missing POSTMARK_API_KEY), emails are saved to /outbox folder.
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Lazy-load Postmark to avoid errors if not configured
let postmarkClient = null;
let POSTMARK_ENABLED = false;

// Configuration - POSTMARK_API_KEY and POSTMARK_FROM are required
const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY;
const POSTMARK_FROM = process.env.POSTMARK_FROM || 'noreply@localhost';
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;

/**
 * Initialize Postmark client
 */
function initializePostmark() {
  if (!POSTMARK_API_KEY) {
    console.warn('⚠️  Postmark not configured: POSTMARK_API_KEY environment variable required');
    console.warn('   Emails will be saved to /outbox folder instead');
    console.warn('   Set POSTMARK_API_KEY and POSTMARK_FROM in your .env file');
    return false;
  }

  try {
    const postmark = require('postmark');
    postmarkClient = new postmark.ServerClient(POSTMARK_API_KEY);

    POSTMARK_ENABLED = true;
    console.log(`✅ Postmark configured successfully`);
    console.log(`   From: ${POSTMARK_FROM}`);
    console.log(`   Base URL: ${APP_BASE_URL}`);
    // Only log API key preview in development for debugging
    if (process.env.NODE_ENV !== 'production') {
      console.log(`   API key: ${POSTMARK_API_KEY.substring(0, 8)}...`);
    }
    return true;
  } catch (err) {
    console.error('❌ Failed to initialize Postmark:', err.message);
    console.error('   Run: npm install postmark');
    return false;
  }
}

// Initialize on module load
initializePostmark();

/**
 * Generate secure unsubscribe token for email address
 * @param {string} email - User email address
 * @returns {string} HMAC-SHA256 token
 */
function generateUnsubscribeToken(email) {
  return crypto.createHmac('sha256', UNSUBSCRIBE_SECRET).update(email.toLowerCase()).digest('hex');
}

/**
 * Verify unsubscribe token matches email
 * @param {string} email - User email address
 * @param {string} token - Token to verify
 * @returns {boolean} True if token is valid for this email
 */
function verifyUnsubscribeToken(email, token) {
  const expectedToken = generateUnsubscribeToken(email);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}

/**
 * Mask email address for logging in production
 * @param {string} email - Email address to mask
 * @returns {string} Masked email address
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') {
    return '***';
  }
  const [localPart, domain] = email.split('@');
  if (!domain) {
    return '***';
  }

  // Show first char of local part and domain
  const maskedLocal =
    localPart.length > 1 ? localPart[0] + '*'.repeat(Math.min(localPart.length - 1, 5)) : '*';
  return `${maskedLocal}@${domain}`;
}

/**
 * Load and process email template
 * @param {string} templateName - Name of template file (without .html)
 * @param {Object} data - Template variables to replace
 * @returns {string|null} Processed HTML template or null
 */
function loadEmailTemplate(templateName, data = {}) {
  try {
    const templatePath = path.join(__dirname, '..', 'email-templates', `${templateName}.html`);
    if (!fs.existsSync(templatePath)) {
      console.error(`Email template not found: ${templateName}.html`);
      return null;
    }

    let html = fs.readFileSync(templatePath, 'utf8');

    // Helper to escape HTML entities to prevent XSS
    const escapeHtml = text => {
      if (typeof text !== 'string') {
        return text;
      }
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    // Replace template variables with HTML-escaped values
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      // Don't escape if the value contains HTML tags (for message content)
      const value = key === 'message' || key === 'html' ? data[key] : escapeHtml(data[key]);
      html = html.replace(regex, value || '');
    });

    // Add current year
    html = html.replace(/{{year}}/g, new Date().getFullYear());

    // Add base URL
    html = html.replace(/{{baseUrl}}/g, APP_BASE_URL);

    return html;
  } catch (err) {
    console.error('Error loading email template:', err.message);
    return null;
  }
}

/**
 * Send email via Postmark (local templates only)
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.text] - Plain text email body
 * @param {string} [options.html] - HTML email body
 * @param {string} [options.template] - Template name (loads from email-templates/)
 * @param {Object} [options.templateData] - Data for template variables
 * @param {string} [options.from] - Sender email (defaults to POSTMARK_FROM)
 * @param {string|string[]} [options.tags] - Postmark tags for tracking (max 10)
 * @param {boolean} [options.trackOpens] - Track email opens (default: true)
 * @param {string} [options.trackLinks] - Track link clicks (default: 'HtmlAndText')
 * @param {string} [options.messageStream] - Postmark message stream (default: 'outbound', use 'password-reset' for resets)
 * @returns {Promise<Object>} Postmark response object
 * @throws {Error} If email sending fails or required fields are missing
 */
async function sendMail(options) {
  if (!options || !options.to) {
    const error = new Error('Missing required email field: to');
    console.error('❌ Email send failed:', error.message);
    throw error;
  }

  const {
    to,
    subject,
    text,
    html,
    template,
    templateData = {},
    from = POSTMARK_FROM,
    tags,
    trackOpens = true,
    trackLinks = 'HtmlAndText',
  } = options;

  // Log email attempt for debugging (mask email in production)
  const isProduction = process.env.NODE_ENV === 'production';
  const recipientDisplay = isProduction
    ? maskEmail(Array.isArray(to) ? to[0] : to)
    : Array.isArray(to)
      ? to.join(',')
      : to;

  console.log(`📧 Attempting to send email to ${recipientDisplay}`);
  console.log(`   Subject: ${subject || '(from template)'}`);
  console.log(`   Template: ${template || 'none'}`);
  console.log(`   Message Stream: ${options.messageStream || 'outbound'}`);

  // Check if Postmark is enabled
  if (!POSTMARK_ENABLED || !postmarkClient) {
    console.warn('⚠️  Postmark not configured - saving email to /outbox instead');

    // Load template for outbox if needed
    let outboxHtml = html;
    if (template && !html) {
      outboxHtml = loadEmailTemplate(template, templateData);
    }

    // Save to outbox for development/testing
    const outboxData = {
      To: Array.isArray(to) ? to.join(',') : to,
      From: from,
      Subject: subject || '(from template)',
      HtmlBody: outboxHtml,
      TextBody: text,
      Template: template,
    };
    saveEmailToOutbox(outboxData);

    return {
      status: 'disabled',
      message: 'Postmark not configured. Email saved to outbox.',
      MessageID: `outbox-${Date.now()}`,
    };
  }

  // Require subject for all emails
  if (!subject) {
    const error = new Error('Missing required email field: subject');
    console.error('❌ Email send failed:', error.message);
    throw error;
  }

  // Load local template if specified and HTML not provided
  let emailHtml = html;
  if (template && !html) {
    console.log(`   Loading local template: ${template}.html`);
    emailHtml = loadEmailTemplate(template, templateData);
    if (!emailHtml) {
      const error = new Error(`Failed to load email template: ${template}`);
      console.error('❌ Email send failed:', error.message);
      throw error;
    }
  }

  // Build email data for Postmark
  const emailData = {
    From: from,
    To: Array.isArray(to) ? to.join(',') : to,
    Subject: subject,
    TrackOpens: trackOpens,
    TrackLinks: trackLinks,
    MessageStream: options.messageStream || 'outbound',
  };

  // Add body content
  if (emailHtml) {
    emailData.HtmlBody = emailHtml;
    // Provide text fallback if HTML is used
    if (!text) {
      // Simple HTML to text conversion
      emailData.TextBody = emailHtml
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      emailData.TextBody = text;
    }
  } else if (text) {
    emailData.TextBody = text;
  } else {
    const error = new Error('Email must have either text, html, or template content');
    console.error('❌ Email send failed:', error.message);
    throw error;
  }

  // Add tags if provided (Postmark supports up to 10 tags)
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    emailData.Tag = tagArray.slice(0, 10).join(',');
  }

  try {
    const response = await postmarkClient.sendEmail(emailData);
    console.log(`✅ Email sent successfully via Postmark`);
    console.log(`   To: ${emailData.To}`);
    console.log(`   Subject: ${emailData.Subject}`);
    console.log(`   MessageID: ${response.MessageID}`);
    console.log(`   Stream: ${emailData.MessageStream}`);
    return response;
  } catch (err) {
    console.error('❌ Postmark send error:', err.message);
    console.error('   To:', emailData.To);
    console.error('   Subject:', emailData.Subject);

    // Save to outbox as fallback for debugging
    saveEmailToOutbox(emailData);

    // Re-throw error so calling code can handle it (e.g., rollback)
    throw new Error(`Failed to send email via Postmark: ${err.message}`);
  }
}

/**
 * Save email to outbox folder for development/testing
 * @param {Object} emailData - Email data to save
 */
function saveEmailToOutbox(emailData) {
  try {
    const outboxDir = path.join(__dirname, '..', 'outbox');
    if (!fs.existsSync(outboxDir)) {
      fs.mkdirSync(outboxDir, { recursive: true });
    }

    const timestamp = Date.now();
    const filename = `email-${timestamp}.eml`;
    const content = `To: ${emailData.To}
From: ${emailData.From}
Subject: ${emailData.Subject}

${emailData.HtmlBody || emailData.TextBody}
`;

    fs.writeFileSync(path.join(outboxDir, filename), content, 'utf8');
    console.log(`Email saved to outbox: ${filename}`);
  } catch (err) {
    console.error('Failed to save email to outbox:', err.message);
  }
}

/**
 * Send verification email to user
 * @param {Object} user - User object with email, name
 * @param {string} verificationToken - Verification token
 * @returns {Promise<Object>} Send result
 * @throws {Error} If email sending fails
 */
async function sendVerificationEmail(user, verificationToken) {
  const verificationLink = `${APP_BASE_URL}/verify?token=${encodeURIComponent(verificationToken)}`;

  console.log(`📧 Sending verification email to ${user.email}`);

  return sendMail({
    to: user.email,
    subject: 'Confirm your EventFlow account',
    template: 'verification',
    templateData: {
      name: user.name || 'there',
      verificationLink: verificationLink,
    },
    tags: ['verification', 'transactional'],
    messageStream: 'outbound',
  });
}

/**
 * Send password reset email to user
 * @param {Object} user - User object with email, name
 * @param {string} resetToken - Password reset token
 * @returns {Promise<Object>} Send result
 * @throws {Error} If email sending fails
 */
async function sendPasswordResetEmail(user, resetToken) {
  const resetLink = `${APP_BASE_URL}/reset-password.html?token=${encodeURIComponent(resetToken)}`;

  console.log(`📧 Sending password reset email to ${user.email}`);

  return sendMail({
    to: user.email,
    subject: 'Reset your EventFlow password',
    template: 'password-reset',
    templateData: {
      name: user.name || 'there',
      resetLink: resetLink,
    },
    tags: ['password-reset', 'transactional'],
    messageStream: 'password-reset', // Use dedicated password-reset stream
  });
}

/**
 * Send welcome email to newly verified user
 * @param {Object} user - User object with email, name
 * @returns {Promise<Object>} Send result
 * @throws {Error} If email sending fails
 */
async function sendWelcomeEmail(user) {
  console.log(`📧 Sending welcome email to ${user.email}`);

  return sendMail({
    to: user.email,
    subject: 'Welcome to EventFlow!',
    template: 'welcome',
    templateData: {
      name: user.name || 'there',
    },
    tags: ['welcome', 'transactional'],
    messageStream: 'outbound',
  });
}

/**
 * Send marketing email (respects user preferences)
 * @param {Object} user - User object with email, name, notify_marketing
 * @param {string} subject - Email subject
 * @param {string} message - Email message content
 * @param {Object} [options] - Additional options (template, templateData)
 * @returns {Promise<Object|null>} Send result or null if user opted out
 */
async function sendMarketingEmail(user, subject, message, options = {}) {
  // Check if user has opted in to marketing emails
  if (user.notify_marketing === false) {
    console.log(`Skipping marketing email to ${user.email} (user opted out)`);
    return null;
  }

  // Generate secure unsubscribe link with token
  const unsubscribeToken = generateUnsubscribeToken(user.email);
  const unsubscribeLink = `${APP_BASE_URL}/api/auth/unsubscribe?email=${encodeURIComponent(user.email)}&token=${unsubscribeToken}`;

  // Build message with optional CTA button
  let fullMessage = message;
  if (options.ctaText && options.ctaLink) {
    fullMessage += `\n\n<div style="text-align: center; margin: 24px 0;">
      <a href="${options.ctaLink}" class="cta-button" style="display: inline-block; padding: 14px 28px; background: linear-gradient(180deg, #16c3ad, #0ea896); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px;">${options.ctaText}</a>
    </div>`;
  }

  const templateData = {
    name: user.name || 'there',
    title: subject,
    message: fullMessage,
    unsubscribeLink: unsubscribeLink,
    ...(options.templateData || {}),
  };

  return sendMail({
    to: user.email,
    subject: subject,
    template: options.template || 'marketing',
    templateData: templateData,
    tags: ['marketing'],
    messageStream: options.messageStream || 'broadcasts',
    ...options,
  });
}

/**
 * Send transactional notification email (respects user preferences)
 * @param {Object} user - User object with email, name, notify_account
 * @param {string} subject - Email subject
 * @param {string} message - Email message content
 * @param {Object} [options] - Additional options (template, templateData)
 * @returns {Promise<Object|null>} Send result or null if user opted out
 */
async function sendNotificationEmail(user, subject, message, options = {}) {
  // Check if user has opted in to account notifications
  if (user.notify_account === false) {
    console.log(`Skipping notification email to ${user.email} (user opted out)`);
    return null;
  }

  const templateData = {
    name: user.name || 'there',
    title: subject,
    message: message,
    ...(options.templateData || {}),
  };

  return sendMail({
    to: user.email,
    subject: subject,
    template: options.template || 'notification',
    templateData: templateData,
    tags: ['notification', 'transactional'],
    messageStream: 'outbound',
    ...options,
  });
}

/**
 * Check if Postmark is properly configured and enabled
 * @returns {boolean} True if Postmark is ready to use
 */
function isPostmarkEnabled() {
  return POSTMARK_ENABLED;
}

/**
 * Get Postmark configuration status
 * @returns {Object} Configuration status
 */
function getPostmarkStatus() {
  return {
    enabled: POSTMARK_ENABLED,
    from: POSTMARK_FROM,
    appBaseUrl: APP_BASE_URL,
    apiKeyConfigured: !!POSTMARK_API_KEY,
  };
}

module.exports = {
  // Core email functions
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendMarketingEmail,
  sendNotificationEmail,

  // Status and utility functions
  isPostmarkEnabled,
  getPostmarkStatus,
  loadEmailTemplate,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
};
