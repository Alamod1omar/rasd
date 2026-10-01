'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isDev = process.env.NODE_ENV !== 'production' || window.location.hostname === 'localhost';

    if ('serviceWorker' in navigator) {
      if (isDev) {
        // In development: Completely disable ServiceWorker and purge all caches
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log('RASD Dev: Unregistered stale ServiceWorker:', registration.scope);
              }
            });
          }
        });

        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key).then(() => {
                console.log('RASD Dev: Purged stale cache:', key);
              });
            }
          });
        }
      } else {
        // In production: Register worker with automatic version update detection
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              // Check for updates on load and periodically
              registration.update();

              registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                  newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                      // New app version detected! Activate immediately without manual hard refresh
                      newWorker.postMessage({ type: 'SKIP_WAITING' });
                    }
                  });
                }
              });
            })
            .catch((error) => {
              console.error('RASD PWA ServiceWorker registration failed:', error);
            });

          // Reload page when new worker takes control to ensure fresh assets
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
              refreshing = true;
              window.location.reload();
            }
          });
        });
      }
    }
  }, []);

  return null;
}

