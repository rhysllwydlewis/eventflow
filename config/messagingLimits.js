/**
 * Message Limits Configuration
 * Defines messaging limits based on subscription tier
 */

'use strict';

const MESSAGE_LIMITS = {
  free: {
    messagesPerDay: 10,
    messagesPerHour: 20,
    threadsPerDay: 3,
    maxMessageLength: 500,
  },
  basic: {
    messagesPerDay: 100,
    messagesPerHour: 50,
    threadsPerDay: 20,
    maxMessageLength: 2000,
  },
  pro: {
    messagesPerDay: -1, // unlimited
    messagesPerHour: 500,
    threadsPerDay: -1, // unlimited
    maxMessageLength: 5000,
  },
  premium: {
    messagesPerDay: -1, // unlimited
    messagesPerHour: 500,
    threadsPerDay: -1, // unlimited
    maxMessageLength: 5000,
  },
  pro_plus: {
    messagesPerDay: -1, // unlimited
    messagesPerHour: 1000,
    threadsPerDay: -1, // unlimited
    maxMessageLength: 10000,
  },
  enterprise: {
    messagesPerDay: -1, // unlimited
    messagesPerHour: -1, // unlimited
    threadsPerDay: -1, // unlimited
    maxMessageLength: 50000,
  },
};

module.exports = { MESSAGE_LIMITS };
