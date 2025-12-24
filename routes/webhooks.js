/**
 * Postmark Webhook Routes
 * Handles incoming webhook events from Postmark
 *
 * Webhook Events:
 * - Delivery: Email was successfully delivered
 * - Bounce: Email bounced (hard or soft)
 * - SpamComplaint: Recipient marked email as spam
 * - SubscriptionChange: Recipient unsubscribed via link tracker
 * - Open: Email was opened (if tracking enabled)
 * - Click: Link in email was clicked (if tracking enabled)
 *
 * Configuration in Postmark:
 * 1. Go to: https://account.postmarkapp.com/servers/[YOUR-SERVER]/webhooks
 * 2. Add webhook URL: https://your-domain.com/api/webhooks/postmark
 * 3. Select events to track (recommended: Delivery, Bounce, SpamComplaint)
 * 4. Test webhook using Postmark's test feature
 *
 * Security: Webhook requests should ideally be verified using Basic Auth
 * or custom headers configured in Postmark dashboard
 */

'use strict';

const express = require('express');
const router = express.Router();

/**
 * POST /api/webhooks/postmark
 * Handle Postmark webhook events
 *
 * Event Types:
 * - Delivery: { RecordType: "Delivery", MessageID, Recipient, DeliveredAt, ... }
 * - Bounce: { RecordType: "Bounce", MessageID, Email, BouncedAt, Type, Description, ... }
 * - SpamComplaint: { RecordType: "SpamComplaint", MessageID, Email, BouncedAt, ... }
 * - SubscriptionChange: { RecordType: "SubscriptionChange", Recipient, ... }
 * - Open: { RecordType: "Open", MessageID, Recipient, ReceivedAt, ... }
 * - Click: { RecordType: "Click", MessageID, Recipient, OriginalLink, ... }
 */
router.post('/postmark', express.json(), async (req, res) => {
  try {
    const event = req.body;

    // Log the webhook event for monitoring
    console.log('📬 Postmark webhook received:', {
      type: event.RecordType,
      messageId: event.MessageID,
      recipient: event.Recipient || event.Email,
      timestamp: new Date().toISOString(),
    });

    // Handle different event types
    switch (event.RecordType) {
      case 'Delivery':
        handleDelivery(event);
        break;

      case 'Bounce':
        handleBounce(event);
        break;

      case 'SpamComplaint':
        handleSpamComplaint(event);
        break;

      case 'SubscriptionChange':
        handleSubscriptionChange(event);
        break;

      case 'Open':
        handleOpen(event);
        break;

      case 'Click':
        handleClick(event);
        break;

      default:
        console.log(`⚠️  Unknown webhook event type: ${event.RecordType}`);
    }

    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('❌ Error processing Postmark webhook:', err);
    // Still respond with 200 to prevent Postmark from retrying
    res.status(200).json({ ok: true, error: err.message });
  }
});

/**
 * Handle successful email delivery
 */
function handleDelivery(event) {
  console.log(`✅ Email delivered successfully`);
  console.log(`   Recipient: ${event.Recipient}`);
  console.log(`   MessageID: ${event.MessageID}`);
  console.log(`   DeliveredAt: ${event.DeliveredAt}`);
  console.log(`   Tag: ${event.Tag || 'none'}`);
  console.log(`   Stream: ${event.MessageStream || 'default'}`);

  // TODO: Update email delivery status in database if needed
  // Example: Mark email as delivered in email_logs table
}

/**
 * Handle email bounce
 * Bounces can be "HardBounce" or "SoftBounce"
 */
function handleBounce(event) {
  const isHardBounce = event.Type === 'HardBounce';

  console.error(`❌ Email bounced (${event.Type})`);
  console.error(`   Recipient: ${event.Email}`);
  console.error(`   MessageID: ${event.MessageID}`);
  console.error(`   BouncedAt: ${event.BouncedAt}`);
  console.error(`   Description: ${event.Description}`);
  console.error(`   Details: ${event.Details || 'none'}`);

  if (isHardBounce) {
    console.error(`   ⚠️  Hard bounce - email address is invalid or doesn't exist`);
    console.error(`   ⚠️  Consider marking ${event.Email} as invalid in database`);

    // TODO: Mark email as invalid in database
    // Example: Update users table to mark email as bounced
    // This prevents future email attempts to this address
  } else {
    console.warn(`   Soft bounce - temporary delivery issue, will retry`);
  }

  // TODO: Log bounce in database for monitoring
  // Example: Insert into email_bounces table for tracking
}

/**
 * Handle spam complaint
 * User marked email as spam - important for deliverability
 */
function handleSpamComplaint(event) {
  console.error(`⚠️  Spam complaint received`);
  console.error(`   Recipient: ${event.Email}`);
  console.error(`   MessageID: ${event.MessageID}`);
  console.error(`   ComplaintAt: ${event.BouncedAt}`);
  console.error(`   ⚠️  CRITICAL: User marked email as spam`);
  console.error(`   ⚠️  Consider unsubscribing ${event.Email} from all emails immediately`);

  // TODO: Automatically unsubscribe user from all emails
  // Example: Update users table to disable all email notifications
  // This is critical for maintaining good email reputation

  // TODO: Log spam complaint in database
  // Example: Insert into email_complaints table for monitoring
}

/**
 * Handle subscription change (unsubscribe via link tracker)
 */
function handleSubscriptionChange(event) {
  console.log(`📧 Subscription change`);
  console.log(`   Recipient: ${event.Recipient}`);
  console.log(`   SuppressSending: ${event.SuppressSending}`);
  console.log(`   ChangedAt: ${event.ChangedAt}`);

  if (event.SuppressSending) {
    console.log(`   User unsubscribed via link tracker`);

    // TODO: Update user preferences in database
    // Example: Disable marketing emails for this user
  }
}

/**
 * Handle email open (if tracking enabled)
 */
function handleOpen(event) {
  console.log(`👁️  Email opened`);
  console.log(`   Recipient: ${event.Recipient}`);
  console.log(`   MessageID: ${event.MessageID}`);
  console.log(`   FirstOpen: ${event.FirstOpen}`);
  console.log(`   ReceivedAt: ${event.ReceivedAt}`);

  // TODO: Track email opens in database for analytics
  // Example: Insert into email_opens table
}

/**
 * Handle link click (if tracking enabled)
 */
function handleClick(event) {
  console.log(`🔗 Link clicked`);
  console.log(`   Recipient: ${event.Recipient}`);
  console.log(`   MessageID: ${event.MessageID}`);
  console.log(`   OriginalLink: ${event.OriginalLink}`);
  console.log(`   ClickedAt: ${event.ReceivedAt}`);

  // TODO: Track link clicks in database for analytics
  // Example: Insert into email_clicks table
}

module.exports = router;
