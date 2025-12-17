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

      // TODO: Send confirmation email
      // This would integrate with your existing email system

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
              // TODO: Process renewal payment
              console.log(`Subscription renewal due for supplier ${doc.id}`);
              // For now, just log - would integrate with Google Pay for renewal
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
              // TODO: Send renewal reminder email
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

      // TODO: Send cancellation confirmation email

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
