/**
 * Service Worker for Aggressive Caching
 * Implements cache-first strategy with intelligent cache management
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `remotion-cache-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'remotion-runtime';

// Resources to cache immediately
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/manifest.json'
];

// Cache strategies for different resource types
const CACHE_STRATEGIES = {
  // Cache first, fallback to network
  cacheFirst: [
    /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,  // Images
    /\.(?:woff|woff2|ttf|otf)$/i,         // Fonts
    /\.(?:css)$/i                          // Stylesheets
  ],
  
  // Network first, fallback to cache
  networkFirst: [
    /\/api\//,                              // API calls
    /\.json$/                               // JSON data
  ],
  
  // Cache with network update
  staleWhileRevalidate: [
    /\.(?:js)$/i,                          // JavaScript
    /\.(?:mp4|webm|ogg)$/i                 // Videos
  ]
};

// Install event - cache initial resources
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Pre-caching resources');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Determine caching strategy
  const strategy = getCacheStrategy(url.pathname);
  
  switch (strategy) {
    case 'cacheFirst':
      event.respondWith(cacheFirstStrategy(request));
      break;
    case 'networkFirst':
      event.respondWith(networkFirstStrategy(request));
      break;
    case 'staleWhileRevalidate':
      event.respondWith(staleWhileRevalidateStrategy(request));
      break;
    default:
      event.respondWith(networkFirstStrategy(request));
  }
});

// Determine which caching strategy to use
function getCacheStrategy(pathname) {
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    for (const pattern of patterns) {
      if (pattern.test(pathname)) {
        return strategy;
      }
    }
  }
  return 'networkFirst';
}

// Cache-first strategy
async function cacheFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    console.log('[ServiceWorker] Cache hit:', request.url);
    return cachedResponse;
  }
  
  console.log('[ServiceWorker] Cache miss, fetching:', request.url);
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    throw error;
  }
}

// Network-first strategy
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidateStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);
  
  // Return cached version immediately if available
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.action === 'clearCache') {
    caches.keys().then((cacheNames) => {
      Promise.all(
        cacheNames.map((cacheName) => caches.delete(cacheName))
      ).then(() => {
        console.log('[ServiceWorker] All caches cleared');
        event.ports[0].postMessage({ status: 'success' });
      });
    });
  }
  
  if (event.data.action === 'getCacheStats') {
    getCacheStats().then((stats) => {
      event.ports[0].postMessage({ stats });
    });
  }
});

// Get cache statistics
async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {
    caches: [],
    totalSize: 0,
    totalEntries: 0
  };
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    
    stats.caches.push({
      name: cacheName,
      entries: requests.length
    });
    
    stats.totalEntries += requests.length;
  }
  
  return stats;
}