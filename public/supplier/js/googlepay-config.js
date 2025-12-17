/**
 * Google Pay Configuration for EventFlow
 * Configures Google Pay API for subscription payments
 * Uses TEST mode and integrates with Firebase "Make Payments with Google Pay" extension
 */

/**
 * Google Pay API configuration - TEST MODE
 */
const GOOGLE_PAY_CONFIG = {
  apiVersion: 2,
  apiVersionMinor: 0,
  merchantInfo: {
    merchantName: 'EventFlow',
    // Merchant ID for TEST mode - replace with actual ID for production
    merchantId: 'BCR2DN4T5WBN5VBO',
  },
};

/**
 * Get base allowed payment methods configuration
 */
function getBaseCardPaymentMethod() {
  return {
    type: 'CARD',
    parameters: {
      allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: ['MASTERCARD', 'VISA', 'AMEX'],
    },
  };
}

/**
 * Get tokenization specification for Google Pay
 * Uses DIRECT tokenization for testing/demo purposes
 * 
 * IMPORTANT: For production, replace with actual PSP configuration:
 * - For Stripe: gateway: 'stripe', gatewayMerchantId: 'your_stripe_merchant_id'
 * - For Braintree: gateway: 'braintree', gatewayMerchantId: 'your_braintree_merchant_id'
 * - For Adyen: gateway: 'adyen', gatewayMerchantId: 'your_adyen_merchant_id'
 */
function getTokenizationSpecification() {
  return {
    type: 'PAYMENT_GATEWAY',
    parameters: {
      // Using 'example' gateway for TEST mode
      // This allows testing without a real PSP integration
      gateway: 'example',
      gatewayMerchantId: 'exampleGatewayMerchantId',
    },
  };
}

/**
 * Get card payment method with tokenization
 */
function getCardPaymentMethod() {
  const cardPaymentMethod = Object.assign({}, getBaseCardPaymentMethod(), {
    tokenizationSpecification: getTokenizationSpecification(),
  });
  return cardPaymentMethod;
}

/**
 * Payment data request for Google Pay
 */
function getGooglePaymentDataRequest(amount, planId, planName) {
  return {
    apiVersion: GOOGLE_PAY_CONFIG.apiVersion,
    apiVersionMinor: GOOGLE_PAY_CONFIG.apiVersionMinor,
    allowedPaymentMethods: [getCardPaymentMethod()],
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
  };
}

/**
 * Initialize Google Pay API in TEST mode
 * @returns {Promise<google.payments.api.PaymentsClient|null>}
 */
async function initializeGooglePay() {
  // Check if Google Pay API is available
  if (
    typeof window === 'undefined' ||
    !window.google ||
    !window.google.payments ||
    !window.google.payments.api
  ) {
    console.warn('Google Pay API not available');
    return null;
  }

  try {
    const paymentsClient = new google.payments.api.PaymentsClient({
      environment: 'TEST', // Using TEST mode as required
    });

    return paymentsClient;
  } catch (error) {
    console.error('Error initializing Google Pay:', error);
    return null;
  }
}

/**
 * Check if Google Pay is available
 * @param {google.payments.api.PaymentsClient} paymentsClient
 * @returns {Promise<boolean>}
 */
async function isGooglePayAvailable(paymentsClient) {
  if (!paymentsClient) {
    return false;
  }

  try {
    const isReadyToPayRequest = {
      apiVersion: GOOGLE_PAY_CONFIG.apiVersion,
      apiVersionMinor: GOOGLE_PAY_CONFIG.apiVersionMinor,
      allowedPaymentMethods: [getBaseCardPaymentMethod()],
    };

    const response = await paymentsClient.isReadyToPay(isReadyToPayRequest);
    return response.result === true;
  } catch (error) {
    console.error('Error checking Google Pay availability:', error);
    return false;
  }
}

/**
 * Process payment with Google Pay
 * Writes payment data to Firestore for Firebase extension to process
 * @param {google.payments.api.PaymentsClient} paymentsClient
 * @param {number} amount - Plan price
 * @param {string} planId - Plan identifier
 * @param {string} planName - Plan display name
 * @returns {Promise<object>}
 */
async function processGooglePayPayment(paymentsClient, amount, planId, planName) {
  if (!paymentsClient) {
    return {
      success: false,
      error: 'Google Pay not initialized',
    };
  }

  try {
    const paymentDataRequest = getGooglePaymentDataRequest(amount, planId, planName);

    // Request payment data from Google Pay
    const paymentData = await paymentsClient.loadPaymentData(paymentDataRequest);

    // Extract payment token
    const paymentToken = paymentData.paymentMethodData?.tokenizationData?.token;
    if (!paymentToken) {
      throw new Error('No payment token received from Google Pay');
    }

    // Write payment data to Firestore for Firebase extension to process
    // DO NOT process payment on frontend
    const result = await writePaymentToFirestore(paymentData, amount, planId);

    return {
      success: true,
      paymentData,
      firestoreDocId: result.id,
    };
  } catch (error) {
    console.error('Error processing Google Pay payment:', error);

    // Handle user cancellation gracefully
    if (error.statusCode === 'CANCELED') {
      return {
        success: false,
        error: 'Payment cancelled',
        cancelled: true,
      };
    }

    return {
      success: false,
      error: error.message || 'Payment failed',
    };
  }
}

/**
 * Write payment data to Firestore
 * Firebase "Make Payments with Google Pay" extension will process this
 * @param {object} paymentData - Payment data from Google Pay
 * @param {number} amount - Plan price
 * @param {string} planId - Plan identifier
 * @returns {Promise<object>}
 */
async function writePaymentToFirestore(paymentData, amount, planId) {
  // Import Firebase from the config
  const { db, auth, collection, addDoc, serverTimestamp } =
    await import('../../assets/js/firebase-config.js');

  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get supplier ID from session storage
  const supplierId = sessionStorage.getItem('selectedSupplierId');
  if (!supplierId) {
    throw new Error('No supplier selected');
  }

  // Extract payment token
  const paymentToken = paymentData.paymentMethodData?.tokenizationData?.token;

  // Parse the token if it's a string
  let parsedToken;
  try {
    parsedToken = typeof paymentToken === 'string' ? JSON.parse(paymentToken) : paymentToken;
  } catch (e) {
    parsedToken = paymentToken;
  }

  // Write payment document as specified in requirements
  const paymentDoc = {
    psp: 'googlepay',
    total: amount, // As number, not in smallest currency unit
    currency: 'GBP',
    paymentToken: parsedToken,
    status: 'pending',
    createdAt: serverTimestamp(),

    // Additional metadata for subscription processing
    userId: user.uid,
    supplierId: supplierId,
    planId: planId,
  };

  const docRef = await addDoc(collection(db, 'payments'), paymentDoc);

  console.log('Payment request written to Firestore:', docRef.id);

  return docRef;
}

/**
 * Create Google Pay button
 * Button renders only if Google Pay API is available
 * @param {HTMLElement} container - Container element for the button
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement|null}
 */
function createGooglePayButton(container, onClick) {
  if (!container) {
    return null;
  }

  // Check if Google Pay API is available
  if (
    typeof window === 'undefined' ||
    !window.google ||
    !window.google.payments ||
    !window.google.payments.api
  ) {
    console.warn('Google Pay API not available - button will not render');
    return null;
  }

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
    margin-top: 0.5rem;
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
  createGooglePayButton,
  getGooglePaymentDataRequest,
};
