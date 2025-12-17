/**
 * Firebase Configuration - Alternative Import Path
 *
 * This is a convenience re-export of the main Firebase configuration.
 * It allows importing from 'src/firebase.js' instead of 'src/config/firebase.js'.
 *
 * Usage:
 * ```javascript
 * // Both import paths work:
 * import { auth, db } from './src/firebase';
 * import { auth, db } from './src/config/firebase';
 * ```
 */

export * from './config/firebase.js';
export { default } from './config/firebase.js';
