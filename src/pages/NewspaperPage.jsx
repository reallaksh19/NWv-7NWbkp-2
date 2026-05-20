/* eslint-disable */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FaNewspaper, FaSync, FaLanguage, FaMagic, FaExclamationTriangle, FaBolt } from 'react-icons/fa';
import { useSettings } from '../context/SettingsContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import NewspaperCard from '../components/NewspaperCard';
import { geminiService } from '../services/geminiService';
import { extractArticleText } from '../utils/articleExtractor';
import { summarizeText } from '../utils/extractiveSummary';
import { proxyManager } from '../services/proxyManager';
import { virtualPaperService } from '../services/virtualPaperService';
import '../components/NewspaperLayout.css';

// Use import.meta.env.BASE_URL for correct path resolution in any deployment
const DATA_URL = `${import.meta.env.BASE_URL}data/epaper_data.json`;

const SOURCES = {
  THE_HINDU: { id: 'THE_HINDU', label: 'The Hindu', lang: 'en' },
  INDIAN_EXPRESS: { id: 'INDIAN_EXPRESS', label: 'Indian Express', lang: 'en' },
  DINAMANI: { id: 'DINAMANI', label: 'Dinamani', lang: 'ta' },
  DAILY_THANTHI: { id: 'DAILY_THANTHI', label: 'Daily Thanthi', lang: 'ta' }
};

const FALLBACK_FEEDS = {
    THE_HINDU: [
        { page: 'Front Page', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
        { page: 'Business', url: 'https://www.thehindu.com/business/feeder/default.rss' },
        { page: 'Sport', url: 'https://www.thehindu.com/sport/feeder/default.rss' }
    ],
    INDIAN_EXPRESS: [
        { page: 'Front Page', url: 'https://indianexpress.com/feed/' },
        { page: 'Explained', url: 'https://indianexpress.com/section/explained/feed/' }
    ],
    DINAMANI: [
        // Using Google News RSS for Dinamani as reliable fallback
        { page: 'Latest', url: 'https://news.google.com/rss/search?q=site:dinamani.com&hl=ta&gl=IN&ceid=IN:ta' }
    ],
    DAILY_THANTHI: [
        // Using Google News RSS for Daily Thanthi
        { page: 'Latest', url: 'https://news.google.com/rss/search?q=site:dailythanthi.com&hl=ta&gl=IN&ceid=IN:ta' }
    ]
};

const NewspaperPage = () => {
    const { settings } = useSettings();
    const { isWebView } = useMediaQuery();

    // State
    const [activeSource, setActiveSource] = useState(SOURCES.THE_HINDU.id);
    const [data, setData] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Translation & AI State
    const [isTranslated, setIsTranslated] = useState(false);
    const [dynamicSummaries, setDynamicSummaries] = useState({});
    const [dynamicTitles, setDynamicTitles] = useState({});
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    const [isTranslatingTitles, setIsTranslatingTitles] = useState(false);
    const [digestMode, setDigestMode] = useState(false);
    const [clientSummaries, setClientSummaries] = useState({});
    const [isGeneratingAll, setIsGeneratingAll] = useState(false);

    const summaryLineLimit = settings.newspaper?.summaryLineLimit || 50;

    // Fetch Data with Fallback
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        // Try Static JSON first
        try {
            const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
            if (!response.ok) throw new Error('Failed to fetch data');
            const json = await response.json();
            if (!json || !json.sources) throw new Error('Invalid data format');

            setData(json.sources);
            setLastUpdated(json.lastUpdated);
        } catch (err) {
            console.warn("JSON fetch failed, trying RSS fallback...", err);

            // Try RSS Fallback
            try {
                const fallbackData = await fetchFallbackRSS();
                setData(fallbackData);
                setLastUpdated(new Date().toISOString());
                // Don't set error if fallback succeeds
            } catch (fallbackErr) {
                console.error("Fallback failed:", fallbackErr);
                setError("Failed to load today's paper. Please check your internet connection.");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchFallbackRSS = async () => {
        const sources = {};

        // Create a timeout promise (e.g., 15 seconds) to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 15000)
        );

        const fetchPromises = Object.keys(SOURCES).map(async (sourceKey) => {
            try {
                // Use Virtual Paper Service (New Robust Fallback)
                const sections = await virtualPaperService.getVirtualPaper(sourceKey);
                if (sections && sections.length > 0) {
                    sources[sourceKey] = sections;
                }
            } catch (e) {
                console.warn(`Virtual Paper failed for ${sourceKey}:`, e.message);
            }
        });

        // Race between the fetch and the timeout
        try {
            await Promise.race([
                Promise.all(fetchPromises),
                timeoutPromise
            ]);
        } catch (error) {
            console.warn("Virtual Paper fetch timed out or failed:", error);
            // If we have some data, we can still proceed
        }

        if (Object.keys(sources).length === 0) throw new Error("Failed to generate Virtual Paper. Please check connection.");
        return sources;
    };

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Effect: Handle Dynamic Summary Generation (Fallback)
    useEffect(() => {
        const generateMissingSummaries = async () => {
            if (!data || !data[activeSource]) return;
            if (!settings.geminiKey) return; // Cannot generate without key

            const currentSections = data[activeSource];
            const isTamilSource = SOURCES[activeSource].lang === 'ta';

            for (const section of currentSections) {
                // Check if summary is missing or has error, and not already generated
                const needsSummary = (!section.summary && !section.summary_ta) || section.error;
                const alreadyGenerated = dynamicSummaries[section.page];

                if (needsSummary && !alreadyGenerated && !isGeneratingSummary) {
                    setIsGeneratingSummary(true);
                    try {
                        console.log(`Generating fallback summary for ${section.page}...`);
                        const result = await geminiService.generateSummary(section.articles, settings.geminiKey, isTamilSource);

                        setDynamicSummaries(prev => ({
                            ...prev,
                            [section.page]: result
                        }));
                    } catch (err) {
                        console.error(`Failed to generate summary for ${section.page}:`, err);
                    } finally {
                        setIsGeneratingSummary(false);
                    }
                }
            }
        };

        generateMissingSummaries();
    }, [data, activeSource, settings.geminiKey, dynamicSummaries, isGeneratingSummary]);

    // Effect: Client-side extractive summary fallback (no API key needed)
    const generateClientSummary = useCallback(async (sectionPage, articles) => {
        const key = `${activeSource}_${sectionPage}`;
        if (clientSummaries[key]) return;

        // Try to extract text from the first article
        const firstArticle = articles?.[0];
        if (!firstArticle?.link) return;

        try {
            const text = await extractArticleText(firstArticle.link);
            if (text && text.length > 200) {
                const summary = await summarizeText(text, 6);
                if (summary) {
                    setClientSummaries(prev => ({ ...prev, [key]: summary }));
                }
            }
        } catch {
            // Silent fail
        }
    }, [activeSource, clientSummaries]);

    // Effect: Handle Title Translation
    useEffect(() => {
        const translateVisibleTitles = async () => {
            if (!isTranslated) return; // Only translate if toggled on
            if (!data || !data[activeSource]) return;
            if (SOURCES[activeSource].lang === 'en') return; // English sources don't need translation
            if (!settings.geminiKey) return; // Need key

            const currentSections = data[activeSource];
            let titlesToTranslate = [];
            let articleMap = []; // To map results back to URLs

            // Collect untranslated titles
            currentSections.forEach(section => {
                section.articles.forEach(article => {
                    const hasServerTranslation = article.title_en;
                    const hasDynamicTranslation = dynamicTitles[article.link];

                    if (!hasServerTranslation && !hasDynamicTranslation) {
                        titlesToTranslate.push(article.title);
                        articleMap.push(article.link);
                    }
                });
            });

            if (titlesToTranslate.length > 0 && !isTranslatingTitles) {
                setIsTranslatingTitles(true);
                try {
                    console.log(`Translating ${titlesToTranslate.length} titles...`);
                    // Translate in chunks of 15 to avoid token limits if list is huge
                    const chunkSize = 15;
                    for (let i = 0; i < titlesToTranslate.length; i += chunkSize) {
                        const batch = titlesToTranslate.slice(i, i + chunkSize);
                        const results = await geminiService.translateTexts(batch, settings.geminiKey);

                        setDynamicTitles(prev => {
                            const updates = { ...prev };
                            results.forEach((translatedTitle, idx) => {
                                const originalIdx = i + idx;
                                if (articleMap[originalIdx]) {
                                    updates[articleMap[originalIdx]] = translatedTitle;
                                }
                            });
                            return updates;
                        });
                    }
                } catch (err) {
                    console.error("Translation failed:", err);
                } finally {
                    setIsTranslatingTitles(false);
                }
            }
        };

        translateVisibleTitles();
    }, [isTranslated, data, activeSource, settings.geminiKey, dynamicTitles, isTranslatingTitles]);


    // Helper to get correct summary text (4-tier)
    const getSectionSummary = (section) => {
        // 1. Dynamic Gemini Fallback
        const dynamic = dynamicSummaries[section.page];
        if (dynamic) {
            if (isTranslated && dynamic.summary) return { text: dynamic.summary, method: 'gemini' };
            if (!isTranslated && dynamic.summary_ta) return { text: dynamic.summary_ta, method: 'gemini' };
            if (dynamic.summary) return { text: dynamic.summary, method: 'gemini' };
        }

        // 2. Server Data
        if (isTranslated) {
            if (section.summary) return { text: section.summary, method: section.summary_method || 'server' };
            if (section.summary_ta) return { text: section.summary_ta, method: section.summary_method || 'server' };
        } else {
            if (section.summary_ta) return { text: section.summary_ta, method: section.summary_method || 'server' };
            if (section.summary) return { text: section.summary, method: section.summary_method || 'server' };
        }

        // 3. Client-side extractive summary
        const clientKey = `${activeSource}_${section.page}`;
        if (clientSummaries[clientKey]) {
            return { text: clientSummaries[clientKey], method: 'extractive' };
        }

        return null;
    };

    // Handler: Generate All Summaries
    const handleGenerateAll = async () => {
        if (!data || !data[activeSource]) return;
        setIsGeneratingAll(true);
        const sections = data[activeSource];

        const tasks = sections.map(async (section) => {
            const key = `${activeSource}_${section.page}`;

            // Skip if already has summary
            const hasGemini = dynamicSummaries[section.page];
            const hasClient = clientSummaries[key];
            const hasServer = (SOURCES[activeSource].lang === 'ta' && !isTranslated) ? section.summary_ta : section.summary;

            if (hasGemini || hasClient || hasServer) return;

            // Strategy: Try Gemini if Key exists, else Client Extractive
            if (settings.geminiKey) {
                try {
                    const result = await geminiService.generateSummary(section.articles, settings.geminiKey, SOURCES[activeSource].lang === 'ta');
                    setDynamicSummaries(prev => ({ ...prev, [section.page]: result }));
                } catch (e) {
                    console.error(`Gemini Gen Failed for ${section.page}:`, e);
                }
            } else {
                 // Client Side Extractive
                 try {
                    await generateClientSummary(section.page, section.articles);
                 } catch (e) {
                    console.error(`Client Summary Failed for ${section.page}:`, e);
                 }
            }
        });

        // Run all in parallel, but don't stop if one fails
        await Promise.allSettled(tasks);

        setIsGeneratingAll(false);
    };

    // Effect: Auto-trigger client summary for the first page if missing
    useEffect(() => {
        if (!data || !data[activeSource]) return;
        const firstSection = data[activeSource][0];
        if (firstSection && !firstSection.summary && !firstSection.summary_ta && !settings.geminiKey) {
             generateClientSummary(firstSection.page, firstSection.articles);
        }
    }, [data, activeSource, settings.geminiKey, generateClientSummary]);

    const currentSections = data ? data[activeSource] : [];
    const isTamilSource = SOURCES[activeSource].lang === 'ta';
    const showTranslationControls = isTamilSource;

    return (
        <div className={`page-container mode-newspaper ${isWebView ? 'page-container--desktop' : ''}`}>
             {/* Header */}
            <div className="header">
                <div className="header__title">
                    <FaNewspaper className="header__title-icon" />
                    <span>Daily Brief</span>
                </div>
                <div className="header__actions" style={{ gap: '8px' }}>
                    <button
                        onClick={handleGenerateAll}
                        className={`btn-icon ${isGeneratingAll ? 'pulse' : ''}`}
                        title="Generate All Summaries"
                        disabled={isGeneratingAll}
                        style={{ color: isGeneratingAll ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                    >
                        <FaBolt size={18} />
                    </button>
                    <button
                        onClick={() => setDigestMode(!digestMode)}
                        className={`btn-icon ${digestMode ? 'active' : ''}`}
                        title={digestMode ? "Card View" : "Digest View"}
                        style={{ color: digestMode ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '1.1rem' }}
                    >
                        {digestMode ? '📰' : '📖'}
                    </button>
                    {showTranslationControls && (
                         <button
                            onClick={() => setIsTranslated(!isTranslated)}
                            className={`btn-icon ${isTranslated ? 'active' : ''}`}
                            title={isTranslated ? "Show Original (Tamil)" : "Translate to English"}
                            style={{ color: isTranslated ? 'var(--accent-primary)' : 'var(--text-secondary)' }}
                        >
                            <FaLanguage size={24} />
                        </button>
                    )}
                    <button onClick={fetchData} className="btn-icon" aria-label="Refresh">
                        <FaSync className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Source Toggles */}
            <div className="topline" style={{ borderRadius: 0, margin: 0, borderLeft: 'none', borderBottom: '1px solid var(--border-default)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
                    {Object.values(SOURCES).map(source => (
                        <button
                            key={source.id}
                            onClick={() => { setActiveSource(source.id); setIsTranslated(false); }}
                            className={`btn ${activeSource === source.id ? 'btn--primary' : 'btn--secondary'}`}
                            style={{ padding: '8px 12px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                        >
                            {source.label}
                        </button>
                    ))}
                </div>
                {lastUpdated && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center' }}>
                        Updated: {new Date(lastUpdated).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
            </div>

            <div className="main-content" style={{ padding: '16px' }}>
                {loading && !data ? (
                    <div className="loading">
                        <div className="loading__spinner"></div>
                        <p>Fetching Today's Brief...</p>
                    </div>
                ) : error ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">⚠️</div>
                        <p>{error}</p>
                        <button onClick={fetchData} className="btn btn--primary mt-md">Retry</button>
                    </div>
                ) : (
                    <div className="newspaper-content">
                        {!currentSections || currentSections.length === 0 ? (
                            <div className="empty-state">
                                <p>No content available for this source today.</p>
                            </div>
                        ) : (
                            currentSections.map((section, idx) => {
                                const summaryResult = getSectionSummary(section);

                                const methodLabels = {
                                    gemini: 'AI Summary',
                                    server: 'Summary',
                                    extractive: 'Auto-Summary',
                                    headlines: 'Headlines'
                                };

                                return (
                                    <div key={idx} className="newspaper-section" style={{ marginBottom: '32px' }}>
                                        <h2 className="zone-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <span>{section.page}</span>
                                            {isTranslatingTitles && isTranslated && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 'normal' }}>
                                                    Translating...
                                                </span>
                                            )}
                                        </h2>

                                        {/* Summary Box */}
                                        {summaryResult ? (
                                            <div style={{
                                                background: 'var(--bg-secondary)',
                                                padding: '16px',
                                                borderRadius: '8px',
                                                marginBottom: '20px',
                                                borderLeft: '4px solid var(--accent-primary)'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontWeight: 'bold', marginBottom: '8px' }}>
                                                    <FaMagic />
                                                    <span>{methodLabels[summaryResult.method] || 'Summary'}</span>
                                                    {summaryResult.method === 'extractive' && (
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '4px' }}>
                                                            (no API key needed)
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{
                                                    whiteSpace: 'pre-line',
                                                    fontSize: '0.95rem',
                                                    lineHeight: '1.6',
                                                    fontFamily: 'serif',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: summaryLineLimit,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}>
                                                    {summaryResult.text}
                                                </div>
                                            </div>
                                        ) : (
                                            /* Error / Fallback State */
                                            <div style={{
                                                padding: '12px',
                                                marginBottom: '20px',
                                                background: 'rgba(255, 0, 0, 0.05)',
                                                borderLeft: '4px solid var(--accent-danger)',
                                                borderRadius: '4px',
                                                fontSize: '0.85rem',
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FaExclamationTriangle color="var(--accent-danger)" />
                                                    <span>
                                                        {section.error === "Quota Exceeded" ? "Daily AI Limit Reached." :
                                                         section.error === "API Key Missing" ? "AI Summary Unavailable." :
                                                         "Summary not generated."}
                                                    </span>
                                                </div>

                                                {!settings.geminiKey && (
                                                    <Link to="/settings" style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>
                                                        Add Key to Enable
                                                    </Link>
                                                )}
                                                {settings.geminiKey && isGeneratingSummary && (
                                                    <span style={{ color: 'var(--accent-primary)' }}>Generating...</span>
                                                )}
                                            </div>
                                        )}

                                        {/* Articles — Grid or Digest mode */}
                                        {digestMode ? (
                                            <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
                                                {section.articles.map((article, aIdx) => {
                                                    const title = (isTranslated && (dynamicTitles[article.link] || article.title_en)) || article.title;
                                                    return (
                                                        <div key={aIdx} style={{
                                                            padding: '8px 0',
                                                            borderBottom: '1px solid var(--border-default)'
                                                        }}>
                                                            <a
                                                                href={article.link}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: 500 }}
                                                            >
                                                                {title}
                                                            </a>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                                gap: '16px'
                                            }}>
                                                {section.articles.map((article, aIdx) => {
                                                    const articleWithTranslation = {
                                                        ...article,
                                                        title_en: dynamicTitles[article.link] || article.title_en
                                                    };
                                                    return (
                                                        <NewspaperCard
                                                            key={aIdx}
                                                            article={articleWithTranslation}
                                                            sourceName={SOURCES[activeSource].label}
                                                            isTranslated={isTranslated}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}

                        <div className="market-disclaimer" style={{ marginTop: '32px' }}>
                            Content aggregated from official sources. Summaries generated by AI.
                            Verify important details from original articles.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewspaperPage;
