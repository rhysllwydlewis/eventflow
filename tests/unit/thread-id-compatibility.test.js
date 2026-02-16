/**
 * Thread ID Compatibility Tests
 * Tests for v1 (thd_*) and v2 (ObjectId) thread ID handling
 */

'use strict';

const { ObjectId } = require('mongodb');

describe('Thread ID Compatibility', () => {
  describe('ObjectId validation', () => {
    it('should recognize valid ObjectIds', () => {
      const validId = new ObjectId().toString();
      expect(ObjectId.isValid(validId)).toBe(true);
    });

    it('should reject v1 thread IDs (thd_*) as invalid ObjectIds', () => {
      const v1ThreadId = 'thd_rm06tio9p54y0d';
      expect(ObjectId.isValid(v1ThreadId)).toBe(false);
    });

    it('should reject short strings as invalid ObjectIds', () => {
      expect(ObjectId.isValid('short')).toBe(false);
      expect(ObjectId.isValid('123')).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(ObjectId.isValid(null)).toBe(false);
      expect(ObjectId.isValid(undefined)).toBe(false);
    });
  });

  describe('Thread ID query construction', () => {
    it('should create correct query for ObjectId', () => {
      const threadId = new ObjectId().toString();
      let query;
      if (ObjectId.isValid(threadId)) {
        query = { _id: new ObjectId(threadId) };
      } else {
        query = { $or: [{ _id: threadId }, { id: threadId }] };
      }
      expect(query).toHaveProperty('_id');
      expect(query._id).toBeInstanceOf(ObjectId);
    });

    it('should create correct query for v1 thread ID', () => {
      const threadId = 'thd_rm06tio9p54y0d';
      let query;
      if (ObjectId.isValid(threadId)) {
        query = { _id: new ObjectId(threadId) };
      } else {
        query = { $or: [{ _id: threadId }, { id: threadId }] };
      }
      expect(query).toHaveProperty('$or');
      expect(query.$or).toHaveLength(2);
      expect(query.$or[0]).toEqual({ _id: threadId });
      expect(query.$or[1]).toEqual({ id: threadId });
    });
  });
});
