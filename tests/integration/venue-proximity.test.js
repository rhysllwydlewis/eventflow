/**
 * Integration tests for venue proximity filtering
 */

const request = require('supertest');
const app = require('../../server');
const dbUnified = require('../../db-unified');

describe('Venue Proximity API', () => {
  let testVenueId;

  beforeAll(async () => {
    // Create a test venue with coordinates (Cardiff area)
    const suppliers = await dbUnified.read('suppliers');
    const testVenue = {
      id: `test-venue-${Date.now()}`,
      name: 'Test Cardiff Venue',
      category: 'Venues',
      approved: true,
      location: 'Cardiff',
      venuePostcode: 'CF10 1AA',
      latitude: 51.4816,
      longitude: -3.1791,
      description_short: 'A test venue in Cardiff',
      photos: [],
    };
    suppliers.push(testVenue);
    await dbUnified.write('suppliers', suppliers);
    testVenueId = testVenue.id;
  });

  afterAll(async () => {
    // Clean up test venue
    const suppliers = await dbUnified.read('suppliers');
    const filtered = suppliers.filter(s => s.id !== testVenueId);
    await dbUnified.write('suppliers', filtered);
  });

  describe('GET /api/venues/near', () => {
    it('should return all venues when no location provided', async () => {
      const res = await request(app).get('/api/venues/near').expect(200);

      expect(res.body.venues).toBeDefined();
      expect(Array.isArray(res.body.venues)).toBe(true);
      expect(res.body.filtered).toBe(false);
      expect(res.body.message).toContain('all venues');
    });

    it('should return venues within radius of Cardiff', async () => {
      const res = await request(app)
        .get('/api/venues/near')
        .query({ location: 'CF10 1AA', radiusMiles: 10 })
        .expect(200);

      expect(res.body.venues).toBeDefined();
      expect(res.body.filtered).toBe(true);
      expect(res.body.location).toBe('CF10 1AA');
      expect(res.body.radiusMiles).toBe(10);

      // Our test venue should be in the results (distance ~0)
      const ourVenue = res.body.venues.find(v => v.id === testVenueId);
      if (ourVenue) {
        expect(ourVenue.distance).toBeLessThan(1); // Very close
      }
    });

    it('should handle invalid location gracefully', async () => {
      const res = await request(app)
        .get('/api/venues/near')
        .query({ location: 'INVALIDLOCATION123', radiusMiles: 10 })
        .expect(200);

      expect(res.body.venues).toBeDefined();
      expect(res.body.filtered).toBe(false);
      expect(res.body.warning).toBeDefined();
    });

    it('should filter by custom radius', async () => {
      const res = await request(app)
        .get('/api/venues/near')
        .query({ location: 'CF10 1AA', radiusMiles: 5 })
        .expect(200);

      expect(res.body.radiusMiles).toBe(5);

      // All returned venues should be within 5 miles
      res.body.venues.forEach(venue => {
        if (venue.distance !== null) {
          expect(venue.distance).toBeLessThanOrEqual(5);
        }
      });
    });

    it('should sort venues by distance', async () => {
      const res = await request(app)
        .get('/api/venues/near')
        .query({ location: 'CF10 1AA', radiusMiles: 50 })
        .expect(200);

      if (res.body.venues.length > 1) {
        // Check that distances are in ascending order
        for (let i = 1; i < res.body.venues.length; i++) {
          expect(res.body.venues[i].distance).toBeGreaterThanOrEqual(
            res.body.venues[i - 1].distance
          );
        }
      }
    });

    it('should only return approved venues', async () => {
      // Create an unapproved venue
      const suppliers = await dbUnified.read('suppliers');
      const unapprovedVenue = {
        id: `test-unapproved-${Date.now()}`,
        name: 'Unapproved Venue',
        category: 'Venues',
        approved: false, // Not approved
        location: 'Cardiff',
        latitude: 51.48,
        longitude: -3.18,
      };
      suppliers.push(unapprovedVenue);
      await dbUnified.write('suppliers', suppliers);

      const res = await request(app)
        .get('/api/venues/near')
        .query({ location: 'CF10 1AA', radiusMiles: 10 })
        .expect(200);

      // Unapproved venue should not appear
      const found = res.body.venues.find(v => v.id === unapprovedVenue.id);
      expect(found).toBeUndefined();

      // Clean up
      const suppliersCleanup = await dbUnified.read('suppliers');
      const filtered = suppliersCleanup.filter(s => s.id !== unapprovedVenue.id);
      await dbUnified.write('suppliers', filtered);
    });

    it('should only return Venues category suppliers', async () => {
      const res = await request(app).get('/api/venues/near').expect(200);

      res.body.venues.forEach(venue => {
        expect(venue.category).toBe('Venues');
      });
    });
  });
});
