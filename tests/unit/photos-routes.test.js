/**
 * Test for photos routes module initialization
 * Verifies that the module can be required without dependencies initialized
 * and that it properly handles uninitialized state
 */

describe('Photos Routes Module', () => {
  test('should be requireable without crashing', () => {
    // This should not throw an error about "Cannot read properties of undefined"
    // This was the original bug - requiring the module would crash at line 102
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

  test('should export a router instance', () => {
    const photosRouter = require('../../routes/photos');
    // Express routers have typical routing methods
    expect(typeof photosRouter.post).toBe('function');
    expect(typeof photosRouter.get).toBe('function');
    expect(typeof photosRouter.put).toBe('function');
    expect(typeof photosRouter.delete).toBe('function');
  });
});
