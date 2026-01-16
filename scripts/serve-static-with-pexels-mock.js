#!/usr/bin/env node

/**
 * Static server with mock Pexels API for testing collage widget
 * Serves the /public directory with mock API endpoints
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Enable JSON parsing
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Disable caching for development/testing
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Mock Pexels photos - using real Pexels image URLs for testing
const mockPexelsPhotos = {
  venues: [
    {
      id: 1615776,
      src: {
        large:
          'https://images.pexels.com/photos/1615776/pexels-photo-1615776.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/1615776/pexels-photo-1615776.jpeg',
      },
      photographer: 'Craig Adderley',
      photographer_url: 'https://www.pexels.com/@thatguycraig000',
    },
    {
      id: 169198,
      src: {
        large:
          'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg',
      },
      photographer: 'Pixabay',
      photographer_url: 'https://www.pexels.com/@pixabay',
    },
  ],
  catering: [
    {
      id: 958545,
      src: {
        large:
          'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg',
      },
      photographer: 'Chan Walrus',
      photographer_url: 'https://www.pexels.com/@chanwalrus',
    },
    {
      id: 1640777,
      src: {
        large:
          'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg',
      },
      photographer: 'Ella Olsson',
      photographer_url: 'https://www.pexels.com/@ella-olsson-572949',
    },
  ],
  entertainment: [
    {
      id: 1763075,
      src: {
        large:
          'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/1763075/pexels-photo-1763075.jpeg',
      },
      photographer: 'Vishnu R Nair',
      photographer_url: 'https://www.pexels.com/@vishnurnair',
    },
    {
      id: 1105666,
      src: {
        large:
          'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg',
      },
      photographer: 'Wendy Wei',
      photographer_url: 'https://www.pexels.com/@wendywei',
    },
  ],
  photography: [
    {
      id: 1983037,
      src: {
        large:
          'https://images.pexels.com/photos/1983037/pexels-photo-1983037.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/1983037/pexels-photo-1983037.jpeg',
      },
      photographer: 'Tuur Tisseghem',
      photographer_url: 'https://www.pexels.com/@tuur',
    },
    {
      id: 1251832,
      src: {
        large:
          'https://images.pexels.com/photos/1251832/pexels-photo-1251832.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        original: 'https://images.pexels.com/photos/1251832/pexels-photo-1251832.jpeg',
      },
      photographer: 'Terje Sollie',
      photographer_url: 'https://www.pexels.com/@terje',
    },
  ],
};

// Mock homepage settings endpoint with Pexels enabled
app.get('/api/public/homepage-settings', (req, res) => {
  console.log('[Mock] Homepage settings requested');
  res.json({
    // New format
    collageWidget: {
      enabled: true,
      source: 'pexels',
      mediaTypes: { photos: true, videos: false },
      intervalSeconds: 2.5,
      pexelsQueries: {
        venues: 'wedding venue elegant ballroom',
        catering: 'wedding catering food elegant',
        entertainment: 'live band wedding party',
        photography: 'wedding photography professional',
      },
      uploadGallery: [],
      fallbackToPexels: true,
    },
    // Legacy format (for backward compatibility)
    pexelsCollageEnabled: true,
    pexelsCollageSettings: {
      queries: {
        venues: 'wedding venue elegant ballroom',
        catering: 'wedding catering food elegant',
        entertainment: 'live band wedding party',
        photography: 'wedding photography professional',
      },
      intervalSeconds: 2.5,
    },
  });
});

// Mock Pexels collage endpoint
app.get('/api/admin/public/pexels-collage', (req, res) => {
  const { category } = req.query;

  console.log(`[Mock Pexels] Request for category: ${category}`);

  if (!category) {
    return res.status(400).json({
      error: 'Category parameter required',
      errorType: 'validation',
    });
  }

  const validCategories = ['venues', 'catering', 'entertainment', 'photography'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({
      error: `Invalid category. Must be one of: ${validCategories.join(', ')}`,
      errorType: 'validation',
      validCategories,
    });
  }

  const photos = mockPexelsPhotos[category] || [];

  console.log(`[Mock Pexels] Returning ${photos.length} photos for ${category}`);

  res.json({
    success: true,
    category,
    photos,
    source: 'mock',
    usingFallback: false,
  });
});

// Stub /api/health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'mock-pexels' });
});

// Serve static files from public directory
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock Pexels server running at http://127.0.0.1:${PORT}`);
  console.log(`Serving directory: ${PUBLIC_DIR}`);
  console.log(`Mock Pexels API available at /api/admin/public/pexels-collage?category=<category>`);
});
