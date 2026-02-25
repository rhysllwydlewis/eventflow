/**
 * Unit tests for db-unified updateOne – verifies both calling conventions:
 *   1. Legacy:  updateOne(collection, idString, plainObject)
 *   2. Modern:  updateOne(collection, {id:...}, {$set:{...}})
 *   3. $unset:  updateOne(collection, {id:...}, {$set:{...}, $unset:{...}})
 */

'use strict';

describe('db-unified – updateOne calling conventions (local storage)', () => {
  let dbUnified;
  let storeData;

  beforeEach(() => {
    jest.resetModules();

    // Minimal in-memory store mock
    storeData = {};

    const mockStore = {
      uid: jest.fn(p => `${p}_123`),
      read: jest.fn(name => (storeData[name] ? [...storeData[name]] : [])),
      write: jest.fn((name, data) => {
        storeData[name] = [...data];
      }),
    };

    jest.mock('../../db', () => ({
      isMongoAvailable: jest.fn(() => false),
      connect: jest.fn(),
    }));
    jest.mock('../../store', () => mockStore);

    dbUnified = require('../../db-unified');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const seed = async row => {
    await dbUnified.initializeDatabase();
    storeData['users'] = [{ ...row }];
  };

  it('legacy: string id + plain object updates a field', async () => {
    await seed({ id: 'u1', name: 'Alice', role: 'customer' });
    const result = await dbUnified.updateOne('users', 'u1', { name: 'AliceNew' });
    expect(result).toBe(true);
    expect(storeData['users'][0].name).toBe('AliceNew');
  });

  it('legacy: string id returns false when document not found', async () => {
    await seed({ id: 'u1', name: 'Alice', role: 'customer' });
    const result = await dbUnified.updateOne('users', 'u999', { name: 'Ghost' });
    expect(result).toBe(false);
    // original record unchanged
    expect(storeData['users'][0].name).toBe('Alice');
  });

  it('modern: {id} filter + $set updates a field', async () => {
    await seed({ id: 'u2', name: 'Bob', role: 'supplier' });
    const result = await dbUnified.updateOne('users', { id: 'u2' }, { $set: { name: 'BobNew' } });
    expect(result).toBe(true);
    expect(storeData['users'][0].name).toBe('BobNew');
    // other fields preserved
    expect(storeData['users'][0].role).toBe('supplier');
  });

  it('modern: {id} filter + $set returns false when document not found', async () => {
    await seed({ id: 'u2', name: 'Bob', role: 'supplier' });
    const result = await dbUnified.updateOne('users', { id: 'u999' }, { $set: { name: 'Ghost' } });
    expect(result).toBe(false);
    expect(storeData['users'][0].name).toBe('Bob');
  });

  it('$set + $unset removes keys and sets new values', async () => {
    await seed({ id: 'u3', name: 'Carol', phone: '07700900000', role: 'customer' });
    const result = await dbUnified.updateOne(
      'users',
      { id: 'u3' },
      {
        $set: { name: 'CarolNew' },
        $unset: { phone: '' },
      }
    );
    expect(result).toBe(true);
    expect(storeData['users'][0].name).toBe('CarolNew');
    expect(storeData['users'][0].phone).toBeUndefined();
    // other fields preserved
    expect(storeData['users'][0].role).toBe('customer');
  });

  it('multi-key $unset removes all listed keys', async () => {
    await seed({
      id: 'u4',
      name: 'Dave',
      twoFactorSecret: 'secret',
      twoFactorBackupCodes: ['a', 'b'],
      twoFactorEnabled: true,
    });
    const result = await dbUnified.updateOne(
      'users',
      { id: 'u4' },
      {
        $set: { twoFactorEnabled: false },
        $unset: { twoFactorSecret: '', twoFactorBackupCodes: '' },
      }
    );
    expect(result).toBe(true);
    const doc = storeData['users'][0];
    expect(doc.twoFactorEnabled).toBe(false);
    expect(doc.twoFactorSecret).toBeUndefined();
    expect(doc.twoFactorBackupCodes).toBeUndefined();
  });

  it('$set with multiple fields updates all of them', async () => {
    await seed({ id: 'u5', name: 'Eve', phone: null, emailVerified: false });
    await dbUnified.updateOne(
      'users',
      { id: 'u5' },
      {
        $set: {
          emailVerified: true,
          emailVerifiedAt: '2026-01-01T00:00:00.000Z',
        },
      }
    );
    const doc = storeData['users'][0];
    expect(doc.emailVerified).toBe(true);
    expect(doc.emailVerifiedAt).toBe('2026-01-01T00:00:00.000Z');
    // original fields preserved
    expect(doc.name).toBe('Eve');
  });
});
