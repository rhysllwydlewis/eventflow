/**
 * Test for photos routes module initialization
 * Verifies that the module can be required without dependencies initialized
 */

describe('Photos Routes Module', () => {
  test('should be requireable without crashing', () => {
    // This should not throw an error about "Cannot read properties of undefined"
    expect(() => {
      const photosRouter = require('../../routes/photos');
      expect(photosRouter).toBeDefined();
      expect(photosRouter.initializeDependencies).toBeDefined();
    }).not.toThrow();
  });

  test('should export initializeDependencies function', () => {
    const photosRouter = require('../../routes/photos');
    expect(typeof photosRouter.initializeDependencies).toBe('function');
  });
});
