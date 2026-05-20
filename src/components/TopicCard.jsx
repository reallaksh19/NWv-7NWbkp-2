import React from 'react';
import { useNavigate } from 'react-router-dom';
import './TopicCard.css';

export function TopicCard({
    topic,
    articleCount = 0,
    articles = [],
    onClick,
    onRemove
}) {
    const navigate = useNavigate();

    const latestArticle = Array.isArray(articles) && articles.length > 0 ? articles[0] : null;
    const timeAgo = topic.lastFetched
        ? getRelativeTime(new Date(topic.lastFetched))
        : 'Never updated';

    const health = getTopicHealth({ articleCount, latestArticle, topic });

    const handleClick = () => {
        if (onClick) {
            onClick(topic);
        } else {
            navigate(`/following/${topic.id}`);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
        }
    };

    return (
        <article
            className={`topic-card topic-card--pro topic-card--${health.tone}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            data-topic-health={health.tone}
        >
            <div className="topic-card__icon">{topic.icon || '📰'}</div>

            <div className="topic-card__content">
                <div className="topic-card__topline">
                    <div>
                        <h3 className="topic-card__name">{topic.name}</h3>
                        <p className="topic-card__query">{topic.query || topic.name}</p>
                    </div>

                    <span className={`topic-card__health topic-card__health--${health.tone}`}>
                        {health.label}
                    </span>
                </div>

                <div className="topic-card__latest">
                    <span>Latest</span>
                    <strong>{latestArticle?.title || 'No article fetched yet'}</strong>
                </div>

                <div className="topic-card__footer">
                    <span>{articleCount} article{articleCount === 1 ? '' : 's'}</span>
                    <span>{latestArticle?.source || latestArticle?.publisher || 'source pending'}</span>
                    <span>{timeAgo}</span>
                </div>
            </div>

            <button
                className="topic-card__remove"
                onClick={(event) => {
                    event.stopPropagation();
                    if (window.confirm(`Stop following "${topic.name}"?`)) {
                        onRemove(topic.id);
                    }
                }}
                aria-label={`Remove ${topic.name}`}
                title={`Remove ${topic.name}`}
            >
                ×
            </button>
        </article>
    );
}

function getTopicHealth({ articleCount, latestArticle, topic }) {
    if (articleCount > 0 && latestArticle) {
        return {
            tone: 'good',
            label: 'Active'
        };
    }

    if (topic.lastFetched) {
        return {
            tone: 'thin',
            label: 'Thin'
        };
    }

    return {
        tone: 'new',
        label: 'New'
    };
}

function getRelativeTime(date) {
    if (!date) return 'Never';

    const mins = Math.floor((Date.now() - date) / 60000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    return `${Math.floor(hours / 24)} days ago`;
}