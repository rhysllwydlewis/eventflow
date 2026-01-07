/**
 * Marketplace Listing Validation Tests
 * Test suite for comprehensive marketplace listing validation
 * Including support for price=0 (free listings)
 * PR #219
 */

const assert = require('assert');

describe('Marketplace Listing Validation', () => {
  let validationService;

  beforeEach(() => {
    // Mock validation service
    validationService = {
      validateListing: (listing) => {
        const errors = [];

        // Validate title
        if (!listing.title || listing.title.trim().length === 0) {
          errors.push('Title is required');
        } else if (listing.title.length < 3) {
          errors.push('Title must be at least 3 characters');
        } else if (listing.title.length > 200) {
          errors.push('Title must not exceed 200 characters');
        }

        // Validate description
        if (!listing.description || listing.description.trim().length === 0) {
          errors.push('Description is required');
        } else if (listing.description.length < 10) {
          errors.push('Description must be at least 10 characters');
        } else if (listing.description.length > 5000) {
          errors.push('Description must not exceed 5000 characters');
        }

        // Validate price (including support for price=0)
        if (listing.price === undefined || listing.price === null) {
          errors.push('Price is required');
        } else if (typeof listing.price !== 'number') {
          errors.push('Price must be a number');
        } else if (listing.price < 0) {
          errors.push('Price cannot be negative');
        } else if (!Number.isFinite(listing.price)) {
          errors.push('Price must be a finite number');
        } else if (listing.price !== 0 && listing.price < 0.01) {
          errors.push('Price must be 0 or at least 0.01');
        }

        // Validate category
        const validCategories = ['services', 'products', 'experiences', 'workshops'];
        if (!listing.category) {
          errors.push('Category is required');
        } else if (!validCategories.includes(listing.category)) {
          errors.push(`Category must be one of: ${validCategories.join(', ')}`);
        }

        // Validate currency
        const validCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'];
        if (!listing.currency) {
          errors.push('Currency is required');
        } else if (!validCurrencies.includes(listing.currency)) {
          errors.push(`Currency must be one of: ${validCurrencies.join(', ')}`);
        }

        // Validate images
        if (!listing.images || !Array.isArray(listing.images)) {
          errors.push('Images must be an array');
        } else if (listing.images.length === 0) {
          errors.push('At least one image is required');
        } else if (listing.images.length > 10) {
          errors.push('Maximum 10 images allowed');
        } else {
          listing.images.forEach((image, index) => {
            if (!image.url || image.url.trim().length === 0) {
              errors.push(`Image ${index + 1}: URL is required`);
            }
            if (!image.alt || image.alt.trim().length === 0) {
              errors.push(`Image ${index + 1}: Alt text is required`);
            }
          });
        }

        // Validate location (optional but if provided must be valid)
        if (listing.location) {
          if (!listing.location.country) {
            errors.push('Location: Country is required if location is provided');
          }
          if (!listing.location.city) {
            errors.push('Location: City is required if location is provided');
          }
        }

        // Validate tags (optional)
        if (listing.tags) {
          if (!Array.isArray(listing.tags)) {
            errors.push('Tags must be an array');
          } else if (listing.tags.length > 10) {
            errors.push('Maximum 10 tags allowed');
          } else {
            listing.tags.forEach((tag, index) => {
              if (typeof tag !== 'string' || tag.trim().length === 0) {
                errors.push(`Tag ${index + 1}: Must be a non-empty string`);
              }
            });
          }
        }

        return {
          isValid: errors.length === 0,
          errors: errors,
          warnings: []
        };
      }
    };
  });

  describe('Basic Validation', () => {
    it('should validate a complete listing with positive price', () => {
      const listing = {
        title: 'Professional Photography Service',
        description: 'High-quality professional photography for your events',
        price: 150.00,
        category: 'services',
        currency: 'USD',
        images: [
          { url: 'https://example.com/photo1.jpg', alt: 'Photo sample 1' }
        ]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should validate a free listing with price=0', () => {
      const listing = {
        title: 'Free Community Workshop',
        description: 'A comprehensive free workshop for community members',
        price: 0,
        category: 'workshops',
        currency: 'USD',
        images: [
          { url: 'https://example.com/workshop.jpg', alt: 'Workshop image' }
        ]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should validate listing with multiple images', () => {
      const listing = {
        title: 'Event Decoration Package',
        description: 'Complete event decoration service with professional setup',
        price: 0,
        category: 'services',
        currency: 'USD',
        images: [
          { url: 'https://example.com/img1.jpg', alt: 'Setup image 1' },
          { url: 'https://example.com/img2.jpg', alt: 'Setup image 2' },
          { url: 'https://example.com/img3.jpg', alt: 'Setup image 3' }
        ]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });
  });

  describe('Price Validation - Including Price=0 Support', () => {
    it('should accept price of 0 for free listings', () => {
      const listing = {
        title: 'Free Service',
        description: 'This is a completely free service offering',
        price: 0,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/free.jpg', alt: 'Free offer' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
      const priceErrors = result.errors.filter(e => e.includes('Price'));
      assert.strictEqual(priceErrors.length, 0);
    });

    it('should accept price of 0.01 (minimum positive price)', () => {
      const listing = {
        title: 'Budget Service',
        description: 'Affordable service option for everyone',
        price: 0.01,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/cheap.jpg', alt: 'Affordable' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });

    it('should reject negative prices', () => {
      const listing = {
        title: 'Invalid Listing',
        description: 'This listing has an invalid negative price',
        price: -10,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('negative')));
    });

    it('should reject prices between 0 and 0.01 (excluding 0)', () => {
      const listing = {
        title: 'Invalid Pricing',
        description: 'This listing has an invalid price amount',
        price: 0.005,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('0 or at least 0.01')));
    });

    it('should reject missing price', () => {
      const listing = {
        title: 'Missing Price',
        description: 'This listing is missing the price field',
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Price is required')));
    });

    it('should reject non-numeric prices', () => {
      const listing = {
        title: 'Invalid Price Type',
        description: 'This listing has a non-numeric price',
        price: 'expensive',
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('must be a number')));
    });

    it('should reject Infinity and NaN prices', () => {
      const listingInfinity = {
        title: 'Infinite Price',
        description: 'This listing has an infinite price',
        price: Infinity,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const resultInfinity = validationService.validateListing(listingInfinity);
      assert.strictEqual(resultInfinity.isValid, false);
      assert(resultInfinity.errors.some(e => e.includes('finite')));

      const listingNaN = {
        title: 'NaN Price',
        description: 'This listing has a NaN price',
        price: NaN,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const resultNaN = validationService.validateListing(listingNaN);
      assert.strictEqual(resultNaN.isValid, false);
      assert(resultNaN.errors.some(e => e.includes('finite')));
    });

    it('should accept various positive prices', () => {
      const prices = [0.50, 1, 10, 99.99, 1000, 10000.50];

      prices.forEach(price => {
        const listing = {
          title: 'Valid Pricing',
          description: 'This listing has valid pricing',
          price: price,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(
          result.isValid,
          true,
          `Price ${price} should be valid`
        );
      });
    });
  });

  describe('Title Validation', () => {
    it('should reject empty title', () => {
      const listing = {
        title: '',
        description: 'A valid description here',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Title is required')));
    });

    it('should reject title shorter than 3 characters', () => {
      const listing = {
        title: 'ab',
        description: 'A valid description here',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('at least 3 characters')));
    });

    it('should reject title longer than 200 characters', () => {
      const listing = {
        title: 'A'.repeat(201),
        description: 'A valid description here',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('not exceed 200 characters')));
    });
  });

  describe('Description Validation', () => {
    it('should reject empty description', () => {
      const listing = {
        title: 'Valid Title',
        description: '',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Description is required')));
    });

    it('should reject description shorter than 10 characters', () => {
      const listing = {
        title: 'Valid Title',
        description: 'Short',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('at least 10 characters')));
    });

    it('should reject description longer than 5000 characters', () => {
      const listing = {
        title: 'Valid Title',
        description: 'A'.repeat(5001),
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('not exceed 5000 characters')));
    });
  });

  describe('Category Validation', () => {
    it('should accept valid categories', () => {
      const validCategories = ['services', 'products', 'experiences', 'workshops'];

      validCategories.forEach(category => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: category,
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
        };

        const result = validationService.validateListing(listing);
        assert(
          result.isValid,
          `Category '${category}' should be valid`
        );
      });
    });

    it('should reject invalid category', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'invalid_category',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Category must be one of')));
    });

    it('should reject missing category', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Category is required')));
    });
  });

  describe('Currency Validation', () => {
    it('should accept valid currencies', () => {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD'];

      validCurrencies.forEach(currency => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: currency,
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
        };

        const result = validationService.validateListing(listing);
        assert(
          result.isValid,
          `Currency '${currency}' should be valid`
        );
      });
    });

    it('should reject invalid currency', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'XYZ',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Currency must be one of')));
    });

    it('should reject missing currency', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Currency is required')));
    });
  });

  describe('Images Validation', () => {
    it('should reject missing images', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD'
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Images must be an array')));
    });

    it('should reject empty images array', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: []
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('At least one image is required')));
    });

    it('should reject more than 10 images', () => {
      const images = Array(11).fill(null).map((_, i) => ({
        url: `https://example.com/img${i}.jpg`,
        alt: `Image ${i}`
      }));

      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: images
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Maximum 10 images allowed')));
    });

    it('should accept exactly 10 images', () => {
      const images = Array(10).fill(null).map((_, i) => ({
        url: `https://example.com/img${i}.jpg`,
        alt: `Image ${i}`
      }));

      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: images
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });

    it('should reject image with missing URL', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [
          { url: '', alt: 'Image' }
        ]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Image 1') && e.includes('URL is required')));
    });

    it('should reject image with missing alt text', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [
          { url: 'https://example.com/img.jpg', alt: '' }
        ]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Image 1') && e.includes('Alt text is required')));
    });
  });

  describe('Optional Fields Validation', () => {
    describe('Location', () => {
      it('should accept listing without location', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, true);
      });

      it('should validate complete location object', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          location: {
            country: 'United Kingdom',
            city: 'London'
          }
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, true);
      });

      it('should reject location without country', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          location: {
            city: 'London'
          }
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, false);
        assert(result.errors.some(e => e.includes('Country is required')));
      });

      it('should reject location without city', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          location: {
            country: 'United Kingdom'
          }
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, false);
        assert(result.errors.some(e => e.includes('City is required')));
      });
    });

    describe('Tags', () => {
      it('should accept listing without tags', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, true);
      });

      it('should accept listing with valid tags', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          tags: ['event', 'professional', 'photography']
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, true);
      });

      it('should reject tags if not an array', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          tags: 'event'
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, false);
        assert(result.errors.some(e => e.includes('Tags must be an array')));
      });

      it('should reject more than 10 tags', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          tags: Array(11).fill('tag')
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, false);
        assert(result.errors.some(e => e.includes('Maximum 10 tags allowed')));
      });

      it('should reject empty tag strings', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          tags: ['event', '', 'photography']
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, false);
        assert(result.errors.some(e => e.includes('Tag') && e.includes('non-empty string')));
      });

      it('should accept exactly 10 tags', () => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: 50,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
          tags: Array(10).fill(null).map((_, i) => `tag${i}`)
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(result.isValid, true);
      });
    });
  });

  describe('Complex Scenarios - Price=0 Focus', () => {
    it('should validate free workshop with comprehensive details', () => {
      const listing = {
        title: 'Free Community Gardening Workshop',
        description: 'Learn sustainable gardening techniques in this free community workshop. Perfect for beginners.',
        price: 0,
        category: 'workshops',
        currency: 'USD',
        images: [
          { url: 'https://example.com/workshop1.jpg', alt: 'Garden workshop' },
          { url: 'https://example.com/workshop2.jpg', alt: 'Participants gardening' }
        ],
        location: {
          country: 'United Kingdom',
          city: 'Manchester'
        },
        tags: ['free', 'gardening', 'workshop', 'sustainable']
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should validate free product offering', () => {
      const listing = {
        title: 'Free Sample Products',
        description: 'High-quality sample products available for free to test our offerings',
        price: 0,
        category: 'products',
        currency: 'EUR',
        images: [
          { url: 'https://example.com/sample1.jpg', alt: 'Product sample' }
        ],
        location: {
          country: 'Germany',
          city: 'Berlin'
        },
        tags: ['free', 'sample', 'products']
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });

    it('should handle mixed listings with price=0 and paid listings', () => {
      const freeListing = {
        title: 'Free Service',
        description: 'This is a free service offering to the community',
        price: 0,
        category: 'services',
        currency: 'GBP',
        images: [{ url: 'https://example.com/free.jpg', alt: 'Free offer' }]
      };

      const paidListing = {
        title: 'Premium Service',
        description: 'This is a premium paid service with additional features',
        price: 99.99,
        category: 'services',
        currency: 'GBP',
        images: [{ url: 'https://example.com/premium.jpg', alt: 'Premium offer' }]
      };

      const freeResult = validationService.validateListing(freeListing);
      const paidResult = validationService.validateListing(paidListing);

      assert.strictEqual(freeResult.isValid, true);
      assert.strictEqual(paidResult.isValid, true);
    });

    it('should validate listing with minimum price and maximum details', () => {
      const listing = {
        title: 'Almost Free Service Offering',
        description: 'An incredibly affordable service that costs just one cent, providing exceptional value',
        price: 0.01,
        category: 'services',
        currency: 'USD',
        images: Array(10).fill(null).map((_, i) => ({
          url: `https://example.com/img${i}.jpg`,
          alt: `Service image ${i}`
        })),
        location: {
          country: 'Canada',
          city: 'Toronto'
        },
        tags: ['affordable', 'budget', 'service', 'cheap', 'value', 'penny', 'deal', 'offer', 'save', 'cheap-deals']
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle listing with very long but valid description', () => {
      const listing = {
        title: 'Comprehensive Service',
        description: 'A'.repeat(5000),
        price: 0,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });

    it('should handle listing with exactly 200 character title', () => {
      const listing = {
        title: 'A'.repeat(200),
        description: 'This is a valid description for the service',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });

    it('should handle listing with multiple validation errors', () => {
      const listing = {
        title: '',
        description: '',
        price: -50,
        category: 'invalid',
        currency: 'INVALID',
        images: []
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.length > 3, 'Should have multiple errors');
    });

    it('should handle listing with null values for optional fields', () => {
      const listing = {
        title: 'Valid Title',
        description: 'This is a valid description',
        price: 0,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }],
        location: null,
        tags: null
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });

    it('should validate decimal prices with various precision', () => {
      const prices = [0, 0.01, 0.1, 1.99, 99.999, 999.99, 1000.01];

      prices.forEach(price => {
        const listing = {
          title: 'Valid Title',
          description: 'This is a valid description',
          price: price,
          category: 'services',
          currency: 'USD',
          images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
        };

        const result = validationService.validateListing(listing);
        assert.strictEqual(
          result.isValid,
          true,
          `Price ${price} should be valid`
        );
      });
    });
  });

  describe('Whitespace Handling', () => {
    it('should reject title with only whitespace', () => {
      const listing = {
        title: '   ',
        description: 'This is a valid description',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Title is required')));
    });

    it('should reject description with only whitespace', () => {
      const listing = {
        title: 'Valid Title',
        description: '   ',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, false);
      assert(result.errors.some(e => e.includes('Description is required')));
    });

    it('should trim whitespace from title and description', () => {
      const listing = {
        title: '  Valid Title  ',
        description: '  This is a valid description  ',
        price: 50,
        category: 'services',
        currency: 'USD',
        images: [{ url: 'https://example.com/img.jpg', alt: 'Image' }]
      };

      const result = validationService.validateListing(listing);
      assert.strictEqual(result.isValid, true);
    });
  });
});
