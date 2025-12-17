/**
 * Google Pay Configuration for EventFlow
 * Configures Google Pay API for subscription payments
 */

/**
 * Google Pay API configuration
 */
const GOOGLE_PAY_CONFIG = {
  apiVersion: 2,
  apiVersionMinor: 0,
  merchantInfo: {
    merchantName: 'EventFlow',
    merchantId: '12345678901234567890', // Replace with actual merchant ID from Google Pay
  },
};

/**
 * Payment data request for Google Pay
 */
function getGooglePaymentDataRequest(amount, planId, planName) {
  return {
    apiVersion: GOOGLE_PAY_CONFIG.apiVersion,
    apiVersionMinor: GOOGLE_PAY_CONFIG.apiVersionMinor,
    allowedPaymentMethods: [
      {
        type: 'CARD',
        parameters: {
          allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
          allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX'],
        },
        tokenizationSpecification: {
          type: 'PAYMENT_GATEWAY',
          parameters: {
            gateway: 'example', // Replace with actual gateway
            gatewayMerchantId: 'exampleGatewayMerchantId', // Replace with actual ID
          },
        },
      },
    ],
    merchantInfo: GOOGLE_PAY_CONFIG.merchantInfo,
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPriceLabel: 'Total',
      totalPrice: amount.toFixed(2),
      currencyCode: 'GBP',
      countryCode: 'GB',
      displayItems: [
        {
          label: planName,
          type: 'LINE_ITEM',
          price: amount.toFixed(2),
        },
      ],
    },
    callbackIntents: ['PAYMENT_AUTHORIZATION'],
  };
}

/**
 * Initialize Google Pay API
 * @returns {Promise<google.payments.api.PaymentsClient>}
 */
async function initializeGooglePay() {
  if (typeof google === 'undefined' || !google.payments) {
    throw new Error('Google Pay API not loaded');
  }

  const paymentsClient = new google.payments.api.PaymentsClient({
    environment: 'TEST', // Change to 'PRODUCTION' for live
  });

  return paymentsClient;
}

/**
 * Check if Google Pay is available
 * @param {google.payments.api.PaymentsClient} paymentsClient
 * @returns {Promise<boolean>}
 */
async function isGooglePayAvailable(paymentsClient) {
  try {
    const isReadyToPayRequest = {
      apiVersion: GOOGLE_PAY_CONFIG.apiVersion,
      apiVersionMinor: GOOGLE_PAY_CONFIG.apiVersionMinor,
      allowedPaymentMethods: [
        {
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX'],
          },
        },
      ],
    };

    const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);
    return response.result;
  } catch (error) {
    console.error('Error checking Google Pay availability:', error);
    return false;
  }
}

/**
 * Process payment with Google Pay
 * @param {google.payments.api.PaymentsClient} paymentsClient
 * @param {number} amount
 * @param {string} planId
 * @param {string} planName
 * @returns {Promise<object>}
 */
async function processGooglePayPayment(paymentsClient, amount, planId, planName) {
  try {
    const paymentDataRequest = getGooglePaymentDataRequest(amount, planId, planName);

    const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);

    // Payment successful, return payment data
    return {
      success: true,
      paymentData,
    };
  } catch (error) {
    console.error('Error processing Google Pay payment:', error);
    return {
      success: false,
      error: error.message || 'Payment failed',
    };
  }
}

/**
 * Handle payment authorization
 * This is called by Google Pay when payment is authorized
 */
function onPaymentAuthorized(paymentData) {
  return new Promise((resolve, reject) => {
    // Process payment through Firebase extension
    processPaymentWithExtension(paymentData)
      .then(() => {
        resolve({ transactionState: 'SUCCESS' });
      })
      .catch(error => {
        console.error('Payment processing error:', error);
        resolve({
          transactionState: 'ERROR',
          error: {
            reason: 'PAYMENT_DATA_INVALID',
            message: 'Payment could not be processed',
            intent: 'PAYMENT_AUTHORIZATION',
          },
        });
      });
  });
}

/**
 * Process payment with Firebase extension
 * Writes payment data to Firestore for extension to process
 */
async function processPaymentWithExtension(paymentData) {
  // Import Firebase from the config
  const { db, addDoc, collection, auth, Timestamp } = await import('../assets/js/firebase-config.js');

  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get supplier ID for current user
  // This would need to be passed from the subscription page
  const supplierId = sessionStorage.getItem('selectedSupplierId');
  const planId = sessionStorage.getItem('selectedPlanId');

  if (!supplierId || !planId) {
    throw new Error('Missing supplier or plan information');
  }

  // Write payment data to Firestore
  // The Firebase extension will pick this up and process it
  const paymentDoc = {
    userId: user.uid,
    supplierId: supplierId,
    planId: planId,
    amount: paymentData.transactionInfo?.totalPrice || '0',
    currency: 'GBP',
    paymentMethodData: paymentData.paymentMethodData,
    status: 'pending',
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(collection(db, 'payments'), paymentDoc);

  console.log('Payment document created:', docRef.id);

  return docRef.id;
}

/**
 * Create Google Pay button
 * @param {HTMLElement} container - Container element for the button
 * @param {Function} onClick - Click handler
 */
function createGooglePayButton(container, onClick) {
  const button = document.createElement('button');
  button.className = 'gpay-button';
  button.setAttribute('aria-label', 'Pay with Google Pay');
  button.style.cssText = `
    background-color: #000;
    background-image: url('https://www.gstatic.com/instantbuy/svg/dark_gpay.svg');
    background-origin: content-box;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
    border: 0;
    border-radius: 4px;
    box-shadow: rgba(60, 64, 67, .3) 0 1px 1px 0, rgba(60, 64, 67, .15) 0 1px 3px 1px;
    cursor: pointer;
    height: 40px;
    min-height: 40px;
    padding: 12px 24px;
    width: 240px;
  `;

  button.addEventListener('click', onClick);
  container.appendChild(button);

  return button;
}

export {
  GOOGLE_PAY_CONFIG,
  initializeGooglePay,
  isGooglePayAvailable,
  processGooglePayPayment,
  onPaymentAuthorized,
  createGooglePayButton,
  getGooglePaymentDataRequest,
};
