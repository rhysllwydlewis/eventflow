/**
 * Mailgun Email Utility
 * Provides secure, server-side email sending via Mailgun
 *
 * Environment Variables Required:
 * - MAILGUN_API_KEY: Your Mailgun API key
 * - MAILGUN_DOMAIN: Your verified Mailgun domain
 * - MAILGUN_BASE_URL: Mailgun API base URL (defaults to EU: https://api.eu.mailgun.net)
 * - MAILGUN_FROM: Default sender email address
 * - APP_BASE_URL: Application base URL for email links
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Lazy-load Mailgun to avoid errors if not configured
let mailgunClient = null;
let MAILGUN_ENABLED = false;

// Configuration
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_BASE_URL = process.env.MAILGUN_BASE_URL || 'https://api.eu.mailgun.net';
const MAILGUN_FROM = process.env.MAILGUN_FROM || process.env.FROM_EMAIL || 'no-reply@eventflow.com';
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const UNSUBSCRIBE_SECRET =
  process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * Initialize Mailgun client
 */
function initializeMailgun() {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.warn('Mailgun not configured: MAILGUN_API_KEY and MAILGUN_DOMAIN required');
    return false;
  }

  try {
    const formData = require('form-data');
    const Mailgun = require('mailgun.js');
    const mailgun = new Mailgun(formData);

    mailgunClient = mailgun.client({
      username: 'api',
      key: MAILGUN_API_KEY,
      url: MAILGUN_BASE_URL,
    });

    MAILGUN_ENABLED = true;
    console.log(`✓ Mailgun configured for domain: ${MAILGUN_DOMAIN} (${MAILGUN_BASE_URL})`);
    return true;
  } catch (err) {
    console.error('Failed to initialize Mailgun:', err.message);
    return false;
  }
}

// Initialize on module load
initializeMailgun();

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
      if (typeof text !== 'string') return text;
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
      // This allows controlled HTML in message field but escapes other fields
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
 * Send email via Mailgun
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.text] - Plain text email body
 * @param {string} [options.html] - HTML email body
 * @param {string} [options.template] - Template name (loads from email-templates/)
 * @param {Object} [options.templateData] - Data for template variables
 * @param {string} [options.from] - Sender email (defaults to MAILGUN_FROM)
 * @param {Object} [options.tags] - Mailgun tags for tracking
 * @returns {Promise<Object>} Mailgun response object
 */
async function sendMail(options) {
  if (!options || !options.to || !options.subject) {
    throw new Error('Missing required email fields: to, subject');
  }

  const {
    to,
    subject,
    text,
    html,
    template,
    templateData = {},
    from = MAILGUN_FROM,
    tags,
  } = options;

  // Load template if specified and HTML not provided
  let emailHtml = html;
  if (template && !html) {
    emailHtml = loadEmailTemplate(template, templateData);
  }

  // Build email data
  const emailData = {
    from: from,
    to: Array.isArray(to) ? to : [to],
    subject: subject,
  };

  // Add body content
  if (emailHtml) {
    emailData.html = emailHtml;
    // Provide text fallback if HTML is used
    if (!text) {
      // Simple HTML to text conversion
      emailData.text = emailHtml
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      emailData.text = text;
    }
  } else if (text) {
    emailData.text = text;
  } else {
    throw new Error('Email must have either text, html, or template content');
  }

  // Add tags if provided
  if (tags) {
    emailData['o:tag'] = Array.isArray(tags) ? tags : [tags];
  }

  // Check if Mailgun is enabled
  if (!MAILGUN_ENABLED || !mailgunClient) {
    console.log('[Mailgun Disabled] Would send email:', {
      to: emailData.to,
      subject: emailData.subject,
      from: emailData.from,
    });

    // Save to outbox for development/testing
    saveEmailToOutbox(emailData);

    return {
      status: 'disabled',
      message: 'Mailgun not configured. Email saved to outbox.',
      id: `test-${Date.now()}`,
    };
  }

  try {
    const response = await mailgunClient.messages.create(MAILGUN_DOMAIN, emailData);
    console.log(`✓ Email sent via Mailgun to ${emailData.to.join(', ')} (${response.id})`);
    return response;
  } catch (err) {
    console.error('Mailgun send error:', err.message);
    // Save to outbox as fallback
    saveEmailToOutbox(emailData);
    throw err;
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
    const content = `To: ${Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to}
From: ${emailData.from}
Subject: ${emailData.subject}

${emailData.html || emailData.text}
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
 */
async function sendVerificationEmail(user, verificationToken) {
  const verificationLink = `${APP_BASE_URL}/verify.html?token=${encodeURIComponent(verificationToken)}`;

  return sendMail({
    to: user.email,
    subject: 'Confirm your EventFlow account',
    template: 'verification',
    templateData: {
      name: user.name || 'there',
      verificationLink: verificationLink,
    },
    tags: ['verification', 'transactional'],
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
    ...options,
  });
}

/**
 * Check if Mailgun is properly configured and enabled
 * @returns {boolean} True if Mailgun is ready to use
 */
function isMailgunEnabled() {
  return MAILGUN_ENABLED;
}

/**
 * Get Mailgun configuration status
 * @returns {Object} Configuration status
 */
function getMailgunStatus() {
  return {
    enabled: MAILGUN_ENABLED,
    domain: MAILGUN_DOMAIN || 'not_configured',
    baseUrl: MAILGUN_BASE_URL,
    from: MAILGUN_FROM,
    appBaseUrl: APP_BASE_URL,
  };
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendMarketingEmail,
  sendNotificationEmail,
  isMailgunEnabled,
  getMailgunStatus,
  loadEmailTemplate,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
};
