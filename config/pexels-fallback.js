/**
 * Pexels Fallback Configuration
 * Provides hardcoded URLs from curated wedding collections as fallback
 * when the Pexels API is unavailable or not configured.
 *
 * These URLs are direct Pexels CDN links that don't require API authentication.
 * They provide a graceful degradation path for the homepage hero collage.
 *
 * Collections:
 * - Photos: Wedding Standard Collection (curated wedding photos)
 * - Videos: Wedding Standard Videos Collection (curated wedding videos)
 *
 * URL Validation:
 * - All URLs follow the Pexels CDN format: https://images.pexels.com/...
 * - Photo URLs support query parameters for responsive sizing (auto=compress, w=width, h=height)
 * - URLs are public and do not require authentication
 * - Run validation script: node /tmp/validate-fallback-urls.js (requires network access)
 *
 * Note: These fallback URLs should be periodically validated to ensure they remain accessible.
 * If URLs become broken, they should be replaced with new curated photo/video URLs from Pexels.
 */

'use strict';

/**
 * Fallback photo URLs from curated wedding collections
 * These are high-quality wedding-related photos suitable for hero sections
 * All images are free to use per Pexels license
 */
const FALLBACK_PHOTOS = [
  {
    id: 'fallback-photo-1',
    url: 'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg',
      large:
        'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/169198/pexels-photo-169198.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding ceremony setup',
  },
  {
    id: 'fallback-photo-2',
    url: 'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg',
      large:
        'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1024993/pexels-photo-1024993.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding bouquet',
  },
  {
    id: 'fallback-photo-3',
    url: 'https://images.pexels.com/photos/1444442/pexels-photo-1444442.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1444442/pexels-photo-1444442.jpeg',
      large:
        'https://images.pexels.com/photos/1444442/pexels-photo-1444442.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1444442/pexels-photo-1444442.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1444442/pexels-photo-1444442.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding venue decoration',
  },
  {
    id: 'fallback-photo-4',
    url: 'https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg',
      large:
        'https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/2253870/pexels-photo-2253870.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding rings',
  },
  {
    id: 'fallback-photo-5',
    url: 'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg',
      large:
        'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/265722/pexels-photo-265722.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding table setting',
  },
  {
    id: 'fallback-photo-6',
    url: 'https://images.pexels.com/photos/1779490/pexels-photo-1779490.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1779490/pexels-photo-1779490.jpeg',
      large:
        'https://images.pexels.com/photos/1779490/pexels-photo-1779490.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1779490/pexels-photo-1779490.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1779490/pexels-photo-1779490.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding cake',
  },
  {
    id: 'fallback-photo-7',
    url: 'https://images.pexels.com/photos/1045541/pexels-photo-1045541.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1045541/pexels-photo-1045541.jpeg',
      large:
        'https://images.pexels.com/photos/1045541/pexels-photo-1045541.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1045541/pexels-photo-1045541.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1045541/pexels-photo-1045541.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding couple',
  },
  {
    id: 'fallback-photo-8',
    url: 'https://images.pexels.com/photos/1616113/pexels-photo-1616113.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1616113/pexels-photo-1616113.jpeg',
      large:
        'https://images.pexels.com/photos/1616113/pexels-photo-1616113.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1616113/pexels-photo-1616113.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1616113/pexels-photo-1616113.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding celebration',
  },
  {
    id: 'fallback-photo-9',
    url: 'https://images.pexels.com/photos/2788488/pexels-photo-2788488.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/2788488/pexels-photo-2788488.jpeg',
      large:
        'https://images.pexels.com/photos/2788488/pexels-photo-2788488.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/2788488/pexels-photo-2788488.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/2788488/pexels-photo-2788488.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding dance',
  },
  {
    id: 'fallback-photo-10',
    url: 'https://images.pexels.com/photos/1444424/pexels-photo-1444424.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1444424/pexels-photo-1444424.jpeg',
      large:
        'https://images.pexels.com/photos/1444424/pexels-photo-1444424.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1444424/pexels-photo-1444424.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1444424/pexels-photo-1444424.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding flowers',
  },
  {
    id: 'fallback-photo-11',
    url: 'https://images.pexels.com/photos/2253842/pexels-photo-2253842.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/2253842/pexels-photo-2253842.jpeg',
      large:
        'https://images.pexels.com/photos/2253842/pexels-photo-2253842.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/2253842/pexels-photo-2253842.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/2253842/pexels-photo-2253842.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding venue',
  },
  {
    id: 'fallback-photo-12',
    url: 'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg',
      large:
        'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1043902/pexels-photo-1043902.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding invitation',
  },
  {
    id: 'fallback-photo-13',
    url: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg',
      large:
        'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/3014856/pexels-photo-3014856.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding photography',
  },
  {
    id: 'fallback-photo-14',
    url: 'https://images.pexels.com/photos/2788792/pexels-photo-2788792.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/2788792/pexels-photo-2788792.jpeg',
      large:
        'https://images.pexels.com/photos/2788792/pexels-photo-2788792.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/2788792/pexels-photo-2788792.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/2788792/pexels-photo-2788792.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding celebration moment',
  },
  {
    id: 'fallback-photo-15',
    url: 'https://images.pexels.com/photos/1729797/pexels-photo-1729797.jpeg',
    photographer: 'Pexels',
    src: {
      original: 'https://images.pexels.com/photos/1729797/pexels-photo-1729797.jpeg',
      large:
        'https://images.pexels.com/photos/1729797/pexels-photo-1729797.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
      medium:
        'https://images.pexels.com/photos/1729797/pexels-photo-1729797.jpeg?auto=compress&cs=tinysrgb&w=640&h=427',
      small:
        'https://images.pexels.com/photos/1729797/pexels-photo-1729797.jpeg?auto=compress&cs=tinysrgb&w=320&h=213',
    },
    alt: 'Wedding outdoor setup',
  },
];

/**
 * Fallback video URLs from curated wedding video collections
 * These are high-quality wedding-related videos suitable for hero sections
 * All videos are free to use per Pexels license
 *
 * ✅ UPDATED: Now using direct Pexels CDN URLs (not deprecated Vimeo external links)
 * 
 * URL Format: https://videos.pexels.com/video-files/{ID}/{ID}-{quality}_{width}_{height}_{fps}fps.mp4
 * - These URLs are stable and provided directly from Pexels CDN
 * - Multiple quality/fps variants are provided as fallbacks for browser compatibility
 * - The browser will attempt each URL in order until one loads successfully
 *
 * Note: These fallback URLs should be periodically validated to ensure they remain accessible.
 * If URLs become broken, they should be replaced with fresh URLs from the Pexels API.
 * 
 * To validate: Test each video URL in a browser or use the Pexels API to fetch current URLs.
 * To update: Use the Pexels Video API to get the latest video file links.
 */
const FALLBACK_VIDEOS = [
  {
    id: 'fallback-video-1',
    url: 'https://www.pexels.com/video/4586391/',
    image: 'https://images.pexels.com/videos/4586391/free-video-4586391.jpg',
    duration: 15,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/4586391/4586391-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/4586391/4586391-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/4586391/4586391-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding ceremony video',
  },
  {
    id: 'fallback-video-2',
    url: 'https://www.pexels.com/video/5435100/',
    image: 'https://images.pexels.com/videos/5435100/free-video-5435100.jpg',
    duration: 12,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/5435100/5435100-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/5435100/5435100-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/5435100/5435100-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding decoration video',
  },
  {
    id: 'fallback-video-3',
    url: 'https://www.pexels.com/video/3196007/',
    image: 'https://images.pexels.com/videos/3196007/free-video-3196007.jpg',
    duration: 18,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/3196007/3196007-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/3196007/3196007-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/3196007/3196007-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding couple video',
  },
  {
    id: 'fallback-video-4',
    url: 'https://www.pexels.com/video/5699934/',
    image: 'https://images.pexels.com/videos/5699934/free-video-5699934.jpg',
    duration: 10,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/5699934/5699934-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/5699934/5699934-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/5699934/5699934-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding reception video',
  },
  {
    id: 'fallback-video-5',
    url: 'https://www.pexels.com/video/4587953/',
    image: 'https://images.pexels.com/videos/4587953/free-video-4587953.jpg',
    duration: 14,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/4587953/4587953-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/4587953/4587953-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/4587953/4587953-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding dance video',
  },
  {
    id: 'fallback-video-6',
    url: 'https://www.pexels.com/video/6894337/',
    image: 'https://images.pexels.com/videos/6894337/free-video-6894337.jpg',
    duration: 16,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/6894337/6894337-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/6894337/6894337-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/6894337/6894337-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding celebration video',
  },
  {
    id: 'fallback-video-7',
    url: 'https://www.pexels.com/video/5331310/',
    image: 'https://images.pexels.com/videos/5331310/free-video-5331310.jpg',
    duration: 11,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/5331310/5331310-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/5331310/5331310-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/5331310/5331310-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding venue video',
  },
  {
    id: 'fallback-video-8',
    url: 'https://www.pexels.com/video/7651390/',
    image: 'https://images.pexels.com/videos/7651390/free-video-7651390.jpg',
    duration: 13,
    videoFiles: [
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/7651390/7651390-hd_1920_1080_24fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'hd',
        link: 'https://videos.pexels.com/video-files/7651390/7651390-hd_1920_1080_25fps.mp4',
        width: 1920,
        height: 1080,
      },
      {
        quality: 'sd',
        link: 'https://videos.pexels.com/video-files/7651390/7651390-sd_640_360_25fps.mp4',
        width: 640,
        height: 360,
      },
    ],
    alt: 'Wedding moments video',
  },
];

/**
 * Get fallback photos
 * @param {number} count - Number of photos to return (default: all)
 * @returns {Array} Array of photo objects
 */
function getFallbackPhotos(count) {
  if (count && count > 0) {
    return FALLBACK_PHOTOS.slice(0, count);
  }
  return [...FALLBACK_PHOTOS];
}

/**
 * Get fallback videos
 * @param {number} count - Number of videos to return (default: all)
 * @returns {Array} Array of video objects
 */
function getFallbackVideos(count) {
  if (count && count > 0) {
    return FALLBACK_VIDEOS.slice(0, count);
  }
  return [...FALLBACK_VIDEOS];
}

/**
 * Get random fallback photos
 * @param {number} count - Number of photos to return
 * @returns {Array} Array of random photo objects
 */
function getRandomFallbackPhotos(count = 10) {
  const shuffled = [...FALLBACK_PHOTOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get random fallback videos
 * @param {number} count - Number of videos to return
 * @returns {Array} Array of random video objects
 */
function getRandomFallbackVideos(count = 5) {
  const shuffled = [...FALLBACK_VIDEOS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

module.exports = {
  FALLBACK_PHOTOS,
  FALLBACK_VIDEOS,
  getFallbackPhotos,
  getFallbackVideos,
  getRandomFallbackPhotos,
  getRandomFallbackVideos,
};
