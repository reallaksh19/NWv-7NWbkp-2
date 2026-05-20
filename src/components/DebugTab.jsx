/* eslint-disable */
import React, { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import logStore from '../utils/logStore';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';

const DebugTab = () => {
    const { settings } = useSettings();
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(null);
    const capabilities = getRuntimeCapabilities();

    useEffect(() => {
        try {
            if (logStore && typeof logStore.getLogs === 'function') {
                setLogs(logStore.getLogs());
            } else {
                setLogs([]);
            }
        } catch (e) {
            console.error("Failed to load logs", e);
            setError(e.message);
        }
    }, []);

    const safeRender = (msg) => {
        if (typeof msg === 'object') {
            try {
                return JSON.stringify(msg);
            } catch (e) {
                return '[Circular Object]';
            }
        }
        return String(msg);
    };

    if (error) {
        return <div className="error-state">Debug Error: {error}</div>;
    }

    return (
        <div className="settings-tab-content">
            <div className="section-title" style={{color: 'var(--accent-primary)'}}><span>🐛</span> Debug Info</div>

            <div className="modern-card">
                <div style={{fontSize:'0.8rem', marginBottom:'10px', display: 'flex', justifyContent: 'space-between'}}>
                    <strong>App Version:</strong> <span>{settings?.appVersion || 'Unknown'}</span>
                </div>
                <div style={{fontSize:'0.8rem', marginBottom:'10px', display: 'flex', justifyContent: 'space-between'}}>
                    <strong>User Agent:</strong> <span style={{maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}} title={navigator.userAgent}>{navigator.userAgent}</span>
                </div>
                <div style={{fontSize:'0.8rem', marginBottom:'10px', display: 'flex', justifyContent: 'space-between'}}>
                    <strong>Screen:</strong> <span>{window.innerWidth}x{window.innerHeight}</span>
                </div>
            </div>

            <div className="section-title" style={{color: 'var(--accent-primary)'}}><span>⚙️</span> Feature Status (Runtime)</div>
            <div className="modern-card">
                <div style={{fontSize:'0.8rem', marginBottom:'10px', display: 'flex', justifyContent: 'space-between'}}>
                    <strong>Runtime Label:</strong> 
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>{capabilities.runtimeLabel}</span>
                </div>
                <div style={{fontSize:'0.8rem', marginBottom:'10px', display: 'flex', justifyContent: 'space-between'}}>
                    <strong>Backend Configured:</strong> 
                    <span>{capabilities.backendConfigured ? 'Yes' : 'No'}</span>
                </div>
                <hr style={{borderTop: '1px dashed var(--border-default)', margin: '10px 0', borderBottom: 'none'}} />
                {Object.entries(capabilities.featureStatus || {}).map(([feature, status]) => (
                    <div key={feature} style={{fontSize:'0.8rem', marginBottom:'6px', display: 'flex', justifyContent: 'space-between'}}>
                        <strong style={{textTransform: 'capitalize'}}>{feature}:</strong> 
                        <span style={{ color: 'var(--text-secondary)' }}>{status}</span>
                    </div>
                ))}
            </div>

            <div className="section-title" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--accent-primary)'}}>
                <div><span>📜</span> Recent Logs</div>
                <button onClick={() => {
                    navigator.clipboard.writeText(logs.map(l => `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.level.toUpperCase()}: ${safeRender(l.message)} ${l.details ? safeRender(l.details) : ''}`).join('\n'));
                    alert('Copied to clipboard');
                }} className="btn btn--secondary" style={{fontSize: '0.7rem', padding: '4px 8px'}}>Copy All</button>
            </div>
            <div className="modern-card" style={{maxHeight:'400px', overflowY:'auto', background:'#0a0a0a', border: '1px solid #333', color:'#0f0', fontFamily:'monospace', fontSize:'0.75rem', padding:'16px'}}>
                {logs.length === 0 ? (
                    <div>No logs available.</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} style={{marginBottom:'4px', borderBottom:'1px solid #333', whiteSpace: 'pre-wrap', wordBreak: 'break-all'}}>
                            <span style={{color:'#888'}}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                            <span style={{color: log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : '#0f0'}}>{log.level.toUpperCase()}:</span>{' '}
                            {safeRender(log.message)}
                            {log.details && (
                                <div style={{marginLeft:'15px', color:'#aaa', fontSize:'0.65rem'}}>
                                    {safeRender(log.details)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <div className="modern-card">
                <button
                    className="btn btn--danger"
                    onClick={() => {
                        if(window.confirm('Clear all data?')) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    style={{width:'100%'}}
                >
                    Clear All Local Storage & Reload
                </button>
            </div>
        </div>
    );
};

export default DebugTab;
