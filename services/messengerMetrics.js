/**
 * Messenger v4 Metrics
 *
 * Lightweight in-memory counter store for messenger v4 operational metrics.
 * Designed to have zero external dependencies.
 *
 * Counters are reset when the process restarts.  For persistent metrics,
 * integrate with an external monitoring system (Prometheus, Datadog, etc.).
 *
 * Usage:
 *   const metrics = require('./messengerMetrics');
 *   metrics.increment('messenger_v4_messages_sent_total');
 *   metrics.getAll();   // { messenger_v4_messages_sent_total: 42, ... }
 */

'use strict';

const COUNTER_NAMES = [
  'messenger_v4_messages_sent_total',
  'messenger_v4_conversations_created_total',
  'messenger_v4_attachments_uploaded_total',
  'messenger_v4_errors_total',
];

const _counters = Object.fromEntries(COUNTER_NAMES.map(name => [name, 0]));

/**
 * Increment a named counter by 1 (or a given amount).
 * Unknown counter names are ignored.
 *
 * @param {string} name
 * @param {number} [by=1]
 */
function increment(name, by = 1) {
  if (Object.prototype.hasOwnProperty.call(_counters, name)) {
    _counters[name] += by;
  }
}

/**
 * Return a shallow copy of all counters.
 * @returns {Object}
 */
function getAll() {
  return { ..._counters };
}

/**
 * Reset all counters to zero.  Useful in tests.
 */
function reset() {
  for (const key of Object.keys(_counters)) {
    _counters[key] = 0;
  }
}

module.exports = { increment, getAll, reset, COUNTER_NAMES };
