
import React, { useEffect, useMemo } from 'react';
import { useTopics } from '../context/TopicContext.jsx';
import { TopicCard } from '../components/TopicCard.jsx';
import { TopicSearch } from '../components/TopicSearch.jsx';
import './FollowingPage.css';

function getTopicStats(followedTopics, topicNews) {
    const topicCount = followedTopics.length;
    const articleCount = followedTopics.reduce((sum, topic) => {
        return sum + (topicNews[topic.id]?.length || 0);
    }, 0);

    const activeCount = followedTopics.filter(topic => (topicNews[topic.id]?.length || 0) > 0).length;
    const newCount = followedTopics.filter(topic => !topic.lastFetched).length;

    return {
        topicCount,
        articleCount,
        activeCount,
        newCount
    };
}

export default function FollowingPage() {
    const {
        followedTopics,
        topicNews,
        loading,
        suggestions,
        topicMessage,
        addTopic,
        removeTopic,
        refreshTopics,
        clearTopicMessage
    } = useTopics();

    useEffect(() => {
        // Context handles polling and initial refresh.
    }, []);

    const hasTopics = followedTopics.length > 0;
    const stats = useMemo(
        () => getTopicStats(followedTopics, topicNews),
        [followedTopics, topicNews]
    );

    const sortedTopics = useMemo(() => {
        return [...followedTopics].sort((a, b) => {
            const aCount = topicNews[a.id]?.length || 0;
            const bCount = topicNews[b.id]?.length || 0;

            if (bCount !== aCount) return bCount - aCount;

            const aTime = a.lastFetched ? new Date(a.lastFetched).getTime() : 0;
            const bTime = b.lastFetched ? new Date(b.lastFetched).getTime() : 0;

            return bTime - aTime;
        });
    }, [followedTopics, topicNews]);

    const handleSuggestionClick = (word) => {
        const newTopic = {
            name: word,
            query: word,
            icon: '🔍',
            options: { country: 'IN', lang: 'en', timeRange: '30d' }
        };

        addTopic(newTopic);
    };

    return (
        <div className="following-page following-page--pro">
            <header className="following-page__hero">
                <div>
                    <div className="following-page__eyebrow">Personal topic desk</div>
                    <h1>📌 Following</h1>
                    <p>
                        Track recurring topics, companies, people, cities, and story lines from one focused desk.
                    </p>
                </div>

                <button
                    type="button"
                    className="following-page__refresh"
                    onClick={() => refreshTopics(false)}
                    disabled={loading}
                >
                    {loading ? 'Refreshing…' : 'Refresh topics'}
                </button>
            </header>

            <main className="following-page__content following-page__content--pro">
                <section className="following-page__rail">
                    <TopicSearch onAddTopic={addTopic} />

                    {topicMessage && (
                        <div className="following-page__message">
                            <span>{topicMessage}</span>
                            <button type="button" onClick={clearTopicMessage} aria-label="Dismiss topic message">×</button>
                        </div>
                    )}

                    {suggestions.length > 0 && (
                        <div className="following-page__suggestions-section">
                            <h4>Suggested for you</h4>
                            <div className="following-page__suggestions">
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={`${suggestion.word}-${index}`}
                                        className="suggestion-chip"
                                        onClick={() => handleSuggestionClick(suggestion.word)}
                                    >
                                        + {suggestion.word}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="following-page__desk">
                    <div className="following-page__stats">
                        <div className="following-page__stat">
                            <span>Topics</span>
                            <strong>{stats.topicCount}</strong>
                        </div>
                        <div className="following-page__stat">
                            <span>Articles</span>
                            <strong>{stats.articleCount}</strong>
                        </div>
                        <div className="following-page__stat">
                            <span>Active</span>
                            <strong>{stats.activeCount}</strong>
                        </div>
                        <div className="following-page__stat">
                            <span>New</span>
                            <strong>{stats.newCount}</strong>
                        </div>
                    </div>

                    {loading && (
                        <div className="following-page__loading">
                            Loading topic updates...
                        </div>
                    )}

                    {hasTopics ? (
                        <div className="following-page__topics">
                            <div className="following-page__section-row">
                                <div>
                                    <div className="following-page__eyebrow">Watchlist</div>
                                    <h2 className="following-page__section-title">Your Topics</h2>
                                </div>
                                <span>{sortedTopics.length} followed</span>
                            </div>

                            <div className="following-page__topic-grid">
                                {sortedTopics.map(topic => (
                                    <TopicCard
                                        key={topic.id}
                                        topic={topic}
                                        articleCount={topicNews[topic.id]?.length || 0}
                                        articles={topicNews[topic.id] || []}
                                        onRemove={removeTopic}
                                    />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="following-page__empty">
                            <div className="following-page__empty-icon">📌</div>
                            <h2>No topics followed yet</h2>
                            <p>Search above and follow a topic to build your personal news desk.</p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}