export const openDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MarketAppDB', 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('cache')) {
                db.createObjectStore('cache');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const getIdbCache = async (key) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cache', 'readonly');
            const store = tx.objectStore('cache');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch {
        return null;
    }
};

export const setIdbCache = async (key, value) => {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('cache', 'readwrite');
            const store = tx.objectStore('cache');
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch {
        // Silently fail
    }
};
