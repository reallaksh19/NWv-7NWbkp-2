/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { getSettings, saveSettings, fetchSettingsFromApi } from '../utils/storage';
import { getRuntimeCapabilities } from "../runtime/runtimeCapabilities.js";

const SettingsContext = createContext();

function canUseRemoteSettingsSync() { return getRuntimeCapabilities().allowRemoteSettingsSync; }

export function SettingsProvider({ children }) {
    const [settings, setSettingsState] = useState(() => getSettings());
    const [settingsVersion, setSettingsVersion] = useState(0);

    const updateSettings = useCallback((newSettings) => {
        saveSettings(newSettings);
        setSettingsState(newSettings);
        setSettingsVersion(v => v + 1);
    }, []);

    const reloadSettings = useCallback(() => {
        const freshSettings = getSettings();
        setSettingsState(freshSettings);
        setSettingsVersion(v => v + 1);
    }, []);

    useEffect(() => {
        if (!canUseRemoteSettingsSync()) {
            return;
        }

        const syncWithServer = async () => {
            try {
                const remoteSettings = await fetchSettingsFromApi();
                if (remoteSettings) {
                    const currentSettings = getSettings();
                    const remoteTime = remoteSettings.lastUpdated || 0;
                    const localTime = currentSettings.lastUpdated || 0;

                    if (remoteTime > localTime) {
                        console.log('[Settings] Syncing from server (Remote is newer)...');
                        localStorage.setItem('dailyEventAI_settings', JSON.stringify(remoteSettings));
                        reloadSettings();
                    } else if (!currentSettings.upAhead?.keywords?.shopping) {
                        console.log('[Settings] Patching missing keywords from remote...');
                        const merged = { ...remoteSettings, ...currentSettings, upAhead: { ...remoteSettings.upAhead, ...currentSettings.upAhead } };
                        if (!merged.upAhead.keywords) merged.upAhead.keywords = remoteSettings.upAhead.keywords;
                        localStorage.setItem('dailyEventAI_settings', JSON.stringify(merged));
                        reloadSettings();
                    }
                }
            } catch (err) {
                console.warn('[Settings] Failed to sync with server', err);
            }
        };

        syncWithServer();
    }, [reloadSettings]);

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'dailyEventAI_settings') {
                console.log('[SettingsContext] Storage changed in another tab, reloading');
                reloadSettings();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [reloadSettings]);

    useEffect(() => {
        if (settings.fontSize) {
            document.documentElement.style.fontSize = settings.fontSize + 'px';
        }
    }, [settings.fontSize]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', settings.theme || 'dark');
    }, [settings.theme]);

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, reloadSettings, settingsVersion }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within SettingsProvider');
    }
    return context;
}
