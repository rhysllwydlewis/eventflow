/**
 * Two-Factor Authentication Routes
 * Handles 2FA setup, verification, and management
 */

'use strict';

const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const dbUnified = require('../db-unified');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { encrypt, decrypt, hash, verifyHash } = require('../utils/encryption');

const router = express.Router();

/**
 * POST /api/me/2fa/setup
 * Generate 2FA secret and QR code
 */
router.post('/setup', csrfProtection, authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `EventFlow (${req.user.email})`,
      issuer: 'EventFlow',
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Generate 10 backup codes
    const backupCodes = Array.from({ length: 10 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Encrypt secret and hash backup codes
    const encryptedSecret = encrypt(secret.base32);
    const hashedBackupCodes = backupCodes.map(code => hash(code));

    // Save to database
    await dbUnified.updateOne(
      'users',
      { id: userId },
      {
        $set: {
          twoFactorSecret: encryptedSecret,
          twoFactorBackupCodes: hashedBackupCodes,
          twoFactorEnabled: false, // Not enabled until verified
        },
      }
    );

    res.json({
      ok: true,
      qrCode,
      secret: secret.base32,
      backupCodes,
      message: 'Scan the QR code with your authenticator app, then verify to enable 2FA',
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to setup 2FA',
      message: error.message,
    });
  }
});

/**
 * POST /api/me/2fa/verify
 * Verify 2FA token and enable 2FA
 */
router.post('/verify', csrfProtection, authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        ok: false,
        error: 'Token is required',
      });
    }

    // Get user with 2FA secret
    const user = await dbUnified.findOne('users', { id: userId });

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({
        ok: false,
        error: '2FA not set up. Please call /setup first',
      });
    }

    // Decrypt secret
    const secret = decrypt(user.twoFactorSecret);

    // Verify token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after for clock skew
    });

    if (!verified) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid token',
        message: 'The code you entered is incorrect. Please try again.',
      });
    }

    // Enable 2FA
    await dbUnified.updateOne(
      'users',
      { id: userId },
      {
        $set: { twoFactorEnabled: true },
      }
    );

    res.json({
      ok: true,
      message: '2FA has been enabled successfully',
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to verify 2FA token',
      message: error.message,
    });
  }
});

/**
 * POST /api/me/2fa/disable
 * Disable 2FA (requires current 2FA token or backup code)
 */
router.post('/disable', csrfProtection, authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, backupCode } = req.body;

    if (!token && !backupCode) {
      return res.status(400).json({
        ok: false,
        error: 'Token or backup code is required',
      });
    }

    const user = await dbUnified.findOne('users', { id: userId });

    if (!user || !user.twoFactorEnabled) {
      return res.status(400).json({
        ok: false,
        error: '2FA is not enabled',
      });
    }

    let verified = false;

    // Verify with token
    if (token && user.twoFactorSecret) {
      const secret = decrypt(user.twoFactorSecret);
      verified = speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2,
      });
    }

    // Verify with backup code
    if (!verified && backupCode && user.twoFactorBackupCodes) {
      for (const hashedCode of user.twoFactorBackupCodes) {
        if (verifyHash(backupCode.toUpperCase(), hashedCode)) {
          verified = true;
          break;
        }
      }
    }

    if (!verified) {
      return res.status(400).json({
        ok: false,
        error: 'Invalid token or backup code',
      });
    }

    // Disable 2FA and remove secrets
    await dbUnified.updateOne(
      'users',
      { id: userId },
      {
        $set: { twoFactorEnabled: false },
        $unset: {
          twoFactorSecret: '',
          twoFactorBackupCodes: '',
        },
      }
    );

    res.json({
      ok: true,
      message: '2FA has been disabled',
    });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to disable 2FA',
      message: error.message,
    });
  }
});

/**
 * GET /api/me/2fa/status
 * Get 2FA status for current user
 */
router.get('/status', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await dbUnified.findOne('users', { id: userId });

    res.json({
      ok: true,
      enabled: !!user?.twoFactorEnabled,
      hasBackupCodes: !!user?.twoFactorBackupCodes?.length,
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({
      ok: false,
      error: 'Failed to get 2FA status',
      message: error.message,
    });
  }
});

module.exports = router;
