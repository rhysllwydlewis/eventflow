/**
 * Integration test: conversation type validation in messenger-v4 route.
 *
 * The allowedTypes list in routes/messenger-v4.js must stay in sync with the
 * ConversationV4 model schema so that marketplace and enquiry conversations
 * (created by QuickComposeV4 from marketplace / package pages) are accepted
 * rather than rejected with a 400 "Invalid conversation type" error.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Parse CONVERSATION_V4_TYPES from the model source without requiring the
 * module (which pulls in mongodb, not installed in this environment).
 * The constant is a simple string-literal array — safe to parse with JSON.
 */
function readModelTypes() {
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'models', 'ConversationV4.js'),
    'utf8'
  );
  const match = src.match(/const CONVERSATION_V4_TYPES\s*=\s*(\[[^\]]+\])/);
  if (!match) throw new Error('CONVERSATION_V4_TYPES not found in ConversationV4.js');
  // Replace single quotes with double quotes so JSON.parse works
  return JSON.parse(match[1].replace(/'/g, '"'));
}

describe('Messenger v4 route — conversation type validation', () => {
  let modelTypes;
  let routeSrc;
  let modelSrc;

  beforeAll(() => {
    modelTypes = readModelTypes();
    routeSrc = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'routes', 'messenger-v4.js'),
      'utf8'
    );
    modelSrc = fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'models', 'ConversationV4.js'),
      'utf8'
    );
  });

  // ── Model exports the canonical type list ────────────────────────────────

  it('ConversationV4 defines CONVERSATION_V4_TYPES as an exported array', () => {
    expect(Array.isArray(modelTypes)).toBe(true);
    expect(modelTypes.length).toBeGreaterThan(0);
    // Must be exported
    expect(modelSrc).toContain('CONVERSATION_V4_TYPES');
    expect(modelSrc).toContain('module.exports');
  });

  // ── Model must accept the types that QuickComposeV4 sends ─────────────────

  it('allows marketplace (sent when contextType is marketplace_listing)', () => {
    expect(modelTypes).toContain('marketplace');
  });

  it('allows enquiry (sent when contextType is package)', () => {
    expect(modelTypes).toContain('enquiry');
  });

  it('allows direct (default / supplier_profile)', () => {
    expect(modelTypes).toContain('direct');
  });

  it('allows support', () => {
    expect(modelTypes).toContain('support');
  });

  it('allows supplier_network', () => {
    expect(modelTypes).toContain('supplier_network');
  });

  // ── Route uses the model constant — not a local hardcoded array ───────────

  it('route imports CONVERSATION_V4_TYPES from ConversationV4 model', () => {
    expect(routeSrc).toContain("require('../models/ConversationV4')");
    expect(routeSrc).toContain('CONVERSATION_V4_TYPES');
  });

  it("route no longer contains a local 'group' type that was absent from the schema", () => {
    expect(routeSrc).not.toContain("'group'");
  });

  // ── validateConversation uses the same constant ───────────────────────────

  it('model validateConversation delegates to CONVERSATION_V4_TYPES (no separate list)', () => {
    expect(modelSrc).toContain('CONVERSATION_V4_TYPES.includes(data.type)');
  });
});
