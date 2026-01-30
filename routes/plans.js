/**
 * Plans Routes
 * Handles user wedding/event plans (timeline, budgets, checklists)
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const dbUnified = require('../db-unified');
const { uid } = require('../store');

const router = express.Router();

/**
 * GET /api/me/plans
 * Get all plans for the current user
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const plans = await dbUnified.read('plans');
    const userPlans = plans.filter(p => p.userId === userId);

    res.json({
      plans: userPlans,
      count: userPlans.length,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans', details: error.message });
  }
});

/**
 * GET /api/me/plans/:id
 * Get a specific plan by ID
 */
router.get('/:id', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const plans = await dbUnified.read('plans');
    const plan = plans.find(p => p.id === id && p.userId === userId);

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json({ plan });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ error: 'Failed to fetch plan', details: error.message });
  }
});

/**
 * POST /api/me/plans
 * Create a new plan
 * Body: { name, eventType, eventDate, location, guests, budget, timeline, checklist }
 */
router.post('/', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, eventType, eventDate, location, guests, budget, timeline, checklist } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Plan name is required' });
    }

    const now = new Date().toISOString();
    const newPlan = {
      id: uid('plan'),
      userId,
      name: String(name).trim().slice(0, 200),
      eventType: eventType ? String(eventType).trim().slice(0, 100) : null,
      eventDate: eventDate || null,
      location: location ? String(location).trim().slice(0, 200) : null,
      guests: guests ? Math.max(0, parseInt(guests, 10) || 0) : null,
      budget: budget ? Math.max(0, parseFloat(budget) || 0) : null,
      timeline: Array.isArray(timeline) ? timeline : [],
      checklist: Array.isArray(checklist) ? checklist : [],
      createdAt: now,
      updatedAt: now,
    };

    const plans = await dbUnified.read('plans');
    plans.push(newPlan);
    await dbUnified.write('plans', plans);

    res.status(201).json({
      success: true,
      plan: newPlan,
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ error: 'Failed to create plan', details: error.message });
  }
});

/**
 * PATCH /api/me/plans/:id
 * Update an existing plan
 * Body: { name?, eventType?, eventDate?, location?, guests?, budget?, timeline?, checklist? }
 */
router.patch('/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const plans = await dbUnified.read('plans');
    const planIndex = plans.findIndex(p => p.id === id && p.userId === userId);

    if (planIndex === -1) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const { name, eventType, eventDate, location, guests, budget, timeline, checklist } = req.body;
    const plan = plans[planIndex];

    // Update fields if provided
    if (name !== undefined) {
      plan.name = String(name).trim().slice(0, 200);
    }
    if (eventType !== undefined) {
      plan.eventType = eventType ? String(eventType).trim().slice(0, 100) : null;
    }
    if (eventDate !== undefined) {
      plan.eventDate = eventDate || null;
    }
    if (location !== undefined) {
      plan.location = location ? String(location).trim().slice(0, 200) : null;
    }
    if (guests !== undefined) {
      plan.guests = guests ? Math.max(0, parseInt(guests, 10) || 0) : null;
    }
    if (budget !== undefined) {
      plan.budget = budget ? Math.max(0, parseFloat(budget) || 0) : null;
    }
    if (timeline !== undefined) {
      plan.timeline = Array.isArray(timeline) ? timeline : [];
    }
    if (checklist !== undefined) {
      plan.checklist = Array.isArray(checklist) ? checklist : [];
    }

    plan.updatedAt = new Date().toISOString();
    plans[planIndex] = plan;
    await dbUnified.write('plans', plans);

    res.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ error: 'Failed to update plan', details: error.message });
  }
});

/**
 * DELETE /api/me/plans/:id
 * Delete a plan
 */
router.delete('/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const plans = await dbUnified.read('plans');
    const planIndex = plans.findIndex(p => p.id === id && p.userId === userId);

    if (planIndex === -1) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    plans.splice(planIndex, 1);
    await dbUnified.write('plans', plans);

    res.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({ error: 'Failed to delete plan', details: error.message });
  }
});

module.exports = router;
