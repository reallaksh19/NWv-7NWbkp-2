/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useContext } from 'react';
import {
    getSettings,
    addFollowedTopic,
    removeFollowedTopic,
    addReadArticle,
    getSuggestedTopics
} from '../utils/storage.js';
import { fetchAllTopicsNews } from '../services/topicService.js';
import { sendNotification } from '../utils/notifications.js';

const TopicContext = createContext();

function canonicalTopicText(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ');
}

function getTopicKey(topic) {
    return canonicalTopicText(topic?.query || topic?.name);
}

function isDuplicateTopic(existingTopics, topic) {
    const nextKey = getTopicKey(topic);
    if (!nextKey) return false;

    return existingTopics.some(existing => getTopicKey(existing) === nextKey);
}

function normalizeTopic(topic) {
    const name = String(topic?.name || topic?.query || '').trim();
    const query = String(topic?.query || topic?.name || '').trim();

    return {
        ...topic,
        name,
        query,
        icon: topic?.icon || '📰',
        options: {
            country: 'IN',
            lang: 'en',
            timeRange: '30d',
            ...(topic?.options || {})
        }
    };
}

export function TopicProvider({ children }) {
    const [followedTopics, setFollowedTopics] = useState([]);
    const [topicNews, setTopicNews] = useState({});
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [topicMessage, setTopicMessage] = useState('');

    useEffect(() => {
        const settings = getSettings();
        setFollowedTopics(settings.followedTopics || []);
        refreshSuggestions();
    }, []);

    useEffect(() => {
        if (followedTopics.length === 0) return;

        refreshTopics(false);

        const interval = setInterval(() => {
            console.log('[TopicContext] Auto-refreshing topics...');
            refreshTopics(true);
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [followedTopics.length]);

    const refreshTopics = async (shouldNotify = false) => {
        if (followedTopics.length === 0) return;

        if (!shouldNotify) setLoading(true);

        try {
            const newsByTopic = await fetchAllTopicsNews(followedTopics);

            if (shouldNotify) {
                checkForUpdates(newsByTopic);
            }

            setTopicNews(newsByTopic);
        } catch (error) {
            console.error('[TopicContext] Failed to refresh topics:', error);
            setTopicMessage('Topic refresh failed. Showing the last available results.');
        } finally {
            if (!shouldNotify) setLoading(false);
        }
    };

    const checkForUpdates = (newNews) => {
        let newCount = 0;
        let topicName = '';

        Object.entries(newNews).forEach(([topicId, articles]) => {
            const oldArticles = topicNews[topicId] || [];

            if (articles.length > 0 && oldArticles.length > 0) {
                if (articles[0].id !== oldArticles[0].id) {
                    newCount++;
                    const topic = followedTopics.find(t => t.id === topicId);
                    if (topic) topicName = topic.name;
                }
            }
        });

        if (newCount > 0) {
            const title = newCount === 1
                ? `New update for ${topicName}`
                : `Updates in ${newCount} followed topics`;

            sendNotification(title, {
                body: 'Click to see the latest stories.',
                tag: 'topic-update'
            });
        }
    };

    const addTopic = (topic) => {
        const normalizedTopic = normalizeTopic(topic);

        if (!normalizedTopic.name || !normalizedTopic.query) {
            setTopicMessage('Enter a valid topic name.');
            return { ok: false, reason: 'invalid-topic' };
        }

        const settings = getSettings();
        const existingTopics = settings.followedTopics || [];

        if (isDuplicateTopic(existingTopics, normalizedTopic)) {
            setTopicMessage(`Already following "${normalizedTopic.name}".`);
            setFollowedTopics(existingTopics);
            return { ok: false, reason: 'duplicate-topic' };
        }

        addFollowedTopic(normalizedTopic);

        const nextSettings = getSettings();
        const nextTopics = nextSettings.followedTopics || [];

        setFollowedTopics(nextTopics);
        setTopicMessage(`Now following "${normalizedTopic.name}".`);

        setTimeout(() => refreshTopics(false), 50);

        return { ok: true };
    };

    const removeTopic = (topicId) => {
        removeFollowedTopic(topicId);
        setFollowedTopics(prev => prev.filter(t => t.id !== topicId));

        const newTopicNews = { ...topicNews };
        delete newTopicNews[topicId];
        setTopicNews(newTopicNews);
        setTopicMessage('');
    };

    const addToHistory = (article) => {
        addReadArticle(article);
        refreshSuggestions();
    };

    const refreshSuggestions = () => {
        const sugs = getSuggestedTopics();
        setSuggestions(sugs);
    };

    const clearTopicMessage = () => {
        setTopicMessage('');
    };

    const value = {
        followedTopics,
        topicNews,
        loading,
        suggestions,
        topicMessage,
        addTopic,
        removeTopic,
        refreshTopics,
        addToHistory,
        clearTopicMessage
    };

    return (
        <TopicContext.Provider value={value}>
            {children}
        </TopicContext.Provider>
    );
}

export function useTopics() {
    return useContext(TopicContext);
}
