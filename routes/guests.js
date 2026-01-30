/**
 * Guests Routes
 * Handles guest list management for user plans
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const dbUnified = require('../db-unified');
const { uid } = require('../store');

const router = express.Router();

/**
 * Middleware to verify plan ownership
 */
async function verifyPlanOwnership(req, res, next) {
  try {
    const { planId } = req.params;
    const userId = req.user.id;
    const plans = await dbUnified.read('plans');
    const plan = plans.find(p => p.id === planId && p.userId === userId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found or access denied' });
    }

    req.plan = plan;
    next();
  } catch (error) {
    console.error('Error verifying plan ownership:', error);
    res.status(500).json({ error: 'Failed to verify plan access' });
  }
}

/**
 * GET /api/me/plans/:planId/guests
 * Get all guests for a plan
 */
router.get('/:planId/guests', authRequired, verifyPlanOwnership, async (req, res) => {
  try {
    const plan = req.plan;
    const guests = plan.guests || [];

    res.json({
      success: true,
      guests,
      count: guests.length,
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ error: 'Failed to fetch guests', details: error.message });
  }
});

/**
 * POST /api/me/plans/:planId/guests
 * Add a guest to a plan
 * Body: { name, email, plusOne, dietary, rsvpStatus, notes }
 */
router.post('/:planId/guests', authRequired, csrfProtection, verifyPlanOwnership, async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, email, plusOne, dietary, rsvpStatus, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Guest name is required' });
    }

    const now = new Date().toISOString();
    const newGuest = {
      id: uid('guest'),
      name: String(name).trim().slice(0, 200),
      email: email ? String(email).trim().slice(0, 200) : null,
      plusOne: plusOne ? parseInt(plusOne, 10) || 0 : 0,
      dietary: dietary ? String(dietary).trim().slice(0, 500) : null,
      rsvpStatus: rsvpStatus || 'pending',
      notes: notes ? String(notes).trim().slice(0, 1000) : null,
      createdAt: now,
      updatedAt: now,
    };

    const plans = await dbUnified.read('plans');
    const planIndex = plans.findIndex(p => p.id === planId);

    if (planIndex === -1) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plans[planIndex].guests) {
      plans[planIndex].guests = [];
    }

    plans[planIndex].guests.push(newGuest);
    plans[planIndex].updatedAt = now;

    await dbUnified.write('plans', plans);

    res.status(201).json({
      success: true,
      guest: newGuest,
    });
  } catch (error) {
    console.error('Error adding guest:', error);
    res.status(500).json({ error: 'Failed to add guest', details: error.message });
  }
});

/**
 * PATCH /api/me/plans/:planId/guests/:id
 * Update a guest
 * Body: { name?, email?, plusOne?, dietary?, rsvpStatus?, notes? }
 */
router.patch('/:planId/guests/:id', authRequired, csrfProtection, verifyPlanOwnership, async (req, res) => {
  try {
    const { planId, id } = req.params;
    const { name, email, plusOne, dietary, rsvpStatus, notes } = req.body;

    const plans = await dbUnified.read('plans');
    const planIndex = plans.findIndex(p => p.id === planId);

    if (planIndex === -1) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = plans[planIndex];
    if (!plan.guests || !Array.isArray(plan.guests)) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const guestIndex = plan.guests.findIndex(g => g.id === id);
    if (guestIndex === -1) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const guest = plan.guests[guestIndex];
    const now = new Date().toISOString();

    if (name !== undefined) {
      guest.name = String(name).trim().slice(0, 200);
    }
    if (email !== undefined) {
      guest.email = email ? String(email).trim().slice(0, 200) : null;
    }
    if (plusOne !== undefined) {
      guest.plusOne = plusOne ? parseInt(plusOne, 10) || 0 : 0;
    }
    if (dietary !== undefined) {
      guest.dietary = dietary ? String(dietary).trim().slice(0, 500) : null;
    }
    if (rsvpStatus !== undefined) {
      guest.rsvpStatus = rsvpStatus;
    }
    if (notes !== undefined) {
      guest.notes = notes ? String(notes).trim().slice(0, 1000) : null;
    }

    guest.updatedAt = now;
    plan.guests[guestIndex] = guest;
    plan.updatedAt = now;

    await dbUnified.write('plans', plans);

    res.json({
      success: true,
      guest,
    });
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(500).json({ error: 'Failed to update guest', details: error.message });
  }
});

/**
 * DELETE /api/me/plans/:planId/guests/:id
 * Remove a guest from a plan
 */
router.delete('/:planId/guests/:id', authRequired, csrfProtection, verifyPlanOwnership, async (req, res) => {
  try {
    const { planId, id } = req.params;

    const plans = await dbUnified.read('plans');
    const planIndex = plans.findIndex(p => p.id === planId);

    if (planIndex === -1) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const plan = plans[planIndex];
    if (!plan.guests || !Array.isArray(plan.guests)) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const guestIndex = plan.guests.findIndex(g => g.id === id);
    if (guestIndex === -1) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    plan.guests.splice(guestIndex, 1);
    plan.updatedAt = new Date().toISOString();

    await dbUnified.write('plans', plans);

    res.json({
      success: true,
      message: 'Guest removed successfully',
    });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ error: 'Failed to delete guest', details: error.message });
  }
});

module.exports = router;
