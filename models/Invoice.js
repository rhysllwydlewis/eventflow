/**
 * Invoice Model
 * MongoDB schema and methods for billing invoices
 */

'use strict';

/**
 * Invoice Schema Definition
 * Tracks invoices for subscription billing and one-time payments
 */
const invoiceSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'amount', 'currency', 'status'],
      properties: {
        id: {
          bsonType: 'string',
          description: 'Unique invoice identifier',
        },
        subscriptionId: {
          bsonType: 'string',
          description: 'Related subscription ID (if applicable)',
        },
        userId: {
          bsonType: 'string',
          description: 'User ID who owns this invoice',
        },
        stripeInvoiceId: {
          bsonType: 'string',
          description: 'Stripe invoice ID for tracking',
        },
        stripePaymentIntentId: {
          bsonType: 'string',
          description: 'Stripe payment intent ID',
        },
        amount: {
          bsonType: 'number',
          description: 'Total invoice amount',
        },
        currency: {
          bsonType: 'string',
          description: 'Currency code (USD, GBP, etc.)',
        },
        status: {
          enum: ['draft', 'open', 'paid', 'void', 'uncollectible'],
          description: 'Invoice payment status',
        },
        dueDate: {
          bsonType: 'string',
          description: 'Payment due date (ISO 8601)',
        },
        paidAt: {
          bsonType: 'string',
          description: 'Payment completion timestamp (ISO 8601)',
        },
        lineItems: {
          bsonType: 'array',
          description: 'Invoice line items',
          items: {
            bsonType: 'object',
            required: ['name', 'quantity', 'unitPrice'],
            properties: {
              name: {
                bsonType: 'string',
                description: 'Item name or description',
              },
              description: {
                bsonType: 'string',
                description: 'Item detailed description',
              },
              quantity: {
                bsonType: 'number',
                description: 'Item quantity',
              },
              unitPrice: {
                bsonType: 'number',
                description: 'Price per unit',
              },
              amount: {
                bsonType: 'number',
                description: 'Total line item amount (quantity * unitPrice)',
              },
            },
          },
        },
        subtotal: {
          bsonType: 'number',
          description: 'Subtotal before taxes and discounts',
        },
        tax: {
          bsonType: 'number',
          description: 'Tax amount',
        },
        discount: {
          bsonType: 'number',
          description: 'Discount amount applied',
        },
        discountCode: {
          bsonType: 'string',
          description: 'Applied discount or coupon code',
        },
        attemptCount: {
          bsonType: 'int',
          description: 'Number of payment attempts',
        },
        nextPaymentAttempt: {
          bsonType: 'string',
          description: 'Next scheduled payment retry (ISO 8601)',
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata from Stripe or custom fields',
        },
        createdAt: {
          bsonType: 'string',
          description: 'Invoice creation timestamp (ISO 8601)',
        },
        updatedAt: {
          bsonType: 'string',
          description: 'Last update timestamp (ISO 8601)',
        },
      },
    },
  },
};

/**
 * Calculate invoice totals
 * @param {Array} lineItems - Array of line items
 * @param {number} tax - Tax amount (default 0)
 * @param {number} discount - Discount amount (default 0)
 * @returns {Object} Calculated totals
 */
function calculateInvoiceTotals(lineItems, tax = 0, discount = 0) {
  const subtotal = lineItems.reduce((sum, item) => {
    const itemAmount = item.quantity * item.unitPrice;
    return sum + itemAmount;
  }, 0);

  const total = subtotal + tax - discount;

  return {
    subtotal,
    tax,
    discount,
    total,
  };
}

/**
 * Format invoice for display
 * @param {Object} invoice - Invoice object
 * @returns {Object} Formatted invoice
 */
function formatInvoice(invoice) {
  return {
    id: invoice.id,
    subscriptionId: invoice.subscriptionId,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    lineItems: invoice.lineItems || [],
    subtotal: invoice.subtotal,
    tax: invoice.tax || 0,
    discount: invoice.discount || 0,
    createdAt: invoice.createdAt,
  };
}

module.exports = {
  invoiceSchema,
  calculateInvoiceTotals,
  formatInvoice,
};
