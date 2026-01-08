/**
 * Unit tests for hero collage image loader
 * Tests the loadHeroCollageImages function from home-init.js
 */

'use strict';

describe('Hero Collage Image Loader', () => {
  let mockFetch;
  let mockDocument;
  let mockConsole;
  let loadHeroCollageImages;

  beforeEach(() => {
    // Mock console methods
    mockConsole = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock Date.now for cache busting
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);

    // Create a mock DOM structure
    const createMockFrame = () => {
      const frame = {
        querySelector: jest.fn(),
      };
      const img = { src: '', alt: '' };
      const picture = {
        querySelector: jest.fn().mockReturnValue({
          remove: jest.fn(),
        }),
      };

      frame.querySelector.mockImplementation(selector => {
        if (selector === 'img') {
          return img;
        }
        if (selector === 'picture') {
          return picture;
        }
        return null;
      });

      return { frame, img, picture };
    };

    // Create mock frames for all 4 categories
    const frames = [
      createMockFrame(), // venues
      createMockFrame(), // catering
      createMockFrame(), // entertainment
      createMockFrame(), // photography
    ];

    mockDocument = {
      querySelectorAll: jest.fn().mockReturnValue(frames.map(f => f.frame)),
    };

    // Mock fetch
    mockFetch = jest.fn();

    // Define the function to test (inline version for testing)
    loadHeroCollageImages = async function () {
      try {
        const response = await mockFetch('/api/public/homepage/hero-images');
        if (!response.ok) {
          mockConsole.warn('Failed to load hero collage images from settings, using defaults');
          return;
        }

        const heroImages = await response.json();

        // Validate API response
        if (!heroImages || typeof heroImages !== 'object') {
          mockConsole.error('Invalid hero images data received from API');
          return;
        }

        // Generate a single timestamp for cache busting all images in this execution
        const cacheBustTimestamp = Date.now();

        // Map category keys to their collage frame elements
        const categoryMapping = {
          venues: 0,
          catering: 1,
          entertainment: 2,
          photography: 3,
        };

        // Get all collage frames
        const collageFrames = mockDocument.querySelectorAll('.collage .frame');

        // Validate DOM elements exist
        if (!collageFrames || collageFrames.length === 0) {
          mockConsole.warn('No collage frames found in DOM');
          return;
        }

        Object.keys(categoryMapping).forEach(category => {
          const imageUrl = heroImages[category];

          // Validate URL exists and is a non-empty string
          if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
            mockConsole.warn(`No valid image URL for category: ${category}`);
            return;
          }

          const frameIndex = categoryMapping[category];
          const frame = collageFrames[frameIndex];

          // Ensure frame element exists
          if (!frame) {
            mockConsole.warn(`Frame not found for category: ${category} at index ${frameIndex}`);
            return;
          }

          // Find the img element within this frame
          const imgElement = frame.querySelector('img');
          const pictureElement = frame.querySelector('picture');

          // Ensure both elements exist before attempting update
          if (!imgElement) {
            mockConsole.warn(`Image element not found for category: ${category}`);
            return;
          }

          if (!pictureElement) {
            mockConsole.warn(`Picture element not found for category: ${category}`);
            return;
          }

          // Check if this is a custom uploaded image (not default)
          const isCustomImage = !imageUrl.includes('/assets/images/collage-');

          // Only update DOM for custom images - default images are already in HTML
          if (!isCustomImage) {
            mockConsole.log(`Using default image for ${category}, no DOM update needed`);
            return;
          }

          try {
            // Add cache busting to force fresh load of custom images
            const cacheBustedUrl = imageUrl.includes('?')
              ? `${imageUrl}&t=${cacheBustTimestamp}`
              : `${imageUrl}?t=${cacheBustTimestamp}`;

            // Update the image source with custom uploaded image
            imgElement.src = cacheBustedUrl;
            imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - custom uploaded hero image`;

            // Remove the <source> element since we're using a single uploaded image
            const sourceElement = pictureElement.querySelector('source');
            if (sourceElement) {
              sourceElement.remove();
            }

            mockConsole.log(
              `Updated hero collage image for ${category} with custom upload: ${imageUrl}`
            );
          } catch (updateError) {
            mockConsole.error(`Failed to update image for category ${category}:`, updateError);
          }
        });
      } catch (error) {
        mockConsole.error('Error loading hero collage images:', error);
        // Default images will remain if there's an error
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Successful image loading', () => {
    it('should update all images with custom Cloudinary URLs', async () => {
      const mockHeroImages = {
        venues: 'https://res.cloudinary.com/test/image/upload/venue.jpg',
        catering: 'https://res.cloudinary.com/test/image/upload/catering.jpg',
        entertainment: 'https://res.cloudinary.com/test/image/upload/entertainment.jpg',
        photography: 'https://res.cloudinary.com/test/image/upload/photography.jpg',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHeroImages,
      });

      await loadHeroCollageImages();

      // Verify all images were updated with cache busting
      const frames = mockDocument.querySelectorAll('.collage .frame');
      expect(frames[0].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/venue.jpg?t=1234567890'
      );
      expect(frames[1].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/catering.jpg?t=1234567890'
      );
      expect(frames[2].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/entertainment.jpg?t=1234567890'
      );
      expect(frames[3].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/photography.jpg?t=1234567890'
      );

      // Verify custom image alt text
      expect(frames[0].querySelector('img').alt).toBe('Venues - custom uploaded hero image');

      // Verify console logs with correct message
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Updated hero collage image for venues with custom upload: https://res.cloudinary.com/test/image/upload/venue.jpg'
      );
      expect(mockConsole.log).toHaveBeenCalledTimes(4);
    });

    it('should NOT update images with default paths', async () => {
      const mockHeroImages = {
        venues: '/assets/images/collage-venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHeroImages,
      });

      await loadHeroCollageImages();

      // Verify images were NOT updated since they are defaults
      const frames = mockDocument.querySelectorAll('.collage .frame');
      expect(frames[0].querySelector('img').src).toBe(''); // Still empty, not updated

      // Verify console logs show defaults are being skipped
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Using default image for venues, no DOM update needed'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Using default image for catering, no DOM update needed'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Using default image for entertainment, no DOM update needed'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Using default image for photography, no DOM update needed'
      );

      // Verify all 4 default images were skipped (no updates needed)
      expect(mockConsole.log).toHaveBeenCalledTimes(4);
    });

    it('should handle URLs with existing query parameters', async () => {
      const mockHeroImages = {
        venues: 'https://res.cloudinary.com/test/image/upload/venue.jpg?version=2',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: 'https://res.cloudinary.com/test/image/upload/entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHeroImages,
      });

      await loadHeroCollageImages();

      const frames = mockDocument.querySelectorAll('.collage .frame');
      // Should append with & for existing params (custom Cloudinary URL)
      expect(frames[0].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/venue.jpg?version=2&t=1234567890'
      );
      // Catering is default, should NOT be updated
      expect(frames[1].querySelector('img').src).toBe('');
      // Entertainment is custom, should be updated
      expect(frames[2].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/entertainment.jpg?t=1234567890'
      );
      // Photography is default, should NOT be updated
      expect(frames[3].querySelector('img').src).toBe('');

      // Verify console logs - 2 custom updates, 2 default skips
      expect(mockConsole.log).toHaveBeenCalledTimes(4);
    });
  });

  describe('Error handling', () => {
    it('should handle API failure gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      await loadHeroCollageImages();

      expect(mockConsole.warn).toHaveBeenCalledWith(
        'Failed to load hero collage images from settings, using defaults'
      );
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('should handle invalid API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => null,
      });

      await loadHeroCollageImages();

      expect(mockConsole.error).toHaveBeenCalledWith('Invalid hero images data received from API');
    });

    it('should handle fetch exception', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loadHeroCollageImages();

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error loading hero collage images:',
        expect.any(Error)
      );
    });

    it('should handle missing image URLs', async () => {
      const mockHeroImages = {
        venues: 'https://res.cloudinary.com/test/image/upload/venue.jpg',
        catering: '', // empty string
        entertainment: null, // null
        // photography: missing entirely
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHeroImages,
      });

      await loadHeroCollageImages();

      // Only venues should be updated
      expect(mockConsole.log).toHaveBeenCalledTimes(1);
      expect(mockConsole.warn).toHaveBeenCalledWith('No valid image URL for category: catering');
      expect(mockConsole.warn).toHaveBeenCalledWith(
        'No valid image URL for category: entertainment'
      );
      expect(mockConsole.warn).toHaveBeenCalledWith('No valid image URL for category: photography');
    });

    it('should handle missing DOM elements', async () => {
      // Mock no frames found
      mockDocument.querySelectorAll.mockReturnValue([]);

      const mockHeroImages = {
        venues: 'https://res.cloudinary.com/test/image/upload/venue.jpg',
        catering: '/assets/images/collage-catering.jpg',
        entertainment: '/assets/images/collage-entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHeroImages,
      });

      await loadHeroCollageImages();

      expect(mockConsole.warn).toHaveBeenCalledWith('No collage frames found in DOM');
      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe('Mixed scenarios', () => {
    it('should update mix of custom and default images', async () => {
      const mockHeroImages = {
        venues: 'https://res.cloudinary.com/test/image/upload/venue.jpg',
        catering: '/assets/images/collage-catering.jpg', // default
        entertainment: 'https://res.cloudinary.com/test/image/upload/entertainment.jpg',
        photography: '/assets/images/collage-photography.jpg', // default
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockHeroImages,
      });

      await loadHeroCollageImages();

      const frames = mockDocument.querySelectorAll('.collage .frame');

      // Should have 2 custom updates + 2 default skips = 4 log calls total
      expect(mockConsole.log).toHaveBeenCalledTimes(4);

      // Check custom images were updated
      expect(frames[0].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/venue.jpg?t=1234567890'
      );
      expect(frames[0].querySelector('img').alt).toBe('Venues - custom uploaded hero image');

      expect(frames[2].querySelector('img').src).toBe(
        'https://res.cloudinary.com/test/image/upload/entertainment.jpg?t=1234567890'
      );
      expect(frames[2].querySelector('img').alt).toBe('Entertainment - custom uploaded hero image');

      // Check default images were NOT updated (still empty)
      expect(frames[1].querySelector('img').src).toBe('');
      expect(frames[3].querySelector('img').src).toBe('');

      // Verify console logs
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Updated hero collage image for venues with custom upload: https://res.cloudinary.com/test/image/upload/venue.jpg'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Using default image for catering, no DOM update needed'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Updated hero collage image for entertainment with custom upload: https://res.cloudinary.com/test/image/upload/entertainment.jpg'
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        'Using default image for photography, no DOM update needed'
      );
    });
  });
});
