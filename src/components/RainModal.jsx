import React from 'react';

const RainModal = ({ city, period, hourlyData, onClose }) => {
    if (!hourlyData) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)'
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-surface)',
                padding: '20px',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '400px',
                maxHeight: '80vh',
                overflowY: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)'
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{city} - {period} Rainfall</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hourlyData.map((h, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '10px',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '8px',
                            borderLeft: `3px solid ${h.precip > 2 ? 'var(--accent-primary)' : 'var(--text-muted)'}`
                        }}>
                            <span style={{ fontWeight: 500 }}>{h.time}</span>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{h.precip?.toFixed(1)} mm</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{h.prob}% prob</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RainModal;
