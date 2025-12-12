/**
 * Mailgun Email Usage Examples
 * 
 * This file demonstrates how to use the Mailgun utility for various email scenarios.
 * These examples can be used as reference or copied into your application code.
 */

'use strict';

const mailgun = require('./utils/mailgun');
const { read } = require('./store');

/**
 * Example 1: Send Verification Email on User Registration
 * 
 * This is called automatically during registration in routes/auth.js
 * but shown here for reference.
 */
async function exampleVerificationEmail() {
  // Simulate user registration
  const newUser = {
    id: 'usr_12345',
    name: 'Jane Smith',
    email: 'jane@example.com',
    verified: false
  };
  
  const verificationToken = 'verify_abc123xyz';
  
  try {
    // Send verification email with template
    const result = await mailgun.sendVerificationEmail(newUser, verificationToken);
    console.log('Verification email sent:', result);
    
    // Email includes:
    // - Branded HTML template
    // - Verification link valid for 24 hours
    // - Plain text fallback
  } catch (err) {
    console.error('Failed to send verification email:', err);
  }
}

/**
 * Example 2: Send Marketing Email with Preference Check
 * 
 * Marketing emails must respect user preferences.
 * Users who have notify_marketing=false will not receive these emails.
 */
async function exampleMarketingEmail() {
  // Get user from database
  const users = read('users');
  const user = users.find(u => u.email === 'customer@example.com');
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  try {
    // Send marketing email (automatically checks notify_marketing preference)
    const result = await mailgun.sendMarketingEmail(
      user,
      'Exciting New Features Available! 🎉',
      'We\'ve just launched amazing new features to help you plan the perfect event. Check them out today!',
      {
        templateData: {
          ctaText: 'Explore New Features',
          ctaLink: 'https://eventflow.com/features'
        }
      }
    );
    
    if (result) {
      console.log('Marketing email sent successfully');
    } else {
      console.log('User has opted out of marketing emails');
    }
  } catch (err) {
    console.error('Failed to send marketing email:', err);
  }
}

/**
 * Example 3: Send Transactional Notification
 * 
 * Transactional emails (account notifications, security alerts) respect
 * the notify_account preference but should generally be enabled by default.
 */
async function exampleNotificationEmail() {
  const users = read('users');
  const user = users.find(u => u.email === 'customer@example.com');
  
  if (!user) return;
  
  try {
    // Send account notification
    const result = await mailgun.sendNotificationEmail(
      user,
      'Booking Confirmed',
      'Your booking for "Elegant Venue" on June 15, 2024 has been confirmed. The venue owner will contact you shortly with more details.'
    );
    
    if (result) {
      console.log('Notification email sent successfully');
    } else {
      console.log('User has disabled account notifications');
    }
  } catch (err) {
    console.error('Failed to send notification email:', err);
  }
}

/**
 * Example 4: Send Custom HTML Email
 * 
 * For emails that don't fit existing templates, you can send custom HTML.
 */
async function exampleCustomHtmlEmail() {
  try {
    const result = await mailgun.sendMail({
      to: 'user@example.com',
      subject: 'Your Monthly Event Planning Report',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h1>Monthly Report</h1>
            <p>Hi there,</p>
            <p>Here's your event planning activity for this month:</p>
            <ul>
              <li>5 suppliers viewed</li>
              <li>2 venues saved</li>
              <li>3 messages sent</li>
            </ul>
            <p>Keep planning!</p>
          </body>
        </html>
      `,
      text: 'Monthly Report\n\nHere\'s your event planning activity for this month:\n- 5 suppliers viewed\n- 2 venues saved\n- 3 messages sent',
      tags: ['monthly-report', 'transactional']
    });
    
    console.log('Custom email sent:', result);
  } catch (err) {
    console.error('Failed to send custom email:', err);
  }
}

/**
 * Example 5: Send Email Using Existing Template
 * 
 * Use the existing templates in email-templates/ directory.
 */
async function exampleTemplateEmail() {
  try {
    const result = await mailgun.sendMail({
      to: 'user@example.com',
      subject: 'Welcome to EventFlow!',
      template: 'welcome', // Uses email-templates/welcome.html
      templateData: {
        name: 'John Doe',
        loginLink: 'https://eventflow.com/login',
        supportEmail: 'support@eventflow.com'
      },
      tags: ['welcome', 'onboarding']
    });
    
    console.log('Template email sent:', result);
  } catch (err) {
    console.error('Failed to send template email:', err);
  }
}

/**
 * Example 6: Send Password Reset Email
 * 
 * Password reset with secure token.
 */
async function examplePasswordResetEmail() {
  const users = read('users');
  const user = users.find(u => u.email === 'user@example.com');
  
  if (!user) return;
  
  const resetToken = 'reset_abc123xyz';
  const resetLink = `https://eventflow.com/reset-password.html?token=${resetToken}`;
  
  try {
    const result = await mailgun.sendMail({
      to: user.email,
      subject: 'Reset Your Password - EventFlow',
      template: 'password-reset',
      templateData: {
        name: user.name,
        resetLink: resetLink,
        expiryHours: 1
      },
      tags: ['password-reset', 'transactional']
    });
    
    console.log('Password reset email sent:', result);
  } catch (err) {
    console.error('Failed to send password reset email:', err);
  }
}

/**
 * Example 7: Bulk Email Campaign (Respecting Preferences)
 * 
 * Send marketing emails to all opted-in users.
 */
async function exampleBulkMarketingCampaign() {
  const users = read('users');
  
  // Filter users who opted in to marketing
  const marketingOptInUsers = users.filter(u => u.notify_marketing === true);
  
  console.log(`Sending campaign to ${marketingOptInUsers.length} opted-in users`);
  
  const subject = 'Limited Time Offer: Pro Features 50% Off!';
  const message = 'Upgrade to EventFlow Pro and get access to premium features at half price. Offer ends this Friday!';
  
  const results = await Promise.allSettled(
    marketingOptInUsers.map(user => 
      mailgun.sendMarketingEmail(user, subject, message, {
        templateData: {
          ctaText: 'Upgrade Now',
          ctaLink: 'https://eventflow.com/upgrade'
        }
      })
    )
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  console.log(`Campaign complete: ${successful} sent, ${failed} failed`);
}

/**
 * Example 8: Check Mailgun Status
 * 
 * Verify Mailgun is properly configured.
 */
function exampleCheckStatus() {
  const status = mailgun.getMailgunStatus();
  
  console.log('Mailgun Status:', status);
  
  if (status.enabled) {
    console.log('✓ Mailgun is enabled and ready to send emails');
    console.log(`  Domain: ${status.domain}`);
    console.log(`  From: ${status.from}`);
    console.log(`  API Base URL: ${status.baseUrl}`);
  } else {
    console.log('✗ Mailgun is not configured');
    console.log('  Emails will be saved to outbox/ folder instead');
  }
}

/**
 * Example 9: Send Email to Multiple Recipients
 * 
 * Send the same email to multiple users at once.
 */
async function exampleMultipleRecipients() {
  try {
    const result = await mailgun.sendMail({
      to: ['admin@example.com', 'manager@example.com', 'support@example.com'],
      subject: 'New Supplier Pending Approval',
      text: 'A new supplier registration is pending approval in the admin dashboard.',
      tags: ['admin-notification', 'transactional']
    });
    
    console.log('Email sent to multiple recipients:', result);
  } catch (err) {
    console.error('Failed to send to multiple recipients:', err);
  }
}

/**
 * Example 10: Send with Mailgun Tags for Tracking
 * 
 * Tags help you track email performance in Mailgun dashboard.
 */
async function exampleEmailWithTags() {
  try {
    const result = await mailgun.sendMail({
      to: 'customer@example.com',
      subject: 'Your Event is Tomorrow!',
      text: 'Just a reminder that your event at Elegant Venue is scheduled for tomorrow at 6 PM.',
      tags: ['reminder', 'event-notification', 'transactional', 'high-priority']
    });
    
    console.log('Tagged email sent:', result);
    // View tag statistics in Mailgun dashboard under Analytics
  } catch (err) {
    console.error('Failed to send tagged email:', err);
  }
}

// Export examples for testing or documentation
module.exports = {
  exampleVerificationEmail,
  exampleMarketingEmail,
  exampleNotificationEmail,
  exampleCustomHtmlEmail,
  exampleTemplateEmail,
  examplePasswordResetEmail,
  exampleBulkMarketingCampaign,
  exampleCheckStatus,
  exampleMultipleRecipients,
  exampleEmailWithTags
};

// If run directly, show status
if (require.main === module) {
  console.log('\n=== Mailgun Email Examples ===\n');
  exampleCheckStatus();
  console.log('\nRun individual examples by importing this file:');
  console.log('  const examples = require(\'./mailgun-examples\');');
  console.log('  await examples.exampleVerificationEmail();');
  console.log('\nSee MAILGUN_SETUP.md for full documentation.\n');
}
