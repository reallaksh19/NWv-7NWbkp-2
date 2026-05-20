/* eslint-disable */
import React, { useMemo, useState, useEffect } from 'react';
import Header from '../components/Header';
import NewsSection from '../components/NewsSection';
import SectionNavigator from '../components/SectionNavigator';
import { ImageCard } from '../components/ImageCard';
import { useNews } from '../context/NewsContext';
import { useSettings } from '../context/SettingsContext';
import ProgressBar from '../components/ProgressBar';
import { shortenSourceLabel } from '../utils/storyMeta';

const CACHE_KEY = 'buzz_page_cache';

/**
 * Tech & Social Page
 * - "Buzz Hub" Dashboard
 * - Entertainment: Netflix-style grid
 * - Social: Masonry Grid of images/trends
 * - Tech: Modern Cards
 */
function TechSocialPage() {
    const { newsData, refreshNews, loading: contextLoading, loadSection } = useNews();
    const { settings } = useSettings();
    const [activeEntTab, setActiveEntTab] = useState('tamil');

    // Local cache state for immediate loading
    const [cachedData, setCachedData] = useState(null);
    const [loadingPhase, setLoadingPhase] = useState(0); // 0: Init, 1: Local, 3: Live

    // Load Cache on Mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                const age = Date.now() - (parsed.timestamp || 0);
                if (age < 8 * 60 * 60 * 1000) {
                     setTimeout(() => { setCachedData(parsed); setLoadingPhase(1); }, 0);
                } else {
                     setTimeout(() => { setCachedData(parsed); setLoadingPhase(1); }, 0);
                }
            }
        } catch (e) {
            console.warn('Buzz Cache read error', e);
        }
    }, []);

    // Trigger lazy load for sections required by this page
    useEffect(() => {
        const requiredSections = ['entertainment', 'social', 'technology', 'local', 'world', 'india', 'chennai'];
        requiredSections.forEach(section => loadSection(section));
    }, [loadSection]);

    const filterOldNews = React.useCallback((newsArray) => {
        if (!newsArray) return [];
        const limitMs = (settings.freshnessLimitHours || 72) * 3600000;
        const now = Date.now();
        return newsArray.filter(item => (now - (item.publishedAt || 0)) < limitMs);
    }, [settings.freshnessLimitHours]);

    const hasLiveData = newsData.entertainment && newsData.entertainment.length > 0;

    useEffect(() => {
        if (hasLiveData) {
            setLoadingPhase(3);
        }
    }, [hasLiveData]);

    const displayData = hasLiveData ? newsData : (cachedData?.data || {});

    // ============================================
    // ENTERTAINMENT CONTENT FILTERING
    // ============================================
    const processedEntertainment = useMemo(() => {
        const raw = displayData.entertainment || [];

        const KEYWORDS = {
            tamil: [
                'vijay', 'ajith', 'rajini', 'kamal', 'dhanush', 'suriya', 'vikram', 'simbu',
                'siva karthikeyan', 'trisha', 'nayanthara', 'anirudh', 'ar rahman', 'kollywood',
                'thalapathy', 'thala', 'udhayanidhi', 'vetri maaran', 'lokesh', 'nelson',
                'jailer', 'leo', 'kanguva', 'indian 2', 'vettaiyan', 'goat', 'viduthalai',
                'karthi', 'sethupathi', 'tamil', 'chennai'
            ],
            hindi: [
                'shah rukh', 'srk', 'salman', 'aamir', 'ranbir', 'alia', 'deepika', 'ranveer',
                'kareena', 'akshay', 'bachchan', 'bollywood', 'hrithik', 'katrina', 'vicky kaushal',
                'karan johar', 'yrf', 'dharma', 'pathaan', 'jawan', 'tiger 3', 'animal', 'dunki',
                'war 2', 'singham', 'hindi', 'mumbai'
            ],
            hollywood: [
                'oscar', 'grammy', 'emmy', 'golden globe', 'marvel', 'dc', 'disney', 'warner bros',
                'universal', 'tom cruise', 'dicaprio', 'nolan', 'avengers', 'spider-man', 'batman',
                'superman', 'taylor swift', 'beyonce', 'kim kardashian', 'kanye', 'justin bieber',
                'selena gomez', 'zendaya', 'hollywood', 'bad bunny', 'rihanna', 'drake'
            ],
            ott: [
                'netflix', 'prime video', 'hotstar', 'sonyliv', 'zee5', 'aha', 'streaming',
                'web series', 'season', 'episode', 'ott'
            ]
        };

        return raw.map(item => {
            const text = (item.title + ' ' + (item.summary || '')).toLowerCase();

            if (KEYWORDS.tamil.some(k => text.includes(k))) return { ...item, region: 'tamil' };
            if (KEYWORDS.hindi.some(k => text.includes(k))) return { ...item, region: 'hindi' };
            if (KEYWORDS.hollywood.some(k => text.includes(k))) return { ...item, region: 'hollywood' };
            if (KEYWORDS.ott.some(k => text.includes(k))) return { ...item, region: 'ott' };

            return item;
        });
    }, [displayData.entertainment]);

    // ============================================
    // SOCIAL TRENDS DISTRIBUTION LOGIC
    // ============================================

    const socialTrends = useMemo(() => {
        const REGION_KEYWORDS = {
            world: ['global', 'world', 'international', 'usa', 'europe', 'uk', 'china', 'twitter', 'x.com', 'meta', 'tiktok', 'instagram', 'viral'],
            india: ['india', 'indian', 'bollywood', 'cricket', 'modi', 'delhi', 'mumbai', 'bangalore', 'hyderabad', 'ipl', 'bcci'],
            tamilnadu: ['chennai', 'tamil', 'tamilnadu', 'kollywood', 'rajini', 'kamal', 'vijay', 'trichy', 'coimbatore', 'madurai', 'tn'],
            muscat: ['muscat', 'oman', 'gulf', 'gcc', 'uae', 'dubai', 'arab', 'middle east', 'expat', 'omani']
        };

        const categorizeByRegion = (newsItem) => {
            const text = (newsItem.title + ' ' + (newsItem.summary || '')).toLowerCase();
            if (REGION_KEYWORDS.tamilnadu.some(kw => text.includes(kw))) return 'tamilnadu';
            if (REGION_KEYWORDS.muscat.some(kw => text.includes(kw))) return 'muscat';
            if (REGION_KEYWORDS.india.some(kw => text.includes(kw))) return 'india';
            return 'world';
        };

        const allSocial = filterOldNews(displayData.social || []);
        const worldNews = filterOldNews(displayData.world || []);
        const indiaNews = filterOldNews(displayData.india || []);
        const chennaiNews = filterOldNews(displayData.chennai || []);
        const localNews = filterOldNews(displayData.local || []);

        const regionBuckets = { world: [], india: [], tamilnadu: [], muscat: [] };

        allSocial.forEach(item => {
            const region = categorizeByRegion(item);
            regionBuckets[region].push({ ...item, source: 'social' });
        });

        worldNews.filter(item => item.title?.toLowerCase().includes('trend') || item.title?.toLowerCase().includes('viral') || item.title?.toLowerCase().includes('social'))
            .forEach(item => regionBuckets.world.push({ ...item, source: 'world' }));

        indiaNews.filter(item => item.title?.toLowerCase().includes('trend') || item.title?.toLowerCase().includes('viral') || item.title?.toLowerCase().includes('social'))
            .forEach(item => regionBuckets.india.push({ ...item, source: 'india' }));

        chennaiNews.forEach(item => { regionBuckets.tamilnadu.push({ ...item, source: 'chennai' }); });
        localNews.forEach(item => { regionBuckets.muscat.push({ ...item, source: 'local' }); });

        const distribution = {
            world: settings.socialTrends?.worldCount ?? 8,
            india: settings.socialTrends?.indiaCount ?? 8,
            tamilnadu: settings.socialTrends?.tamilnaduCount ?? 5,
            muscat: settings.socialTrends?.muscatCount ?? 4
        };

        const result = [];
        Object.entries(distribution).forEach(([region, count]) => {
            const bucket = regionBuckets[region];
            bucket.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
            const toAdd = bucket.slice(0, count);
            toAdd.forEach(item => {
                result.push({
                    ...item,
                    region: region,
                    regionLabel: region === 'world' ? '🌍 World' :
                        region === 'india' ? '🇮🇳 India' :
                            region === 'tamilnadu' ? '🏛️ Tamil Nadu' :
                                '🏝️ Muscat'
                });
            });
        });

        result.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0));
        return result;
    }, [displayData, settings.freshnessLimitHours, settings.socialTrends, filterOldNews]);

    useEffect(() => {
        if (hasLiveData) {
            try {
                const cachePayload = {
                    timestamp: Date.now(),
                    data: {
                        entertainment: newsData.entertainment,
                        social: newsData.social,
                        technology: newsData.technology,
                        world: newsData.world,
                        india: newsData.india,
                        chennai: newsData.chennai,
                        local: newsData.local
                    }
                };
                localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
            } catch (e) {
                console.warn('Buzz Cache write error', e);
            }
        }
    }, [hasLiveData, newsData]);

    const handleRefresh = () => {
        setLoadingPhase(3);
        refreshNews(['technology', 'social', 'world', 'india', 'chennai', 'local']);
    };

    const navSections = [
        { id: 'entertainment', icon: '🎬', label: 'Entertainment' },
        { id: 'social-trends', icon: '👥', label: 'Social Trends' },
        { id: 'tech-news', icon: '🚀', label: 'Tech & Startups' },
        { id: 'ai-innovation', icon: '🤖', label: 'AI & Innovation' }
    ];

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

    // Poster Card Component for Entertainment
    const EntertainmentPoster = ({ item }) => (
        <a href={item.link || '#'} target="_blank" rel="noopener noreferrer" className="poster-card" style={{ textDecoration: 'none', display: 'block' }}>
            {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className="poster-card__image" loading="lazy" />
            ) : (
                <div style={{
                    height: '100%', width: '100%',
                    background: `linear-gradient(135deg, var(--bg-secondary), var(--bg-card))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '3rem', opacity: 0.3
                }}>
                    🎬
                </div>
            )}
            <div className="poster-card__content">
                <div className="poster-card__title" style={{ fontSize: '0.9rem', marginBottom: '4px' }}>{item.title}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{item.source}</div>
            </div>
        </a>
    );

    return (
        <div className="page-container">
            <Header
                title="Buzz Hub"
                icon="🎭"
                onRefresh={handleRefresh}
                loadingPhase={loadingPhase || (contextLoading ? 3 : 0)}
            />
            <main className="main-content">

                {/* Entertainment Hub */}
                <div id="entertainment" className="modern-card" style={{ marginBottom: '24px' }}>
                    <div className="modern-card__header">
                        <h2 className="modern-card__title">
                            <span>🎬</span> Entertainment
                        </h2>
                    </div>

                    <ProgressBar active={contextLoading && loadingPhase > 1} style={{ marginBottom: '16px' }} />

                    {/* Modern Icons for Entertainment Tabs */}
                    <div className="entertainment-tabs modern-icons">
                        <button className={`ent-tab ${activeEntTab === 'tamil' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('tamil')}>
                            <span className="ent-icon">🎭</span> Tamil
                        </button>
                        <button className={`ent-tab ${activeEntTab === 'hindi' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('hindi')}>
                            <span className="ent-icon">🎪</span> Hindi
                        </button>
                        <button className={`ent-tab ${activeEntTab === 'hollywood' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('hollywood')}>
                            <span className="ent-icon">🎬</span> H'wood
                        </button>
                        <button className={`ent-tab ${activeEntTab === 'ott' ? 'ent-tab--active' : ''}`} onClick={() => setActiveEntTab('ott')}>
                            <span className="ent-icon">📺</span> OTT
                        </button>
                    </div>

                    <div className="masonry-grid">
                        {filterOldNews(processedEntertainment.filter(item => item.region === activeEntTab)).slice(0, 8).map((item, idx) => (
                            <ImageCard
                                key={idx}
                                article={{
                                    ...item,
                                    time: item.time || 'Recently',
                                    summary: item.summary || item.description || ''
                                }}
                                href={item.link}
                                badge={shortenSourceLabel(item.source)}
                                size="medium"
                            />
                        ))}
                    </div>
                     {filterOldNews(processedEntertainment.filter(item => item.region === activeEntTab)).length === 0 && (
                        <div className="empty-state">No entertainment news found for this category.</div>
                    )}
                </div>

                {/* Social Trends */}
                <div id="social-trends" className="modern-card" style={{ marginBottom: '24px' }}>
                     <div className="modern-card__header">
                        <h2 className="modern-card__title">
                            <span>👥</span> Social Trends
                        </h2>
                    </div>

                    <div className="masonry-grid">
                        {socialTrends.map((item, idx) => (
                            <ImageCard
                                key={idx}
                                article={{
                                    ...item,
                                    time: item.time || 'Recently'
                                }}
                                href={item.link}
                                badge={item.regionLabel}
                                size="medium"
                            />
                        ))}
                        {socialTrends.length === 0 && (
                            <div className="empty-state" style={{gridColumn: '1/-1'}}>
                                <p>No social trends available</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tech & AI Grid */}
                <div className="dashboard-grid">
                    <div id="tech-news" className="modern-card">
                         <div className="modern-card__header">
                            <h2 className="modern-card__title">
                                <span>🚀</span> Tech & Startups
                            </h2>
                        </div>
                        <NewsSection
                            news={filterOldNews(displayData.technology)}
                            maxDisplay={settings.sections?.technology?.count || 5}
                            showCritics={false}
                            hideTitle={true}
                        />
                    </div>

                    <div id="ai-innovation" className="modern-card">
                         <div className="modern-card__header">
                            <h2 className="modern-card__title">
                                <span>🤖</span> AI & Innovation
                            </h2>
                        </div>
                        <NewsSection
                            news={filterOldNews(displayData.technology?.filter(
                                item => item.title?.toLowerCase().includes('ai') ||
                                    item.title?.toLowerCase().includes('innovation') ||
                                    item.title?.toLowerCase().includes('machine learning') ||
                                    item.title?.toLowerCase().includes('chatgpt') ||
                                    item.title?.toLowerCase().includes('gemini')
                            ))}
                            maxDisplay={6}
                            showCritics={false}
                            hideTitle={true}
                        />
                    </div>
                </div>
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
                    background: 'rgba(0,0,0,0.5)',
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
            >
                ↑
            </button>
        </div>
    );
}

export default TechSocialPage;
