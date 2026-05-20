import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';

function MorePage() {
    const secondaryNavItems = [
        { path: '/newspaper', label: 'Newspaper', icon: '📰', description: 'Daily headlines and e-paper format' },
        { path: '/markets', label: 'Markets', icon: '📈', description: 'Stock indices, IPOs, and mutual funds' },
        { path: '/tech-social', label: 'Buzz', icon: '🎭', description: 'Tech, science, and social media trends' },
        { path: '/weather', label: 'Weather', icon: '☁️', description: 'Detailed weather forecasts and conditions' },
        { path: '/settings', label: 'Settings', icon: '⚙️', description: 'App configuration and customization' }
    ];

    return (
        <div className="page-container">
            <Header title="More" icon="⋯" />

            <main className="main-content" style={{ padding: '16px' }}>
                <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                    {secondaryNavItems.map(item => (
                        <Link key={item.path} to={item.path} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <div className="modern-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                                <span style={{ fontSize: '2rem' }}>{item.icon}</span>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem' }}>{item.label}</h3>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{item.description}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </main>
        </div>
    );
}

export default MorePage;