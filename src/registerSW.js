export function registerSW() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    if (!import.meta.env.PROD) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                registrations.forEach((registration) => registration.unregister());
            });
        });
        return;
    }

    window.addEventListener('load', () => {
        const swPath = './sw.js';
        navigator.serviceWorker.register(swPath)
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
