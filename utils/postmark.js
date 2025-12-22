/**
 * Postmark Email Utility
 * Provides secure, server-side email sending via Postmark
 *
 * Environment Variables Required:
 * - POSTMARK_API_KEY or POSTMARK_SERVER_TOKEN: Your Postmark Server API key
 * - POSTMARK_FROM: Default sender email address (must be verified in Postmark)
 * - APP_BASE_URL: Application base URL for email links
 *
 * For production, use verified sender: admin@event-flow.co.uk
 */

'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Lazy-load Postmark to avoid errors if not configured
let postmarkClient = null;
let POSTMARK_ENABLED = false;

// Configuration - use the provided production token
const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY || 
                         process.env.POSTMARK_SERVER_TOKEN || 
                         '5889c784-6208-417f-af17-94f63536db36';
const POSTMARK_FROM = process.env.POSTMARK_FROM || 
                      process.env.FROM_EMAIL || 
                      'admin@event-flow.co.uk';
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const UNSUBSCRIBE_SECRET =
  process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET || 'default-secret-change-in-production';

/**
 * Initialize Postmark client
 */
function initializePostmark() {
  if (!POSTMARK_API_KEY) {
    console.warn('Postmark not configured: POSTMARK_API_KEY required');
    return false;
  }

  try {
    const postmark = require('postmark');
    postmarkClient = new postmark.ServerClient(POSTMARK_API_KEY);

    POSTMARK_ENABLED = true;
    console.log(`✓ Postmark configured with sender: ${POSTMARK_FROM}`);
    return true;
  } catch (err) {
    console.error('Failed to initialize Postmark:', err.message);
    console.log('Install Postmark: npm install postmark');
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
 * Send email via Postmark
 * @param {Object} options - Email options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} [options.text] - Plain text email body
 * @param {string} [options.html] - HTML email body
 * @param {string} [options.template] - Template name (loads from email-templates/)
 * @param {Object} [options.templateData] - Data for template variables
 * @param {string} [options.from] - Sender email (defaults to POSTMARK_FROM)
 * @param {string|string[]} [options.tags] - Postmark tags for tracking (max 10)
 * @param {string} [options.trackOpens] - Track email opens (true/false)
 * @param {string} [options.trackLinks] - Track link clicks ('None', 'HtmlAndText', 'HtmlOnly', 'TextOnly')
 * @returns {Promise<Object>} Postmark response object
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
    from = POSTMARK_FROM,
    tags,
    trackOpens = true,
    trackLinks = 'HtmlAndText',
  } = options;

  // Load template if specified and HTML not provided
  let emailHtml = html;
  if (template && !html) {
    emailHtml = loadEmailTemplate(template, templateData);
  }

  // Build email data for Postmark
  const emailData = {
    From: from,
    To: Array.isArray(to) ? to.join(',') : to,
    Subject: subject,
    TrackOpens: trackOpens,
    TrackLinks: trackLinks,
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
    throw new Error('Email must have either text, html, or template content');
  }

  // Add tags if provided (Postmark supports up to 10 tags)
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    emailData.Tag = tagArray.slice(0, 10).join(',');
  }

  // Add message stream (defaults to 'outbound' for transactional emails)
  emailData.MessageStream = options.messageStream || 'outbound';

  // Check if Postmark is enabled
  if (!POSTMARK_ENABLED || !postmarkClient) {
    console.log('[Postmark Disabled] Would send email:', {
      to: emailData.To,
      subject: emailData.Subject,
      from: emailData.From,
    });

    // Save to outbox for development/testing
    saveEmailToOutbox(emailData);

    return {
      status: 'disabled',
      message: 'Postmark not configured. Email saved to outbox.',
      MessageID: `test-${Date.now()}`,
    };
  }

  try {
    const response = await postmarkClient.sendEmail(emailData);
    console.log(`✓ Email sent via Postmark to ${emailData.To} (${response.MessageID})`);
    return response;
  } catch (err) {
    console.error('Postmark send error:', err.message);
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
  sendMail,
  sendVerificationEmail,
  sendMarketingEmail,
  sendNotificationEmail,
  isPostmarkEnabled,
  getPostmarkStatus,
  loadEmailTemplate,
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  // Backward compatibility aliases
  isMailgunEnabled: isPostmarkEnabled,
  getMailgunStatus: getPostmarkStatus,
};
