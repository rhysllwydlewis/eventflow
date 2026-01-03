/**
 * Unit tests for geocoding utility functions
 */

const geocoding = require('../../utils/geocoding');

describe('Geocoding Utility', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two coordinates', () => {
      // London to Cardiff approximately 150 miles
      const londonLat = 51.5074;
      const londonLon = -0.1278;
      const cardiffLat = 51.4816;
      const cardiffLon = -3.1791;

      const distance = geocoding.calculateDistance(londonLat, londonLon, cardiffLat, cardiffLon);

      // Distance should be around 150 miles (allow some tolerance)
      expect(distance).toBeGreaterThan(140);
      expect(distance).toBeLessThan(160);
    });

    it('should return 0 for same coordinates', () => {
      const distance = geocoding.calculateDistance(51.5074, -0.1278, 51.5074, -0.1278);
      expect(distance).toBe(0);
    });

    it('should calculate distance for close coordinates', () => {
      // Two points about 1 mile apart
      const lat1 = 51.5074;
      const lon1 = -0.1278;
      const lat2 = 51.5200;
      const lon2 = -0.1400;

      const distance = geocoding.calculateDistance(lat1, lon1, lat2, lon2);

      // Distance should be a few miles
      expect(distance).toBeGreaterThan(0.5);
      expect(distance).toBeLessThan(2);
    });
  });

  describe('isValidUKPostcode', () => {
    it('should validate correct UK postcodes', () => {
      expect(geocoding.isValidUKPostcode('SW1A 1AA')).toBe(true);
      expect(geocoding.isValidUKPostcode('M1 1AA')).toBe(true);
      expect(geocoding.isValidUKPostcode('B33 8TH')).toBe(true);
      expect(geocoding.isValidUKPostcode('CR2 6XH')).toBe(true);
      expect(geocoding.isValidUKPostcode('DN55 1PT')).toBe(true);
    });

    it('should validate postcodes without spaces', () => {
      expect(geocoding.isValidUKPostcode('SW1A1AA')).toBe(true);
      expect(geocoding.isValidUKPostcode('M11AA')).toBe(true);
    });

    it('should reject invalid postcodes', () => {
      expect(geocoding.isValidUKPostcode('INVALID')).toBe(false);
      expect(geocoding.isValidUKPostcode('12345')).toBe(false);
      expect(geocoding.isValidUKPostcode('')).toBe(false);
      expect(geocoding.isValidUKPostcode(null)).toBe(false);
      expect(geocoding.isValidUKPostcode(undefined)).toBe(false);
    });

    it('should handle case insensitivity', () => {
      expect(geocoding.isValidUKPostcode('sw1a 1aa')).toBe(true);
      expect(geocoding.isValidUKPostcode('SW1A 1AA')).toBe(true);
      expect(geocoding.isValidUKPostcode('Sw1A 1aA')).toBe(true);
    });
  });

  describe('geocodePostcode', () => {
    it('should return null for invalid postcode', async () => {
      const result = await geocoding.geocodePostcode('INVALID');
      expect(result).toBeNull();
    });

    it('should return null for empty postcode', async () => {
      const result = await geocoding.geocodePostcode('');
      expect(result).toBeNull();
    });

    it('should return null for non-string input', async () => {
      const result = await geocoding.geocodePostcode(null);
      expect(result).toBeNull();
    });

    // Note: Real API tests would require mocking or integration testing
    // These are structure tests only
  });

  describe('geocodeLocation', () => {
    it('should return null for empty location', async () => {
      const result = await geocoding.geocodeLocation('');
      expect(result).toBeNull();
    });

    it('should return null for non-string input', async () => {
      const result = await geocoding.geocodeLocation(null);
      expect(result).toBeNull();
    });

    // Note: Real API tests would require mocking or integration testing
  });
});
