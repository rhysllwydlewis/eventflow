/**
 * Firebase Configuration for EventFlow
 *
 * This file initializes Firebase SDK using the npm package (modular v9+ SDK).
 * It provides a centralized configuration that can be used in Node.js environments
 * or with build tools like Webpack, Vite, or Rollup.
 *
 * For browser-only usage without a build step, see: /public/assets/js/firebase-config.js
 * which uses CDN imports.
 *
 * @module firebase
 * @requires firebase/app - Core Firebase SDK
 * @requires firebase/auth - Firebase Authentication
 * @requires firebase/firestore - Cloud Firestore database
 * @requires firebase/analytics - Firebase Analytics (optional, browser-only)
 */

// Import Firebase SDK modules (npm package)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

/**
 * Firebase project configuration
 *
 * SECURITY NOTE: These values are safe to expose in client-side code.
 * Firebase API keys are not secret keys - they simply identify your Firebase project.
 * Security is enforced through:
 * - Firestore Security Rules (database access control)
 * - Storage Security Rules (file access control)
 * - Firebase Authentication (user identity)
 *
 * For production use, consider loading these from environment variables:
 * - process.env.FIREBASE_API_KEY
 * - process.env.FIREBASE_AUTH_DOMAIN
 * - etc.
 *
 * @see https://firebase.google.com/docs/projects/api-keys
 */
const firebaseConfig = {
  apiKey: 'AIzaSyAbFoGEvaAQcAvjL716cPSs1KDMkriahqc',
  authDomain: 'eventflow-ffb12.firebaseapp.com',
  projectId: 'eventflow-ffb12',
  storageBucket: 'eventflow-ffb12.firebasestorage.app',
  messagingSenderId: '253829522456',
  appId: '1:253829522456:web:3fae1bcec63932321bcf6d',
  measurementId: 'G-JRT11771YD',
};

/**
 * Initialize Firebase App
 *
 * This should only run once. The SDK handles multiple calls gracefully,
 * but we export the app instance to ensure consistency across modules.
 *
 * @type {FirebaseApp}
 */
const app = initializeApp(firebaseConfig);

/**
 * Firebase Authentication service
 *
 * Provides user authentication with multiple sign-in methods:
 * - Email/Password
 * - Google Sign-In
 * - Anonymous auth
 * - Custom tokens
 *
 * Usage example:
 * ```javascript
 * import { auth } from './firebase';
 * import { signInWithEmailAndPassword } from 'firebase/auth';
 *
 * const userCredential = await signInWithEmailAndPassword(auth, email, password);
 * ```
 *
 * @type {Auth}
 */
const auth = getAuth(app);

/**
 * Cloud Firestore database service
 *
 * NoSQL document database for storing and syncing data.
 * Organized in collections and documents with real-time updates.
 *
 * Usage example:
 * ```javascript
 * import { db } from './firebase';
 * import { collection, addDoc } from 'firebase/firestore';
 *
 * const docRef = await addDoc(collection(db, 'events'), {
 *   title: 'Wedding',
 *   date: '2024-06-15'
 * });
 * ```
 *
 * @type {Firestore}
 */
const db = getFirestore(app);

/**
 * Firebase Analytics (optional, browser-only)
 *
 * Provides app analytics and user engagement tracking.
 * Only works in browser environments with proper analytics support.
 *
 * Note: Analytics initialization is async and may not be supported in all environments
 * (e.g., server-side rendering, certain browsers with privacy settings).
 *
 * @type {Analytics | null}
 */
let analytics = null;

// Initialize analytics only in browser environments where it's supported
if (typeof window !== 'undefined') {
  isSupported()
    .then(supported => {
      if (supported) {
        analytics = getAnalytics(app);
        console.log('Firebase Analytics initialized');
      }
    })
    .catch(error => {
      console.warn('Firebase Analytics not supported:', error.message);
    });
}

/**
 * Export Firebase services for use throughout the application
 *
 * Named exports for individual services:
 * - app: Firebase App instance
 * - auth: Authentication service
 * - db: Firestore database service
 * - analytics: Analytics service (may be null if not supported)
 */
export { app, auth, db, analytics };

/**
 * Default export for convenience
 * Allows importing all services at once:
 * ```javascript
 * import firebase from './firebase';
 * const { auth, db } = firebase;
 * ```
 */
export default {
  app,
  auth,
  db,
  analytics,
};

// Log successful initialization (useful for debugging)
console.log('Firebase initialized successfully (npm module)');
