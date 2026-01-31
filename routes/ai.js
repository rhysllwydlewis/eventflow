/**
 * AI Routes
 * Handles AI-powered suggestions and recommendations
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const dbUnified = require('../db-unified');

const router = express.Router();

// In-memory cache for suggestions to avoid repeated calculations
const suggestionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/ai/suggestions
 * Generate event planning suggestions based on user input
 * Body: { eventType, location, budget, guests, eventDate }
 */
router.post('/suggestions', authRequired, async (req, res) => {
  try {
    const { eventType, location, budget, guests, eventDate } = req.body;

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

module.exports = router;
