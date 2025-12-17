/**
 * Subscription Management Cloud Functions for EventFlow
 * Handles Google Pay payments, subscription lifecycle, and feature access
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Email configuration (using environment variables)
const SEND_EMAILS = process.env.SEND_EMAILS === 'true' || false;
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://eventflow-ffb12.web.app';

/**
 * Send subscription email notification
 * This is a lightweight implementation that logs emails when not configured
 * In production, integrate with SendGrid, Mailgun, or Firebase Email Extension
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject line
 * @param {string} templateType - Template name (e.g., 'subscription-activated')
 * @param {Object} templateData - Data to populate template variables
 * @returns {Promise<Object>} Result object with success status and message
 */
async function sendSubscriptionEmail(to, subject, templateType, templateData) {
  if (!SEND_EMAILS) {
    console.log(`[EMAIL] Would send to ${to}: ${subject}`);
    console.log('[EMAIL] Template:', templateType);
    console.log('[EMAIL] Data:', JSON.stringify(templateData, null, 2));
    return { success: true, message: 'Email logging (not sent)' };
  }

  // TODO: Integrate with actual email service
  // Example integration points:
  // - SendGrid: use @sendgrid/mail
  // - Mailgun: use mailgun.js
  // - Firebase Email Extension: write to email collection
  
  try {
    // For now, log the email details
    console.log(`[EMAIL] Sending to ${to}: ${subject}`);
    
    // Future integration code would go here
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({
    //   to,
    //   from: 'no-reply@eventflow.com',
    //   subject,
    //   html: renderTemplate(templateType, templateData)
    // });
    
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get user details for email sending
 * 
 * @param {string} userId - Firebase user ID
 * @returns {Promise<Object|null>} User object with email and name, or null if not found
 */
async function getUserDetails(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return null;
    }
    const userData = userDoc.data();
    return {
      email: userData.email,
      name: userData.name || userData.displayName || 'there',
    };
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
}

/**
 * Subscription plans configuration
 */
const SUBSCRIPTION_PLANS = {
  pro_monthly: {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    tier: 'pro',
    price: 9.99,
    currency: 'GBP',
    billingCycle: 'monthly',
    trialDays: 14,
    features: [
      'Priority listing in search results',
      'Featured supplier badge on profile',
      'Advanced analytics dashboard',
      'Up to 50 event bookings per month',
      'Email support',
    ],
  },
  pro_plus_monthly: {
    id: 'pro_plus_monthly',
    name: 'Pro+ Monthly',
    tier: 'pro_plus',
    price: 19.99,
    currency: 'GBP',
    billingCycle: 'monthly',
    trialDays: 14,
    features: [
      'All Pro features',
      'Premium badge on profile',
      'Unlimited event bookings',
      'Priority phone support',
      'Custom branding options',
      'Featured in homepage carousel',
    ],
  },
  pro_yearly: {
    id: 'pro_yearly',
    name: 'Pro Yearly',
    tier: 'pro',
    price: 99.99,
    currency: 'GBP',
    billingCycle: 'yearly',
    trialDays: 28,
    features: [
      'Priority listing in search results',
      'Featured supplier badge on profile',
      'Advanced analytics dashboard',
      'Up to 50 event bookings per month',
      'Email support',
      'Save 17% vs monthly',
    ],
  },
  pro_plus_yearly: {
    id: 'pro_plus_yearly',
    name: 'Pro+ Yearly',
    tier: 'pro_plus',
    price: 199.99,
    currency: 'GBP',
    billingCycle: 'yearly',
    trialDays: 28,
    features: [
      'All Pro features',
      'Premium badge on profile',
      'Unlimited event bookings',
      'Priority phone support',
      'Custom branding options',
      'Featured in homepage carousel',
      'Save 17% vs monthly',
    ],
  },
};

/**
 * Handle successful payment from Google Pay extension
 * Triggered when the payment document is updated by the extension with results
 * 
 * The google-pay/make-payment extension will update the document with:
 * - status: 'success' or 'error'
 * - response: { ... } (PSP response)
 * - error: { ... } (if failed)
 */
exports.onPaymentSuccess = functions
  .region('europe-west2')
  .firestore.document('payments/{paymentId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();
    const paymentId = context.params.paymentId;

    try {
      console.log('Payment document updated:', paymentId, afterData);

      // Check if this update is from the extension processing the payment
      // The extension should set a status field or response field
      const isExtensionUpdate = afterData.response || afterData.status;
      
      if (!isExtensionUpdate) {
        console.log('Not an extension update, skipping');
        return null;
      }

      // Check if already processed to avoid duplicate processing
      if (afterData.subscriptionActivated) {
        console.log('Subscription already activated, skipping');
        return null;
      }

      // Validate payment data
      if (!afterData.supplierId || !afterData.planId) {
        console.error('Invalid payment data:', afterData);
        return null;
      }

      // Check if payment was successful
      // The extension may set status: 'success' or check the response
      const isSuccessful = 
        afterData.status === 'success' || 
        afterData.status === 'completed' ||
        (afterData.response && afterData.response.success);

      if (!isSuccessful) {
        console.log('Payment not successful, skipping:', afterData.status);
        // Mark as processed to avoid re-checking
        await change.after.ref.update({
          subscriptionActivated: false,
          processedAt: admin.firestore.Timestamp.now(),
        });
        return null;
      }

      const plan = SUBSCRIPTION_PLANS[afterData.planId];
      if (!plan) {
        console.error('Unknown plan:', afterData.planId);
        return null;
      }

      // Calculate dates
      const now = admin.firestore.Timestamp.now();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + plan.trialDays);

      const endDate = new Date(trialEndDate);
      if (plan.billingCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Update supplier document with subscription info
      const supplierRef = admin.firestore().collection('suppliers').doc(afterData.supplierId);
      await supplierRef.set(
        {
          subscription: {
            tier: plan.tier,
            status: 'trial',
            paymentId: paymentId,
            planId: plan.id,
            startDate: now,
            endDate: admin.firestore.Timestamp.fromDate(endDate),
            trialEndDate: admin.firestore.Timestamp.fromDate(trialEndDate),
            autoRenew: true,
            billingCycle: plan.billingCycle,
            lastUpdated: now,
          },
          pro: true, // Legacy field for backwards compatibility
        },
        { merge: true }
      );

      // Mark payment as processed
      await change.after.ref.update({
        subscriptionActivated: true,
        processedAt: admin.firestore.Timestamp.now(),
      });

      console.log(
        `Subscription activated for supplier ${afterData.supplierId}, plan ${plan.id}`
      );

      // Send confirmation email
      try {
        const supplier = await supplierRef.get();
        const supplierData = supplier.data();
        
        if (supplierData.ownerUserId) {
          const user = await getUserDetails(supplierData.ownerUserId);
          
          if (user) {
            const features = plan.features.map(f => `<li>${f}</li>`).join('');
            await sendSubscriptionEmail(
              user.email,
              `Welcome to EventFlow ${plan.name}!`,
              'subscription-activated',
              {
                name: user.name,
                planName: plan.name,
                status: 'Trial',
                trialDays: plan.trialDays,
                renewalDate: new Date(endDate).toLocaleDateString('en-GB'),
                amount: plan.price.toFixed(2),
                billingCycle: plan.billingCycle,
                features: features,
                baseUrl: APP_BASE_URL,
              }
            );
            console.log(`Confirmation email sent to ${user.email}`);
          }
        }
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the function if email fails
      }

      return null;
    } catch (error) {
      console.error('Error processing payment:', error);
      // Update payment with sanitized error (don't expose internal details)
      await change.after.ref.update({
        error: 'Payment processing failed',
        errorCode: error.code || 'UNKNOWN',
        processedAt: admin.firestore.Timestamp.now(),
      });
      // Re-throw for Cloud Functions error logging
      throw new Error('Payment processing failed');
    }
  });

/**
 * Check and update subscription status daily
 * Runs at midnight every day
 */
exports.checkSubscriptionStatus = functions
  .region('europe-west2')
  .pubsub.schedule('0 0 * * *')
  .timeZone('Europe/London')
  .onRun(async context => {
    console.log('Running subscription status check');
    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);

    try {
      // Get all suppliers with active subscriptions or trials
      const suppliersSnapshot = await db
        .collection('suppliers')
        .where('subscription.status', 'in', ['trial', 'active'])
        .get();

      const batch = db.batch();
      let updatedCount = 0;

      for (const doc of suppliersSnapshot.docs) {
        const supplier = doc.data();
        const subscription = supplier.subscription;

        if (!subscription) continue;

        let needsUpdate = false;
        const updates = { 'subscription.lastChecked': nowTimestamp };

        // Check if trial has ended
        if (subscription.status === 'trial' && subscription.trialEndDate) {
          const trialEnd = subscription.trialEndDate.toDate();
          if (now >= trialEnd) {
            updates['subscription.status'] = 'active';
            needsUpdate = true;
            console.log(`Trial ended for supplier ${doc.id}, moving to active`);
          }
        }

        // Check if subscription has expired
        if (subscription.endDate) {
          const endDate = subscription.endDate.toDate();
          if (now >= endDate) {
            if (subscription.autoRenew) {
              // Process renewal for auto-renew subscriptions
              console.log(`Subscription renewal due for supplier ${doc.id}`);
              
              // TODO: Implement automatic renewal payment processing
              // For Google Pay one-time tokens, we need to:
              // 1. Store payment method tokens for recurring billing
              // 2. Process payment through PSP
              // 3. Update subscription dates on success
              // 
              // For now, expire the subscription and notify user to renew manually
              updates['subscription.status'] = 'expired';
              updates['subscription.tier'] = 'free';
              updates['pro'] = false;
              needsUpdate = true;
              
              // Send renewal failed notification
              try {
                if (supplier.ownerUserId) {
                  const user = await getUserDetails(supplier.ownerUserId);
                  if (user) {
                    const plan = SUBSCRIPTION_PLANS[subscription.planId];
                    await sendSubscriptionEmail(
                      user.email,
                      'Action Required: Renew Your EventFlow Subscription',
                      'subscription-payment-failed',
                      {
                        name: user.name,
                        planName: plan ? plan.name : subscription.planId,
                        amount: plan ? plan.price.toFixed(2) : '0.00',
                        attemptDate: now.toLocaleDateString('en-GB'),
                        gracePeriodEnd: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB'),
                        baseUrl: APP_BASE_URL,
                      }
                    );
                  }
                }
              } catch (emailError) {
                console.error('Error sending renewal notification:', emailError);
              }
            } else {
              // Downgrade to free
              updates['subscription.status'] = 'expired';
              updates['subscription.tier'] = 'free';
              updates['pro'] = false;
              needsUpdate = true;
              console.log(`Subscription expired for supplier ${doc.id}`);
            }
          } else {
            // Send renewal reminder 7 days before expiry
            const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            if (daysUntilExpiry === 7) {
              console.log(`Renewal reminder due for supplier ${doc.id}`);
              
              try {
                if (supplier.ownerUserId) {
                  const user = await getUserDetails(supplier.ownerUserId);
                  if (user) {
                    const plan = SUBSCRIPTION_PLANS[subscription.planId];
                    const renewalMessage = subscription.autoRenew
                      ? `Your subscription will automatically renew on <strong>${endDate.toLocaleDateString('en-GB')}</strong>. No action is needed on your part.<br><br>If you'd like to cancel or change your subscription, please visit your dashboard before the renewal date.`
                      : `Your subscription is set to expire on <strong>${endDate.toLocaleDateString('en-GB')}</strong> and will not automatically renew.<br><br>To continue enjoying premium features, please renew your subscription before it expires.`;
                    
                    const ctaText = subscription.autoRenew ? 'Manage Subscription' : 'Renew Now';
                    
                    await sendSubscriptionEmail(
                      user.email,
                      'Your EventFlow Subscription Renews Soon',
                      'subscription-renewal-reminder',
                      {
                        name: user.name,
                        planName: plan ? plan.name : subscription.planId,
                        daysUntilRenewal: daysUntilExpiry,
                        renewalDate: endDate.toLocaleDateString('en-GB'),
                        amount: plan ? plan.price.toFixed(2) : '0.00',
                        autoRenew: subscription.autoRenew ? 'Yes' : 'No',
                        renewalMessage: renewalMessage,
                        ctaText: ctaText,
                        baseUrl: APP_BASE_URL,
                      }
                    );
                  }
                }
              } catch (emailError) {
                console.error('Error sending renewal reminder:', emailError);
              }
            }
            
            // Send trial ending reminder 3 days before trial ends
            if (subscription.status === 'trial' && subscription.trialEndDate) {
              const trialEnd = subscription.trialEndDate.toDate();
              const daysUntilTrialEnd = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
              if (daysUntilTrialEnd === 3) {
                console.log(`Trial ending reminder due for supplier ${doc.id}`);
                
                try {
                  if (supplier.ownerUserId) {
                    const user = await getUserDetails(supplier.ownerUserId);
                    if (user) {
                      const plan = SUBSCRIPTION_PLANS[subscription.planId];
                      await sendSubscriptionEmail(
                        user.email,
                        'Your EventFlow Trial is Ending Soon',
                        'subscription-trial-ending',
                        {
                          name: user.name,
                          planName: plan ? plan.name : subscription.planId,
                          trialDays: plan ? plan.trialDays : 14,
                          daysLeft: daysUntilTrialEnd,
                          trialEndDate: trialEnd.toLocaleDateString('en-GB'),
                          amount: plan ? plan.price.toFixed(2) : '0.00',
                          billingCycle: plan ? plan.billingCycle : 'monthly',
                          baseUrl: APP_BASE_URL,
                        }
                      );
                    }
                  }
                } catch (emailError) {
                  console.error('Error sending trial ending reminder:', emailError);
                }
              }
            }
          }
        }

        if (needsUpdate) {
          batch.update(doc.ref, updates);
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Updated ${updatedCount} supplier subscriptions`);
      } else {
        console.log('No subscriptions needed updating');
      }

      return null;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      throw error;
    }
  });

/**
 * Handle subscription cancellation
 * Callable function from frontend
 */
exports.cancelSubscription = functions
  .region('europe-west2')
  .https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { supplierId } = data;

    try {
      // Verify user owns this supplier
      const supplierDoc = await db.collection('suppliers').doc(supplierId).get();

      if (!supplierDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Supplier not found');
      }

      const supplier = supplierDoc.data();

      // Check if user owns this supplier (assuming ownerUserId field)
      if (supplier.ownerUserId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User does not own this supplier'
        );
      }

      // Update subscription to disable auto-renewal
      await supplierDoc.ref.update({
        'subscription.autoRenew': false,
        'subscription.cancelledAt': admin.firestore.Timestamp.now(),
        'subscription.lastUpdated': admin.firestore.Timestamp.now(),
      });

      console.log(`Subscription cancelled for supplier ${supplierId}`);

      // Send cancellation confirmation email
      try {
        if (supplier.ownerUserId) {
          const user = await getUserDetails(supplier.ownerUserId);
          
          if (user) {
            const subscription = supplier.subscription;
            const plan = subscription ? SUBSCRIPTION_PLANS[subscription.planId] : null;
            const endDate = subscription && subscription.endDate 
              ? subscription.endDate.toDate().toLocaleDateString('en-GB')
              : 'N/A';
            
            await sendSubscriptionEmail(
              user.email,
              'Subscription Cancelled - EventFlow',
              'subscription-cancelled',
              {
                name: user.name,
                planName: plan ? plan.name : 'Pro',
                endDate: endDate,
                baseUrl: APP_BASE_URL,
              }
            );
            console.log(`Cancellation email sent to ${user.email}`);
          }
        }
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
        // Don't fail the function if email fails
      }

      return {
        success: true,
        message: 'Subscription cancelled. Your current benefits will remain until the end date.',
      };
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to cancel subscription');
    }
  });

/**
 * Handle subscription upgrade/downgrade
 * Callable function from frontend
 */
exports.updateSubscription = functions
  .region('europe-west2')
  .https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { supplierId, newPlanId } = data;

    try {
      // Verify user owns this supplier
      const supplierDoc = await db.collection('suppliers').doc(supplierId).get();

      if (!supplierDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Supplier not found');
      }

      const supplier = supplierDoc.data();

      // Check if user owns this supplier
      if (supplier.ownerUserId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User does not own this supplier'
        );
      }

      const newPlan = SUBSCRIPTION_PLANS[newPlanId];
      if (!newPlan) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid plan ID');
      }

      const currentSubscription = supplier.subscription;

      // Calculate pro-rated amount (simplified - would need more complex logic for production)
      let proratedAmount = 0;
      if (currentSubscription && currentSubscription.endDate) {
        const now = new Date();
        const endDate = currentSubscription.endDate.toDate();
        const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

        // Simple proration calculation
        const currentPlan = SUBSCRIPTION_PLANS[currentSubscription.planId];
        if (currentPlan) {
          const dailyRate = currentPlan.price / (currentPlan.billingCycle === 'monthly' ? 30 : 365);
          const credit = dailyRate * daysRemaining;
          proratedAmount = Math.max(0, newPlan.price - credit);
        }
      }

      // TODO: Process payment difference through Google Pay
      console.log(`Upgrade/downgrade for supplier ${supplierId}, prorated amount: £${proratedAmount.toFixed(2)}`);

      // For now, just update the plan immediately
      // In production, you'd wait for payment confirmation
      const now = admin.firestore.Timestamp.now();
      const endDate = new Date();
      if (newPlan.billingCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      await supplierDoc.ref.update({
        'subscription.tier': newPlan.tier,
        'subscription.planId': newPlan.id,
        'subscription.billingCycle': newPlan.billingCycle,
        'subscription.endDate': admin.firestore.Timestamp.fromDate(endDate),
        'subscription.lastUpdated': now,
        pro: newPlan.tier === 'pro' || newPlan.tier === 'pro_plus',
      });

      console.log(`Subscription updated for supplier ${supplierId} to plan ${newPlan.id}`);

      return {
        success: true,
        message: 'Subscription updated successfully',
        proratedAmount,
      };
    } catch (error) {
      console.error('Error updating subscription:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to update subscription');
    }
  });

/**
 * Get subscription status for a supplier
 * Callable function from frontend
 */
exports.getSubscriptionStatus = functions
  .region('europe-west2')
  .https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const userId = context.auth.uid;
    const { supplierId } = data;

    try {
      // Get supplier document
      const supplierDoc = await db.collection('suppliers').doc(supplierId).get();

      if (!supplierDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Supplier not found');
      }

      const supplier = supplierDoc.data();

      // Check if user owns this supplier
      if (supplier.ownerUserId !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User does not own this supplier'
        );
      }

      const subscription = supplier.subscription;
      
      if (!subscription) {
        return {
          tier: 'free',
          status: 'free',
          hasSubscription: false,
        };
      }

      // Calculate days remaining
      let daysRemaining = 0;
      if (subscription.endDate) {
        const endDate = subscription.endDate.toDate();
        const now = new Date();
        daysRemaining = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)));
      }

      return {
        tier: subscription.tier,
        status: subscription.status,
        planId: subscription.planId,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        trialEndDate: subscription.trialEndDate,
        autoRenew: subscription.autoRenew,
        billingCycle: subscription.billingCycle,
        daysRemaining: daysRemaining,
        cancelledAt: subscription.cancelledAt || null,
        hasSubscription: true,
      };
    } catch (error) {
      console.error('Error getting subscription status:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError('internal', 'Failed to get subscription status');
    }
  });

/**
 * Initialize subscription plans in Firestore
 * This is a one-time setup function
 */
exports.initializeSubscriptionPlans = functions
  .region('europe-west2')
  .https.onRequest(async (req, res) => {
    try {
      const batch = db.batch();

      for (const [planId, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
        const planRef = db.collection('subscriptionPlans').doc(planId);
        batch.set(planRef, {
          ...plan,
          createdAt: admin.firestore.Timestamp.now(),
          active: true,
        });
      }

      await batch.commit();

      res.json({
        success: true,
        message: 'Subscription plans initialized',
        plans: Object.keys(SUBSCRIPTION_PLANS),
      });
    } catch (error) {
      console.error('Error initializing plans:', error);
      res.status(500).json({ error: error.message });
    }
  });
