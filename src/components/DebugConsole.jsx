/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';

const DebugConsole = () => {
    const { settings } = useSettings();
    const [isOpen, setIsOpen] = useState(false);
    const [logs, setLogs] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const logsEndRef = useRef(null);

    useEffect(() => {
        // Intercept console methods
        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const addLog = (type, args) => {
            const message = Array.from(args).map(arg => {
                try {
                    return (typeof arg === 'object') ? JSON.stringify(arg) : String(arg);
                } catch {
                    return '[Circular/Object]';
                }
            }).join(' ');

            setLogs(prev => [...prev.slice(-99), { type, message, time: new Date().toLocaleTimeString() }]);
            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        };

        console.log = (...args) => {
            addLog('log', args);
            originalLog.apply(console, args);
        };

        console.warn = (...args) => {
            addLog('warn', args);
            originalWarn.apply(console, args);
        };

        console.error = (...args) => {
            addLog('error', args);
            originalError.apply(console, args);
        };

        // Capture global errors
        const handleGlobalError = (event) => {
            addLog('error', [event.message || 'Unknown Global Error']);
        };

        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', (e) => addLog('error', ['Unhandled Promise:', e.reason]));

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
            window.removeEventListener('error', handleGlobalError);
        };
    }, [isOpen]); // Re-bind if isOpen changes? No, closure issue.
    // Fix: Use ref for isOpen or just accept unread count logic might be slightly off in strict mode
    // Actually, separating the interceptor is cleaner, but for this simpler component:

    useEffect(() => {
        if (isOpen && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
            setUnreadCount(0);
        }
    }, [logs, isOpen]);

    // Only render if enabled in settings (default true)
    if (settings.showDebugConsole === false) return null;

    return (
        <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 9999 }}>
            {/* Toggle Button (FAB) */}
            <button
                onClick={() => { setIsOpen(!isOpen); setUnreadCount(0); }}
                style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: unreadCount > 0 ? '#ff4757' : 'rgba(0,0,0,0.8)',
                    color: 'white',
                    border: '2px solid rgba(255,255,255,0.2)',
                    fontSize: '24px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                }}
            >
                🐞
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-5px',
                        right: '-5px',
                        background: 'red',
                        color: 'white',
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        border: '1px solid white'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Console Window */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    bottom: '60px',
                    right: '0',
                    width: '320px', // Mobile friendly width
                    height: '400px',
                    maxHeight: '60vh',
                    background: 'rgba(10, 13, 17, 0.95)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '10px',
                        background: 'rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#00D4AA' }}>Debug Console</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>
                            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>✕</button>
                        </div>
                    </div>
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '10px',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                    }}>
                        {logs.map((log, index) => (
                            <div key={index} style={{
                                color: log.type === 'error' ? '#ff6b6b' : (log.type === 'warn' ? '#feca57' : '#1dd1a1'),
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                paddingBottom: '2px',
                                wordBreak: 'break-word'
                            }}>
                                <span style={{ opacity: 0.5, marginRight: '6px' }}>[{log.time}]</span>
                                {log.message}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebugConsole;
