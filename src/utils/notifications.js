/**
 * Notification Utility for handling permissions and triggering alerts
 */

export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notification');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
}

export function sendNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
        // Use Service Worker if available (better for mobile)
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    icon: `${import.meta.env.BASE_URL}vite.svg`,
                    badge: `${import.meta.env.BASE_URL}vite.svg`,
                    vibrate: [200, 100, 200],
                    requireInteraction: true, // Keeps it until user interacts
                    ...options
                });
            });
        } else {
            // Fallback to standard API
            new Notification(title, {
                icon: `${import.meta.env.BASE_URL}vite.svg`,
                ...options
            });
        }
    }
}
