import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { shortenSourceLabel } from '../utils/storyMeta';
import './ImageCard.css';

export function ImageCard({ article, size = 'medium', onClick, href, badge }) {
    const { settings } = useSettings();
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showDebug, setShowDebug] = useState(false);

    const showImage = article.imageUrl && !imageError;

    const Tag = href ? 'a' : 'article';
    const props = href ? {
        href,
        target: '_blank',
        rel: 'noopener noreferrer'
    } : {};

    return (
        <Tag
            className={`image-card image-card--${size}`}
            onClick={onClick}
            {...props}
            style={{ position: 'relative' }}
        >
            {/* DEBUG OVERLAY */}
            {settings?.debugLogs && article._scoreBreakdown && (
                <div
                    className="debug-badge"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowDebug(!showDebug); }}
                    style={{
                        position: 'absolute', top: '5px', right: '5px', zIndex: 20,
                        background: 'rgba(0,0,0,0.7)', color: '#00ff41',
                        fontSize: '0.6rem', padding: '2px 4px', borderRadius: '4px', cursor: 'help',
                        border: '1px solid #00ff41'
                    }}
                >
                    {article._scoreBreakdown.total.toFixed(1)}
                    {showDebug && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, width: '200px',
                            background: '#111', border: '1px solid #333', padding: '8px',
                            borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            pointerEvents: 'none'
                        }}>
                            {Object.entries(article._scoreBreakdown).map(([k, v]) => (
                                k !== 'total' && typeof v === 'number' && (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <span style={{ color: '#aaa', textTransform: 'capitalize' }}>{k}</span>
                                        <span style={{ color: '#fff' }}>{v.toFixed(2)}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showImage && (
                <div className="image-card__media">
                    {!imageLoaded && (
                        <div className="image-card__skeleton"></div>
                    )}
                    <img
                        src={article.imageUrl}
                        alt={article.title}
                        className={`image-card__image ${imageLoaded ? 'loaded' : ''}`}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => setImageError(true)}
                        loading="lazy"
                    />
                    {badge && (
                        <div className="image-card__badge">
                            {shortenSourceLabel(badge)}
                        </div>
                    )}
                    <div className="image-card__overlay">
                        <span className="image-card__source" title={article.source}>{shortenSourceLabel(article.source)}</span>
                    </div>
                </div>
            )}

            <div className="image-card__content">
                <h3 className="image-card__headline">{article.title}</h3>
                {article.summary && (
                    <p className="image-card__summary">
                        {article.summary.substring(0, 150)}...
                    </p>
                )}
                <div className="image-card__meta">
                    <span className="meta__time">{article.time}</span>
                    {article.sentiment && (
                        <span className={`meta__sentiment meta__sentiment--${article.sentiment.label}`}>
                            {article.sentiment.label === 'positive' ? '📈' :
                                article.sentiment.label === 'negative' ? '📉' : '�'}
                        </span>
                    )}
                </div>
            </div>
        </Tag>
    );
}
