
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Header from '../components/Header';
import NewsSection from '../components/NewsSection';
import SectionNavigator from '../components/SectionNavigator';
import BreakingNews from '../components/BreakingNews';
import TimelineHeader from '../components/TimelineHeader';
import QuickWeather from '../components/QuickWeather';
import { NewspaperLayout } from '../components/NewspaperLayout';
import { getTopline } from '../utils/timeSegment';
import { generateTopline, fetchOnThisDay } from '../utils/toplineGenerator';
import { getViewCount, isArticleRead } from '../utils/storage';
import { useWeather } from '../context/WeatherContext';
import { useNews } from '../context/NewsContext';
import { useSettings } from '../context/SettingsContext';
import { useSegment } from '../context/SegmentContext';
import { requestNotificationPermission } from '../utils/notifications';
import { useMediaQuery } from '../hooks/useMediaQuery';
import LazySection from '../components/LazySection';
import SidebarNews from '../components/SidebarNews';
import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditMainTabQuality } from '../services/pageAuditGrading.js';
import '../components/audit/AuditDetailModal.css';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import TravelLocationBanner from '../components/travel/TravelLocationBanner.jsx';
import TravelLocalStories from '../components/travel/TravelLocalStories.jsx';
import { getTravelLocationProfile } from '../services/travelLocationProfile.js';
import { applyTravelLocationPriority } from '../services/storyLocationPriority.js';
import {
    fetchTravelNewsPayload,
    mergeTravelNewsIntoNewsData,
} from '../services/travelNewsIngestion.js';

const MainPage = () => {
    const { settings } = useSettings();

    const travelLocationProfile = React.useMemo(
        () => getTravelLocationProfile(settings),
        [settings]
    );

    const [travelNewsPayload, setTravelNewsPayload] = useState(null);

    React.useEffect(() => {
        if (!travelLocationProfile?.prioritizeStories) {
            setTravelNewsPayload(null);
            return;
        }

        let cancelled = false;

        fetchTravelNewsPayload({ profile: travelLocationProfile }).then(payload => {
            if (!cancelled) setTravelNewsPayload(payload);
        });

        return () => {
            cancelled = true;
        };
    }, [travelLocationProfile]);

    const { currentSegment } = useSegment();
    const [notifPermission, setNotifPermission] = useState(Notification.permission);
    const [toplineContent, setToplineContent] = useState(null);
    const [onThisDay, setOnThisDay] = useState(null);

    // Responsive Detection
    const { isWebView, isDesktop: _isDesktop } = useMediaQuery();

    // Use Contexts
    const { weatherData, loading: weatherLoading, refreshWeather, ensureBoot: ensureWeatherBoot } = useWeather();

    const { newsData, loading, errors: _errors, breakingNews, refreshNews, loadSection: _loadSection, loadedSections: _loadedSections } = useNews();

    const travelMergedNewsData = React.useMemo(
        () => travelNewsPayload
            ? mergeTravelNewsIntoNewsData(newsData, travelNewsPayload, travelLocationProfile)
            : newsData,
        [newsData, travelNewsPayload, travelLocationProfile]
    );

    const prioritizedNewsData = React.useMemo(
        () => applyTravelLocationPriority(travelMergedNewsData, travelLocationProfile),
        [travelMergedNewsData, travelLocationProfile]
    );

    const handleRefreshAll = React.useCallback(async () => {
        await Promise.all([
            refreshWeather(true),
            refreshNews(true)
        ]);
    }, [refreshWeather, refreshNews]);

    const { pullDistance } = usePullToRefresh(handleRefreshAll);

    useEffect(() => {
        ensureWeatherBoot();
    }, [ensureWeatherBoot]);

    const { sections, uiMode = 'timeline' } = settings;
    const [latestStories, setLatestStories] = useState([]);

    // --- LOGIC: Filter Latest Stories ---
    const filteredStories = React.useMemo(() => {
        if (!newsData.frontPage) {
            return [];
        }

        if (settings.customSortTopStories) {
            // Latest Stories Mode: Filter out seen/read items
            // Rule: "Not shown to user more than 3 times (2) User did not click and read that"
            let filtered = newsData.frontPage.filter(item => {
                if (isArticleRead(item.id)) return false;
                // Reduced view count limit from 10 to 3
                if (getViewCount(item.id) > 3) return false;
                return true;
            });

            // Sort by Impact Score (Descending)
            filtered.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

            // Fallback: If filtered list is too small (< 10), fill with top items from original list
            const MIN_DISPLAY = 10;
            if (filtered.length < MIN_DISPLAY) {
                const existingIds = new Set(filtered.map(i => i.id));
                const remaining = newsData.frontPage.filter(i => !existingIds.has(i.id));
                remaining.sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));

                const needed = MIN_DISPLAY - filtered.length;
                filtered = [...filtered, ...remaining.slice(0, needed)];
            }

            return filtered;
        } else {
            // Standard Mode: Show all
            return newsData.frontPage;
        }
    }, [newsData.frontPage, settings.customSortTopStories]);

    useEffect(() => {
        setLatestStories(filteredStories);
    }, [filteredStories]);

    // --- LOGIC: Sync Segment with Data Refresh & UI ---
    useEffect(() => {
        refreshWeather();
        refreshNews();
    }, [currentSegment.id, refreshNews, refreshWeather]);

    // Fetch On This Day
    useEffect(() => {
        fetchOnThisDay().then(event => {
            if (event) setOnThisDay(event);
        });
    }, []);

    // Generate Topline when data is ready
    const generatedTopline = React.useMemo(() => {
        // Update topline if we have data, even if still refreshing (loading=true)
        // This ensures the "On This Day" or other content appears immediately on load/reload
        const hasNews = newsData && Object.keys(newsData).length > 0;
        const hasWeather = weatherData && Object.keys(weatherData).length > 0;

        if (hasNews || hasWeather || onThisDay) {
            return generateTopline(prioritizedNewsData, weatherData, onThisDay);
        }
        return null;
    }, [newsData, weatherData, onThisDay]);

    useEffect(() => {
        if (generatedTopline) {
            setToplineContent(generatedTopline);
        }
    }, [generatedTopline]);


    const _handleRequestPermission = async () => {
        const granted = await requestNotificationPermission();
        setNotifPermission(granted ? 'granted' : 'denied');
    };

    // Back to Top Logic
    const [showBackToTop, setShowBackToTop] = useState(false);
    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 400) {
                setShowBackToTop(true);
            } else {
                setShowBackToTop(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Determine loading state
    const isLoading = (weatherLoading && !weatherData) || (loading && Object.keys(newsData).length === 0);
    const loadingPhase = isLoading ? 1 : 3;

    const isTimelineMode = uiMode === 'timeline';

    const _isNewspaperMode = uiMode === 'newspaper';
    const isUrgentMode = currentSegment.id === 'urgent_only';

    const mainTabAudit = React.useMemo(() => auditMainTabQuality({
        newsData,
        weatherData,
        breakingNews,
        settings,
        loading,
        errors: _errors,
    }), [newsData, weatherData, breakingNews, settings, loading, _errors]);

    // Navigation Sections
    const navSections = [
        { id: 'top-stories', icon: '⭐', label: 'Top' },
        sections.india?.enabled && { id: 'india-news', icon: '🇮🇳', label: 'India' },
        sections.chennai?.enabled && { id: 'chennai-news', icon: '🏛️', label: 'Tamil Nadu' },
        sections.local?.enabled && { id: 'local-news', icon: '📍', label: 'Muscat' }
    ].filter(Boolean);

    const headerActions = (
        <div className="header__actions">
            <Link to="/refresh" className="header__action-btn">🔄</Link>
            <Link to="/settings" className="header__action-btn">⚙️</Link>
        </div>
    );

    return (
        <div className={`page-container mode-${uiMode} ${isWebView ? 'page-container--desktop' : ''}`}>
            <GradeBadge
                audit={mainTabAudit}
                label="Main tab quality grade"
                position="top-right"
                topOffset="12px"
                compact={false}
            />

            <div style={{
                height: `${pullDistance}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
                color: 'var(--accent-primary)',
                fontSize: '0.8rem',
                transition: pullDistance === 0 ? 'height 0.3s ease' : 'none'
            }}>
                <span style={{ transform: `rotate(${pullDistance * 2}deg)` }}>↻</span>
                <span style={{ marginLeft: '8px' }}>Pull to refresh...</span>
            </div>

            {isTimelineMode ? (
                <TimelineHeader
                    title={currentSegment.id === 'market_brief' ? '' : currentSegment.label}
                    icon={currentSegment.icon}
                    actions={headerActions}
                    loadingPhase={loadingPhase}
                />
            ) : (
                <Header
                    title={currentSegment.label}
                    icon={currentSegment.icon}
                    actions={headerActions}
                    loadingPhase={loadingPhase}
                />
            )}

            <main className={`main-content ${isWebView ? 'main-content--desktop' : ''}`}>

                {isLoading && (
                    <div className="loading" style={{padding: '40px'}}>
                        <div className="loading__spinner"></div>
                        <span>Loading Updates...</span>
                    </div>
                )}

                {isWebView ? (
                    // --- PC VIEW LAYOUT ---
                    <div className="main-page-grid">
                        <div className="left-col">
                            <QuickWeather />
                            
                    <TravelLocationBanner profile={travelLocationProfile} />
                    <TravelLocalStories newsData={prioritizedNewsData} profile={travelLocationProfile} />
<div className="modern-card" style={{ marginTop: '20px' }}>
                                <div className="modern-card__header">
                                    <h2 className="modern-card__title">🌍 Global News</h2>
                                </div>
                                {/* Newspaper Column Style for World News */}
                                <div className="newspaper-column">
                                    {(newsData.world || []).slice(0, 8).map((item, idx) => (
                                        <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="newspaper-item">
                                            <div className="newspaper-item__title">{item.title}</div>
                                            <div className="newspaper-item__meta">{item.source} • {item.time}</div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="right-col">
                            {/* Top Stories + Rest */}
                            <div className="news-sections">
                                {latestStories.length > 0 && (
                                    <NewsSection
                                        id="top-stories"
                                        title="Top Stories"
                                        icon="⭐"
                                        colorClass="news-section__title--world"
                                        news={latestStories}
                                        maxDisplay={10}
                                    />
                                )}

                                {sections.india?.enabled && (
                                    <NewsSection
                                        id="india-news"
                                        title="India News"
                                        icon="🇮🇳"
                                        colorClass="news-section__title--india"
                                        news={newsData.india}
                                        maxDisplay={sections.india.count || 5}
                                    />
                                )}

                                {sections.chennai?.enabled && (
                                    <NewsSection
                                        id="chennai-news"
                                        title="Tamil Nadu"
                                        icon="🏛️"
                                        colorClass="news-section__title--chennai"
                                        news={newsData.chennai}
                                        maxDisplay={sections.chennai.count || 5}
                                    />
                                )}

                                {sections.local?.enabled && (
                                    <NewsSection
                                        id="local-news"
                                        title="Muscat / Local"
                                        icon="📍"
                                        colorClass="news-section__title--local"
                                        news={newsData.local}
                                        maxDisplay={sections.local.count || 5}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // --- MOBILE VIEW LAYOUT ---
                    <div className="content-wrapper">
                        {!isTimelineMode && (
                            <>
                                <div className="topline">
                                    <div className="topline__label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>{toplineContent?.icon || '📰'}</span>
                                        <span>{toplineContent?.type || 'TOPLINE'}</span>
                                    </div>
                                    <div className="topline__text">
                                        {toplineContent?.text || getTopline(currentSegment)}
                                    </div>
                                </div>
                                <BreakingNews items={breakingNews} />
                            </>
                        )}

                        <QuickWeather />

                        <div className="news-sections">
                            {(!isUrgentMode || breakingNews.length === 0) && (
                                <>
                                    {latestStories.length > 0 && (
                                        <NewsSection
                                            id="top-stories"
                                            title="Top Stories"
                                            icon="⭐"
                                            colorClass="news-section__title--world"
                                            news={latestStories}
                                            maxDisplay={10}
                                        />
                                    )}

                                    {sections.india?.enabled && (
                                        <NewsSection
                                            id="india-news"
                                            title="India"
                                            icon="🇮🇳"
                                            colorClass="news-section__title--india"
                                            news={newsData.india}
                                            maxDisplay={sections.india.count || 5}
                                        />
                                    )}

                                    {sections.chennai?.enabled && (
                                        <NewsSection
                                            id="chennai-news"
                                            title="Tamil Nadu"
                                            icon="🏛️"
                                            colorClass="news-section__title--chennai"
                                            news={newsData.chennai}
                                            maxDisplay={sections.chennai.count || 5}
                                        />
                                    )}

                                    {sections.local?.enabled && (
                                        <NewsSection
                                            id="local-news"
                                            title="Muscat"
                                            icon="📍"
                                            colorClass="news-section__title--local"
                                            news={newsData.local}
                                            maxDisplay={sections.local.count || 5}
                                        />
                                    )}

                                    <NewsSection
                                        id="world-news"
                                        title="World"
                                        icon="🌍"
                                        colorClass="news-section__title--world"
                                        news={newsData.world}
                                        maxDisplay={sections.world?.count || 5}
                                    />
                                </>
                            )}
                        </div>
                    </div>
                )}

                {settings.debugLogs && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        marginTop: 'var(--spacing-md)', padding: '8px 12px',
                        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                        fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap'
                    }}>
                        <span title="Segment">{currentSegment.icon} {currentSegment.label}</span>
                        <span title="Notifications">{notifPermission === 'granted' ? '🔔' : '🔕'}</span>
                        <span title="UI Mode">📱 {uiMode}</span>
                    </div>
                )}
            </main>

            <SectionNavigator sections={navSections} />

            <button
                onClick={scrollToTop}
                style={{
                    position: 'fixed',
                    bottom: '90px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    opacity: showBackToTop ? 1 : 0,
                    pointerEvents: showBackToTop ? 'auto' : 'none',
                    transition: 'all 0.3s ease',
                    zIndex: 900,
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                className="back-to-top"
            >
                ↑
            </button>
        </div>
    );
}

export default MainPage;
