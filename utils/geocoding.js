/**
 * Geocoding Service using postcodes.io API
 * Provides UK postcode lookup with caching
 */

'use strict';

const cache = require('../cache');

const POSTCODES_IO_BASE = 'https://api.postcodes.io';
const CACHE_TTL = 86400; // 24 hours in seconds

/**
 * Geocode a UK postcode to coordinates
 * @param {string} postcode - UK postcode to geocode
 * @returns {Promise<{latitude: number, longitude: number, postcode: string}|null>}
 */
async function geocodePostcode(postcode) {
  if (!postcode || typeof postcode !== 'string') {
    return null;
  }

  // Normalize postcode (remove spaces, uppercase)
  const normalized = postcode.replace(/\s/g, '').toUpperCase();

  // Check cache first
  const cacheKey = `geocode:${normalized}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(
      `${POSTCODES_IO_BASE}/postcodes/${encodeURIComponent(normalized)}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Postcode lookup failed for ${normalized}: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 200 && data.result) {
      const result = {
        latitude: data.result.latitude,
        longitude: data.result.longitude,
        postcode: data.result.postcode, // Returns properly formatted postcode
      };

      // Cache the result
      await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL);

      return result;
    }

    return null;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Postcode lookup timeout:', normalized);
    } else {
      console.error('Postcode lookup error:', error.message);
    }
    return null;
  }
}

/**
 * Geocode a location string (town, city, or postcode)
 * If it looks like a postcode, use postcode lookup
 * Otherwise, fall back to a simpler place lookup
 * @param {string} location - Location string to geocode
 * @returns {Promise<{latitude: number, longitude: number}|null>}
 */
async function geocodeLocation(location) {
  if (!location || typeof location !== 'string') {
    return null;
  }

  const trimmed = location.trim();

  // Check if it looks like a UK postcode (very basic check)
  const postcodePattern = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
  if (postcodePattern.test(trimmed)) {
    const result = await geocodePostcode(trimmed);
    if (result) {
      return { latitude: result.latitude, longitude: result.longitude };
    }
  }

  // Try as postcode anyway (postcodes.io is quite forgiving)
  const postcodeResult = await geocodePostcode(trimmed);
  if (postcodeResult) {
    return { latitude: postcodeResult.latitude, longitude: postcodeResult.longitude };
  }

  // For non-postcode locations (town/city names), we need another approach
  // postcodes.io doesn't support place name lookups directly
  // We could use their "nearest" endpoint with known coordinates for major cities
  // For now, return null and let the API return all venues
  console.warn(`Could not geocode location: ${location}`);
  return null;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth's radius in miles

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number}
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Validate UK postcode format
 * @param {string} postcode
 * @returns {boolean}
 */
function isValidUKPostcode(postcode) {
  if (!postcode || typeof postcode !== 'string') {
    return false;
  }

  // UK postcode regex (covers most valid formats)
  const regex =
    /^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})$|^([A-Z]{1,2}\d{1,2})\s*(\d[A-Z]{2})$/i;
  return regex.test(postcode.trim());
}

module.exports = {
  geocodePostcode,
  geocodeLocation,
  calculateDistance,
  isValidUKPostcode,
};
