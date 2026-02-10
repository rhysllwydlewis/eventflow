/**
 * AI Routes
 * Handles AI-powered suggestions and recommendations
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const dbUnified = require('../db-unified');

const router = express.Router();

// Dependencies injected by server.js
let openaiClient;
let AI_ENABLED;
let csrfProtection;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('AI routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = ['openaiClient', 'AI_ENABLED', 'csrfProtection'];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`AI routes: missing required dependencies: ${missing.join(', ')}`);
  }

  openaiClient = deps.openaiClient;
  AI_ENABLED = deps.AI_ENABLED;
  csrfProtection = deps.csrfProtection;
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
 */
function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

// In-memory cache for suggestions to avoid repeated calculations
const suggestionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/ai/suggestions
 * Generate event planning suggestions based on user input
 * Body: { eventType, location, budget, guests, eventDate }
 */
router.post('/suggestions', authRequired, applyCsrfProtection, async (req, res) => {
  try {
    const { eventType, location, budget, guests } = req.body;

    // Validate input
    if (!eventType) {
      return res.status(400).json({
        error: 'Event type is required',
      });
    }

    // Create cache key
    const cacheKey = JSON.stringify({ eventType, location, budget, guests });
    const cached = suggestionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    // Fetch suppliers and packages for recommendations
    const suppliers = await dbUnified.read('suppliers');
    const packages = await dbUnified.read('packages');

    // Filter suppliers based on criteria (rule-based suggestions)
    let suggestedSuppliers = suppliers.filter(s => {
      // Check if supplier matches event type
      const matchesCategory =
        s.categories &&
        s.categories.some(cat => cat.toLowerCase().includes(eventType.toLowerCase()));

      // Check if supplier matches location
      const matchesLocation =
        !location || (s.location && s.location.toLowerCase().includes(location.toLowerCase()));

      // Check if supplier matches budget
      const matchesBudget =
        !budget || !s.priceRange || !s.priceRange.min || s.priceRange.min <= budget;

      return matchesCategory && matchesLocation && matchesBudget;
    });

    // Sort by rating and limit to top 5
    suggestedSuppliers = suggestedSuppliers
      .sort((a, b) => {
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        return ratingB - ratingA;
      })
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.name,
        location: s.location,
        rating: s.rating,
        priceRange: s.priceRange,
        categories: s.categories,
        image: s.image || s.logo,
      }));

    // Filter packages based on criteria
    let suggestedPackages = packages.filter(p => {
      // Check if package matches event type
      const matchesCategory =
        p.category && p.category.toLowerCase().includes(eventType.toLowerCase());

      // Check if package matches budget
      const matchesBudget = !budget || !p.price || p.price <= budget;

      // Check if package matches guest count
      const matchesGuests = !guests || !p.maxGuests || p.maxGuests >= guests;

      return matchesCategory && matchesBudget && matchesGuests;
    });

    // Sort by featured and limit to top 5
    suggestedPackages = suggestedPackages
      .sort((a, b) => {
        if (a.featured && !b.featured) {
          return -1;
        }
        if (!a.featured && b.featured) {
          return 1;
        }
        return 0;
      })
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        maxGuests: p.maxGuests,
        image: p.image,
        supplierId: p.supplierId,
      }));

    // Generate event planning tips based on event type and guest count
    const tips = generateEventTips(eventType, guests);

    // Estimate budget breakdown
    const budgetEstimate = estimateBudget(eventType, guests);

    const response = {
      success: true,
      suggestions: {
        suppliers: suggestedSuppliers,
        packages: suggestedPackages,
        tips,
        budgetEstimate,
      },
    };

    // Cache the response
    suggestionCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (suggestionCache.size > 100) {
      const entries = Array.from(suggestionCache.entries());
      entries
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, 50)
        .forEach(([key]) => suggestionCache.delete(key));
    }

    res.json(response);
  } catch (error) {
    console.error('AI suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate suggestions',
      message: error.message,
    });
  }
});

/**
 * Generate event planning tips based on event type and guest count
 */
function generateEventTips(eventType, guests) {
  const tips = [];
  const guestCount = parseInt(guests) || 0;

  // Generic tips
  tips.push('Start planning at least 6-12 months in advance for best supplier availability');
  tips.push('Book your venue first, as it often determines other supplier availability');
  tips.push('Always request quotes from at least 3-5 suppliers before making a decision');

  // Event-specific tips
  switch (eventType.toLowerCase()) {
    case 'wedding':
      tips.push('Consider hiring a wedding coordinator to reduce stress on the big day');
      tips.push('Book your photographer and videographer early - they book up quickly');
      if (guestCount > 100) {
        tips.push(
          'For large weddings, consider a buffet or food stations instead of plated service'
        );
      }
      break;

    case 'birthday':
    case 'party':
      tips.push('Create a party playlist ahead of time or hire a DJ to keep energy high');
      tips.push('Consider the time of day - lunch parties are often more economical than dinner');
      break;

    case 'corporate':
    case 'conference':
      tips.push('Ensure venue has good AV equipment and reliable WiFi for presentations');
      tips.push('Book accommodation blocks if you have out-of-town attendees');
      break;

    case 'anniversary':
      tips.push('Personalize the event with photos and memorabilia from throughout the years');
      tips.push('Consider surprising the couple with video messages from friends and family');
      break;

    default:
      tips.push('Create a detailed timeline for the day to keep everything on schedule');
      tips.push('Have a backup plan for outdoor events in case of weather issues');
  }

  // Guest count tips
  if (guestCount > 150) {
    tips.push('For large events, consider hiring event staff to help with coordination');
  } else if (guestCount < 30) {
    tips.push('Smaller events allow for more personalized touches and attention to detail');
  }

  return tips.slice(0, 5);
}

/**
 * Estimate budget breakdown based on event type and guest count
 */
function estimateBudget(eventType, guests) {
  const guestCount = parseInt(guests) || 50;

  // Base estimates (very rough guidelines)
  let perPersonCost = 0;
  let fixedCosts = 0;

  switch (eventType.toLowerCase()) {
    case 'wedding':
      perPersonCost = 100; // £100 per person average
      fixedCosts = 5000; // Venue, photographer, etc.
      break;

    case 'birthday':
    case 'party':
      perPersonCost = 40;
      fixedCosts = 500;
      break;

    case 'corporate':
    case 'conference':
      perPersonCost = 75;
      fixedCosts = 2000;
      break;

    case 'anniversary':
      perPersonCost = 60;
      fixedCosts = 1000;
      break;

    default:
      perPersonCost = 50;
      fixedCosts = 1000;
  }

  const totalEstimate = fixedCosts + perPersonCost * guestCount;

  return {
    total: totalEstimate,
    breakdown: {
      venue: Math.round(totalEstimate * 0.3),
      catering: Math.round(totalEstimate * 0.35),
      entertainment: Math.round(totalEstimate * 0.15),
      photography: Math.round(totalEstimate * 0.1),
      decorations: Math.round(totalEstimate * 0.05),
      miscellaneous: Math.round(totalEstimate * 0.05),
    },
    perPerson: Math.round(totalEstimate / guestCount),
  };
}

/**
 * POST /api/ai/plan
 * AI-powered event planning assistant
 * Generates suggestions for checklist, timeline, suppliers, budget, style ideas, and messages
 * Body: { prompt, plan }
 */
router.post('/plan', express.json(), authRequired, applyCsrfProtection, async (req, res) => {
  const body = req.body || {};
  const promptText = String(body.prompt || '').trim();
  const plan = body.plan || {};
  const hasOpenAI = AI_ENABLED && !!openaiClient;

  const summaryBits = [];
  if (plan && typeof plan === 'object') {
    if (Array.isArray(plan.guests) && plan.guests.length) {
      summaryBits.push(`${plan.guests.length} guests in the list`);
    }
    if (Array.isArray(plan.tasks) && plan.tasks.length) {
      summaryBits.push(`${plan.tasks.length} planning tasks`);
    }
    if (Array.isArray(plan.timeline) && plan.timeline.length) {
      summaryBits.push(`${plan.timeline.length} timeline items`);
    }
  }

  const basePrompt = [
    'You are an experienced UK wedding and event planner.',
    'Return a short, structured JSON object with suggestions only – no explanation text.',
    '',
    'User description:',
    promptText || '(User did not provide extra description.)',
    '',
    'Current plan summary:',
    summaryBits.length ? `- ${summaryBits.join('\n- ')}` : 'No existing plan data.',
    '',
    'Your JSON must use this structure:',
    '{',
    '  "checklist": [ "string task 1", "string task 2" ],',
    '  "timeline": [ { "time": "14:00", "item": "Thing", "owner": "Who" } ],',
    '  "suppliers": [ { "category": "Venues", "suggestion": "Tip or type of supplier" } ],',
    '  "budget": [ { "item": "Venue", "estimate": "£2000" } ],',
    '  "styleIdeas": [ "One-sentence styling idea" ],',
    '  "messages": [ "Friendly message the user could send to a supplier" ]',
    '}',
  ].join('\n');

  if (!hasOpenAI) {
    // Fallback: simple deterministic suggestions so the feature still works without OpenAI configured.
    const fallback = {
      checklist: [
        'Lock in your venue date',
        'Confirm catering numbers and dietary requirements',
        'Book photographer / videographer',
        'Create a draft day-of timeline',
      ],
      timeline: [
        { time: '13:00', item: 'Guests arrive', owner: 'Venue' },
        { time: '14:00', item: 'Ceremony', owner: 'Registrar / celebrant' },
        { time: '15:00', item: 'Drinks reception & photos', owner: 'Venue / photographer' },
        { time: '17:30', item: 'Wedding breakfast', owner: 'Catering' },
        { time: '20:00', item: 'First dance & evening guests', owner: 'Band / DJ' },
      ],
      suppliers: [
        {
          category: 'Venues',
          suggestion: 'Shortlist 2–3 venues within 30 minutes of where most guests live.',
        },
        {
          category: 'Catering',
          suggestion: 'Ask for sample menus that cover vegan and gluten-free options.',
        },
        {
          category: 'Photography',
          suggestion: 'Look for photographers who have shot at your chosen venue before.',
        },
      ],
      budget: [
        { item: 'Venue & hire', estimate: '≈ 40% of your total budget' },
        { item: 'Food & drink', estimate: '≈ 25% of your total budget' },
        { item: 'Photography / video', estimate: '≈ 10–15% of your total budget' },
      ],
      styleIdeas: [
        'Soft green and white palette with lots of candlelight.',
        'Personal touches like table names based on places you have travelled together.',
      ],
      messages: [
        'Hi! We are planning a wedding around [DATE] for around [GUESTS] guests near [LOCATION]. Are you available, and could you share a sample package or pricing?',
        'Hi! We love your work and are planning an event in [MONTH/YEAR]. Could you let us know your availability and typical pricing for this kind of day?',
      ],
    };
    return res.json({ from: 'fallback', data: fallback });
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a concise, practical wedding and event planning assistant.',
        },
        { role: 'user', content: basePrompt },
      ],
      temperature: 0.6,
    });

    const raw =
      (completion &&
        completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content) ||
      '';
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      // If the model returns text instead of JSON, fall back to a safe minimal object.
      parsed = {
        checklist: [],
        timeline: [],
        suppliers: [],
        budget: [],
        styleIdeas: [],
        messages: [],
      };
    }
    return res.json({ from: 'openai', data: parsed });
  } catch (err) {
    console.error('OpenAI planning error', err);
    return res.status(500).json({ error: 'AI planning request failed.' });
  }
});

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
