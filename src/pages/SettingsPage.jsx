import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import Toggle from '../components/Toggle';
import { DEFAULT_SETTINGS } from '../utils/storage';
import { useSettings } from '../context/SettingsContext';
import { discoverFeeds } from '../utils/feedDiscovery';
import { APP_VERSION } from '../utils/version';
import { ENTITY_OVERRIDES } from '../data/entityOverrides';
import { computeImpactScore } from '../services/rssAggregator';
import DebugTab from '../components/DebugTab';
import EmptyState from '../components/EmptyState';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';
import WeatherLocationManager from '../components/weather/WeatherLocationManager.jsx';
import DisplayPreferencesPanel from '../components/settings/DisplayPreferencesPanel.jsx';
import TravelLocationSettingsPanel from '../components/settings/TravelLocationSettingsPanel.jsx';

/**
 * Helper to calculate a "Quality Rating" (1-5 stars) for the current ranking configuration.
 */
const calculatePreviewStars = (weights) => {
    const w = weights || {};
    const fresh = w.freshness?.maxBoost || 3.0;
    const source = w.source?.tier1Boost || 5.0;
    const visual = w.visual?.videoBoost || 1.3;
    const city = w.geo?.cityMatch || 1.5;

    let score = 0;
    if (fresh >= 2.5 && fresh <= 4.0) score += 1.5;
    else if (fresh > 1.0) score += 1.0;
    if (source >= 4.0 && source <= 7.0) score += 1.5;
    else if (source >= 2.0) score += 1.0;
    if (visual >= 1.2 && visual <= 1.5) score += 1.0;
    else score += 0.5;
    if (city >= 1.3 && city <= 2.0) score += 1.0;
    else score += 0.5;

    return Math.min(5, Math.max(1, Math.round(score)));
};

/**
 * Settings Page Component
 */
function SettingsPage() {
    const { settings, updateSettings, reloadSettings } = useSettings();
    const [activeTab, setActiveTab] = useState('general');
    const [saved, setSaved] = useState(false);

    // Feed Discovery State
    const [newFeedUrl, setNewFeedUrl] = useState('');
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState(null);

    // Keyword Input State (Dynamic for all categories)
    const [keywordInputs, setKeywordInputs] = useState({});

    // Tier Input State
    const [tierInputs, setTierInputs] = useState({ tier1: '', tier2: '', tier3: '' });

    // Sandbox State
    const [sandbox, setSandbox] = useState({
        title: 'Breaking: Major Economic Reforms Announced',
        description: 'Government unveils new policy to boost GDP growth by 2%. Markets rally on the news.',
        source: 'BBC News',
        age: 2,
        section: 'business',
        result: null
    });

    useEffect(() => {
        if (!settings?.rankingWeights) return;
        const dummyItem = {
            title: sandbox.title,
            description: sandbox.description,
            source: sandbox.source,
            publishedAt: Date.now() - (sandbox.age * 60 * 60 * 1000),
            section: sandbox.section,
            imageUrl: null
        };
        const simSettings = { ...settings, debugLogs: true };
        const score = computeImpactScore(dummyItem, sandbox.section, 0, simSettings);
        setSandbox(prev => ({ ...prev, result: { score, breakdown: dummyItem._scoreBreakdown } }));
    }, [sandbox.title, sandbox.description, sandbox.source, sandbox.age, sandbox.section, settings]);

    if (!settings) return <div className="loading">Loading...</div>;

    const updateNested = (path, value) => {
        const keys = path.split('.');
        const newSettings = { ...settings };
        let obj = newSettings;
        for (let i = 0; i < keys.length - 1; i++) {
            obj[keys[i]] = { ...obj[keys[i]] };
            obj = obj[keys[i]];
        }
        obj[keys[keys.length - 1]] = value;
        updateSettings(newSettings);
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        reloadSettings();
    };

    const handleReset = () => {
        if (window.confirm('Reset all settings to defaults?')) {
            updateSettings({ ...DEFAULT_SETTINGS });
            reloadSettings();
        }
    };

    // --- GENERIC LIST HELPERS ---
    const addToList = (path, item) => {
        if (!item || !item.trim()) return;
        const keys = path.split('.');
        let currentList = settings;
        for (const k of keys) currentList = currentList?.[k] || [];

        if (!Array.isArray(currentList)) currentList = [];

        if (!currentList.includes(item.trim())) {
            updateNested(path, [...currentList, item.trim()]);
        }
    };

    const removeFromList = (path, item) => {
        const keys = path.split('.');
        let currentList = settings;
        for (const k of keys) currentList = currentList?.[k] || [];

        if (Array.isArray(currentList)) {
            updateNested(path, currentList.filter(i => i !== item));
        }
    };

    // --- KEYWORD MANAGEMENT WRAPPER ---
    const handleAddKeyword = (key, value) => {
        addToList(key, value);
        setKeywordInputs({ ...keywordInputs, [key]: '' });
    };

    // --- TIER MANAGEMENT ---
    const addTierSource = (tier, source) => {
        if (!source || !source.trim()) return;
        const currentList = settings.sourceTiers?.[tier] || [];
        if (!currentList.some(s => s.toLowerCase() === source.trim().toLowerCase())) {
            updateNested(`sourceTiers.${tier}`, [...currentList, source.trim()]);
        }
        setTierInputs({ ...tierInputs, [tier]: '' });
    };

    const removeTierSource = (tier, source) => {
        const currentList = settings.sourceTiers?.[tier] || [];
        updateNested(`sourceTiers.${tier}`, currentList.filter(s => s !== source));
    };

    // --- FEED MANAGEMENT ---
    const handleAddFeed = async () => {
        if (!newFeedUrl) return;
        setIsDiscovering(true);
        setDiscoveryError(null);
        try {
            const feeds = await discoverFeeds(newFeedUrl);
            if (feeds.length > 0) {
                const bestFeed = feeds[0];
                updateSettings({
                    ...settings,
                    customFeeds: [...(settings.customFeeds || []), { title: bestFeed.title, url: bestFeed.url }]
                });
                setNewFeedUrl('');
            } else {
                setDiscoveryError('No feeds found.');
            }
        } catch (error) {
            void error;
            setDiscoveryError('Error discovering feeds.');
        } finally {
            setIsDiscovering(false);
        }
    };

    const removeCustomFeed = (index) => {
        const newFeeds = [...(settings.customFeeds || [])];
        newFeeds.splice(index, 1);
        updateSettings({ ...settings, customFeeds: newFeeds });
    };

    // --- EXPORT / IMPORT ---
    const handleExport = () => {
        const exportData = {
            settings: settings,
            hiddenEvents: JSON.parse(localStorage.getItem('upAhead_hiddenEvents') || '[]'),
            watchlist: JSON.parse(localStorage.getItem('upAhead_watchlist') || '[]'),
            readingHistory: settings.readingHistory || []
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "news_app_full_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleImport = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (window.confirm('Replace current settings, hidden events, and watchlist with imported data?')) {
                    if (imported.settings) {
                        updateSettings(imported.settings);
                        if (imported.hiddenEvents) localStorage.setItem('upAhead_hiddenEvents', JSON.stringify(imported.hiddenEvents));
                        if (imported.watchlist) localStorage.setItem('upAhead_watchlist', JSON.stringify(imported.watchlist));
                    } else {
                        updateSettings(imported);
                    }
                    reloadSettings();
                }
            } catch {
                alert('Invalid backup file');
            }
        };
        reader.readAsText(file);
    };

    // --- TABS ---
    const tabs = [
        { id: 'general', label: 'General', icon: '⚙️' },
        { id: 'ranking', label: 'Ranking', icon: '🧠' },
        { id: 'weather', label: 'Weather', icon: '🌤️' },
        { id: 'sources', label: 'Sources', icon: '📡' },
        { id: 'market', label: 'Market', icon: '📈' },
        { id: 'sandbox', label: 'Sandbox', icon: '🧪' },
        { id: 'advanced', label: 'Advanced', icon: '🔧' },
        { id: 'debug', label: 'Debug', icon: '🐛' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="settings-tab-content">
                        <SectionTitle icon="📱" title="Interface" />
                        <SettingCard>
                            <SettingItem label="Home Layout" subLabel="Timeline / Classic / Newspaper">
                                <select value={settings.uiMode || 'timeline'} onChange={(e) => updateSettings({ ...settings, uiMode: e.target.value })} className="settings-select">
                                    <option value="timeline">📱 Timeline</option>
                                    <option value="classic">📊 Classic</option>
                                    <option value="newspaper">📰 Newspaper</option>
                                </select>
                            </SettingItem>
                            <SettingItem label="Font Size" subLabel={`${settings.fontSize || 26}px`}>
                                <input type="range" min="14" max="34" step="1" value={settings.fontSize || 26} onChange={(e) => updateSettings({ ...settings, fontSize: parseInt(e.target.value) })} style={{ width: '100%' }} />
                            </SettingItem>
                        </SettingCard>
                        <SectionTitle icon="🤖" title="AI Configuration" />
                        <SettingCard>
                            <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div className="settings-item__label">
                                    <span>Gemini API Key</span>
                                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.65rem' }}>Required for client-side fallback.</small>
                                </div>
                                <input type="password" value={settings.geminiKey || ''} onChange={(e) => updateSettings({ ...settings, geminiKey: e.target.value })} className="settings-input" placeholder="Enter API Key" />
                            </div>
                        </SettingCard>
                        <SectionTitle icon="📈" title="Market Data" />
                        <SettingCard>
                            <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div className="settings-item__label">
                                    <span>Alpha Vantage API Key</span>
                                </div>
                                <input type="password" value={settings.alphaVantageKey || ''} onChange={(e) => updateSettings({ ...settings, alphaVantageKey: e.target.value })} className="settings-input" placeholder="Enter AV Key" />
                            </div>
                        </SettingCard>
                    </div>
                );

            case 'ranking':
                return (
                    <MergedRankingTab
                        settings={settings}
                        updateNested={updateNested}
                        updateSettings={updateSettings}
                        addToList={addToList}
                        removeFromList={removeFromList}
                    />
                );

            case 'weather':
                return (
                    <div className="settings-tab-content">
                        <SectionTitle icon="📍" title="Locations" />
                        <WeatherLocationManager />

                        <SectionTitle icon="🧩" title="Display Preferences" />
                        <SettingCard>
                            <DisplayPreferencesPanel />
                            <TravelLocationSettingsPanel />
                        </SettingCard>

                        <SectionTitle icon="🌤️" title="Weather Models" />
                        <SettingCard>
                            <SettingItem label="ECMWF (European)"><Toggle checked={settings.weather?.models?.ecmwf !== false} onChange={(val) => updateNested('weather.models.ecmwf', val)} /></SettingItem>
                            <SettingItem label="GFS (NOAA)"><Toggle checked={settings.weather?.models?.gfs !== false} onChange={(val) => updateNested('weather.models.gfs', val)} /></SettingItem>
                            <SettingItem label="ICON (DWD)"><Toggle checked={settings.weather?.models?.icon !== false} onChange={(val) => updateNested('weather.models.icon', val)} /></SettingItem>
                        </SettingCard>
                    </div>
                );

            case 'sources':
                return (
                    <div className="settings-tab-content">
                        <SectionTitle icon="📡" title="News Sources" />
                        <SettingCard>
                            <div className="settings-item" style={{
                                borderBottom: '1px solid var(--accent-danger)',
                                background: 'rgba(220, 38, 38, 0.15)',
                                padding: '10px'
                            }}>
                                <div className="settings-item__label" style={{ color: 'var(--accent-danger)' }}>
                                    <span>🏆 Top Websites Only</span>
                                    <small style={{ display: 'block', color: 'var(--text-muted)' }}>BBC, Reuters, NDTV, Hindu, TOI...</small>
                                </div>
                                <Toggle checked={settings.topWebsitesOnly === true} onChange={(val) => updateSettings({ ...settings, topWebsitesOnly: val })} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px' }}>
                                {Object.keys(settings.newsSources || {}).map(key => (
                                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                                        <input type="checkbox" checked={settings.newsSources?.[key] !== false} onChange={(e) => updateNested(`newsSources.${key}`, e.target.checked)} disabled={settings.topWebsitesOnly} />
                                        {key}
                                    </label>
                                ))}
                            </div>
                        </SettingCard>

                        <SectionTitle icon="🏆" title="Source Tiers" />
                        <SettingCard>
                            <div style={{fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'15px'}}>
                                Classify sources to boost their ranking score.
                            </div>

                            <KeywordInput
                                label={`Tier 1 (High Boost: ${(settings.rankingWeights?.source?.tier1Boost || 0.5)}x)`}
                                placeholder="e.g. BBC, Reuters"
                                value={tierInputs.tier1}
                                onChange={(val) => setTierInputs({...tierInputs, tier1: val})}
                                onAdd={() => addTierSource('tier1', tierInputs.tier1)}
                                items={settings.sourceTiers?.tier1 || []}
                                onRemove={(s) => removeTierSource('tier1', s)}
                            />

                            <KeywordInput
                                label={`Tier 2 (Medium Boost: ${(settings.rankingWeights?.source?.tier2Boost || 0.2)}x)`}
                                placeholder="e.g. NDTV, Hindu"
                                value={tierInputs.tier2}
                                onChange={(val) => setTierInputs({...tierInputs, tier2: val})}
                                onAdd={() => addTierSource('tier2', tierInputs.tier2)}
                                items={settings.sourceTiers?.tier2 || []}
                                onRemove={(s) => removeTierSource('tier2', s)}
                            />

                            <KeywordInput
                                label={`Tier 3 (No Boost: ${(settings.rankingWeights?.source?.tier3Boost || 0.0)}x)`}
                                placeholder="e.g. Local Blogs"
                                value={tierInputs.tier3}
                                onChange={(val) => setTierInputs({...tierInputs, tier3: val})}
                                onAdd={() => addTierSource('tier3', tierInputs.tier3)}
                                items={settings.sourceTiers?.tier3 || []}
                                onRemove={(s) => removeTierSource('tier3', s)}
                            />
                        </SettingCard>

                        <SectionTitle icon="🔗" title="Custom Feeds" />
                        <SettingCard>
                             <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                <input
                                    type="text"
                                    value={newFeedUrl}
                                    onChange={(e) => setNewFeedUrl(e.target.value)}
                                    placeholder="RSS URL..."
                                    className="settings-input"
                                />
                                <button className="btn btn--primary" onClick={handleAddFeed} disabled={isDiscovering}>
                                    {isDiscovering ? '...' : 'Add'}
                                </button>
                            </div>
                            {discoveryError && <div style={{color:'red', fontSize:'0.75rem'}}>{discoveryError}</div>}
                            {settings.customFeeds?.map((feed, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '5px 0' }}>
                                    <span>{feed.title || feed.url}</span>
                                    <button onClick={() => removeCustomFeed(i)} style={{color:'red'}}>✕</button>
                                </div>
                            ))}
                        </SettingCard>
                    </div>
                );

            case 'market':
                return (
                    <div className="settings-tab-content">
                        <SectionTitle icon="📈" title="Market Display" />
                        <SettingCard>
                            {Object.keys(settings.market || {}).filter(k => k.startsWith('show')).map(key => (
                                <SettingItem key={key} label={key.replace('show', '')}>
                                    <Toggle checked={settings.market?.[key] !== false} onChange={(val) => updateNested(`market.${key}`, val)} />
                                </SettingItem>
                            ))}
                        </SettingCard>
                        <SectionTitle icon="🗓️" title="Market Session" />
                        <SettingCard>
                            <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                                <div className="settings-item__label">
                                    <span>Trading Holidays</span>
                                    <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                                        Comma-separated `YYYY-MM-DD` dates in IST. Used to mark the Market tab as Closed.
                                    </small>
                                </div>
                                <textarea
                                    className="settings-input"
                                    style={{ minHeight: '84px', resize: 'vertical' }}
                                    value={(settings.market?.tradingHolidays || []).join(', ')}
                                    onChange={(e) => {
                                        const holidays = e.target.value
                                            .split(',')
                                            .map((date) => date.trim())
                                            .filter(Boolean);
                                        updateNested('market.tradingHolidays', holidays);
                                    }}
                                    placeholder="2026-04-10, 2026-04-14"
                                />
                            </div>
                        </SettingCard>
                    </div>
                );

            case 'sandbox':
                return (
                    <div className="settings-tab-content">
                        <SectionTitle icon="🧪" title="Ranking Sandbox" />
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                            Simulate how the current settings affect an article's score. Change settings in the "Ranking" tab to see impact here.
                        </div>

                        <SettingCard>
                            <div style={{display:'grid', gap:'10px'}}>
                                <div>
                                    <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'4px'}}>Title</label>
                                    <input className="settings-input" value={sandbox.title} onChange={(e) => setSandbox({...sandbox, title: e.target.value})} />
                                </div>
                                <div>
                                    <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'4px'}}>Description</label>
                                    <textarea className="settings-input" style={{resize:'vertical', minHeight:'60px'}} value={sandbox.description} onChange={(e) => setSandbox({...sandbox, description: e.target.value})} />
                                </div>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                                    <div>
                                        <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'4px'}}>Source</label>
                                        <select className="settings-select" value={sandbox.source} onChange={(e) => setSandbox({...sandbox, source: e.target.value})} style={{width:'100%'}}>
                                            <option value="BBC News">BBC (Tier 1)</option>
                                            <option value="Unknown Blog">Blog (Tier 3)</option>
                                            <option value="NDTV">NDTV (Tier 2)</option>
                                            <option value="TechCrunch">TechCrunch</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'4px'}}>Section</label>
                                        <select className="settings-select" value={sandbox.section} onChange={(e) => setSandbox({...sandbox, section: e.target.value})} style={{width:'100%'}}>
                                            <option value="world">World (High Priority)</option>
                                            <option value="business">Business</option>
                                            <option value="technology">Technology</option>
                                            <option value="general">General</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={{fontSize:'0.75rem', color:'var(--text-muted)', display:'block', marginBottom:'4px'}}>Age: {sandbox.age} hours</label>
                                    <input type="range" min="0" max="72" step="1" value={sandbox.age} onChange={(e) => setSandbox({...sandbox, age: parseInt(e.target.value)})} style={{width:'100%'}} />
                                </div>
                            </div>
                        </SettingCard>

                        {sandbox.result && (
                            <div className="modern-card" style={{border:'1px solid var(--accent-primary)', background:'rgba(0,0,0,0.2)'}}>
                                <div style={{textAlign:'center', padding:'10px', borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                                    <div style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>CALCULATED SCORE</div>
                                    <div style={{fontSize:'2.5rem', fontWeight:'bold', color:'var(--accent-primary)'}}>
                                        {sandbox.result.score.toFixed(1)}
                                    </div>
                                </div>
                                <div style={{padding:'10px', fontSize:'0.75rem'}}>
                                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                                        <tbody>
                                            {Object.entries(sandbox.result.breakdown || {}).map(([key, val]) => {
                                                if (key === 'total' || typeof val !== 'number') return null;
                                                return (
                                                    <tr key={key} style={{borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                                                        <td style={{padding:'4px', textTransform:'capitalize', color:'var(--text-secondary)'}}>{key.replace(/([A-Z])/g, ' $1').trim()}</td>
                                                        <td style={{padding:'4px', textAlign:'right', fontWeight:'bold', color: val > 1.5 ? '#4f4' : val < 0.5 ? '#f44' : '#fff'}}>
                                                            {val.toFixed(2)}{key.toLowerCase().includes('boost') || key.toLowerCase().includes('multiplier') ? 'x' : ''}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );

            case 'advanced':
                return (
                    <div className="settings-tab-content">
                        <SectionTitle icon="🔧" title="Advanced" />
                        <SettingCard>
                            <SettingItem label="Enable News Cache" subLabel="Faster loads, 5min TTL">
                                <Toggle checked={settings.enableCache !== false} onChange={(val) => updateSettings({ ...settings, enableCache: val })} />
                            </SettingItem>
                            <SettingItem label="Crawler Mode">
                                <select value={settings.crawlerMode || 'auto'} onChange={(e) => updateSettings({ ...settings, crawlerMode: e.target.value })} className="settings-select">
                                    <option value="auto">Auto</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </SettingItem>
                            <SettingItem label="Debug Logs">
                                <Toggle checked={settings.debugLogs === true} onChange={(val) => updateSettings({ ...settings, debugLogs: val })} />
                            </SettingItem>
                        </SettingCard>

                        <SectionTitle icon="🕵️" title="Impact & Priority" />
                        <SettingCard>
                            <SettingItem label="💥 Base Impact Weight" subLabel="Multiplier">
                                <input type="range" min="0.5" max="3.0" step="0.1" value={settings.rankingWeights?.impact?.boost || 1.0} onChange={(e) => updateNested('rankingWeights.impact.boost', parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </SettingItem>
                            <SettingItem label="🔥 High Impact Boost" subLabel="Triggers on Major Event Keywords">
                                <input type="range" min="1.0" max="5.0" step="0.1" value={settings.rankingWeights?.impact?.highImpactBoost || 2.5} onChange={(e) => updateNested('rankingWeights.impact.highImpactBoost', parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </SettingItem>
                            <KeywordInput
                                label="Major Event Keywords"
                                placeholder="e.g. Budget, Treaty, War"
                                value={keywordInputs.highImpact}
                                onChange={(val) => setKeywordInputs({...keywordInputs, highImpact: val})}
                                onAdd={() => handleAddKeyword('highImpactKeywords', keywordInputs.highImpact)}
                                items={settings.highImpactKeywords || []}
                                onRemove={(w) => removeFromList('highImpactKeywords', w)}
                            />
                            <div style={{fontSize:'0.7rem', color:'var(--text-muted)', marginTop:'5px'}}>
                                ℹ️ Articles containing these words receive the <strong>High Impact Boost</strong> (above).
                            </div>
                        </SettingCard>

                        <SectionTitle icon="⚡" title="Buzz Ranking" />
                        <SettingCard>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                Configuration for "Buzz" and "Social" sections.
                            </div>
                            <SettingItem label="📸 Visual Boost" subLabel="Videos/Images">
                                <input type="range" min="1.0" max="3.0" step="0.1" value={settings.buzzRankingWeights?.visual?.videoBoost || 2.0} onChange={(e) => updateNested('buzzRankingWeights.visual.videoBoost', parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </SettingItem>
                            <SettingItem label="🔥 Trend Threshold" subLabel="Lower = More Trending">
                                <input type="range" min="5" max="20" step="1" value={settings.buzzRankingWeights?.trending?.threshold || 10} onChange={(e) => updateNested('buzzRankingWeights.trending.threshold', parseFloat(e.target.value))} style={{ width: '100%' }} />
                            </SettingItem>
                        </SettingCard>

                        <SectionTitle icon="🔄" title="Backup & Sync" />
                        <SettingCard>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn--secondary" onClick={handleExport} style={{ flex: 1 }}>
                                    Export Backup
                                </button>
                                <label className="btn btn--secondary" style={{ flex: 1, cursor: 'pointer', textAlign:'center' }}>
                                    Import Backup
                                    <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                                </label>
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                                Saves Settings, Hidden Events (Plan My Week), and Watchlist to a file.
                            </div>
                        </SettingCard>
                    </div>
                );

            case 'debug': return <DebugTab />;
            default: return null;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
            <Header title="Settings" showBack backTo="/" compact={true} style={{ flex: '0 0 auto' }} />
            <div className="settings-layout">
                <div className="settings-sidebar">
                    {tabs.map(tab => (
                        <button key={tab.id} className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                            <span className="tab-icon">{tab.icon}</span>
                            <span className="tab-label">{tab.label}</span>
                        </button>
                    ))}
                </div>
                <div className="settings-content">
                    <div className="settings-scroll-area" style={{ overflowY: activeTab === 'ranking' ? 'hidden' : 'auto', padding: activeTab === 'ranking' ? 0 : '15px' }}>{renderContent()}</div>
                    <div className="settings-footer">
                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                            <button className="btn btn--danger" onClick={handleReset} style={{flex:1}}>Reset</button>
                            <button className="btn btn--primary" onClick={handleSave} style={{flex:1}}>{saved ? '✓ Saved' : 'Save'}</button>
                        </div>
                        <div className="version-tag">{APP_VERSION}</div>
                    </div>
                </div>
            </div>
            <style>{`
                .settings-layout { display: flex; flex: 1; overflow: hidden; background: var(--bg-primary); }
                .settings-sidebar { width: 72px; background: var(--bg-secondary); border-right: 1px solid var(--border-default); display: flex; flex-direction: column; padding: 10px 5px; overflow-y: auto; flex-shrink: 0; }
                .settings-tab-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px 4px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; border-radius: 8px; margin-bottom: 8px; width: 100%; transition: background 0.2s; min-height: 50px; }
                .settings-tab-btn.active { background: var(--accent-primary); color: #fff; }
                .tab-icon { font-size: 1.5rem; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex-shrink: 0; }
                .tab-label { font-size: 0.6rem; text-align: center; line-height: 1.1; display: none; }
                @media (min-height: 600px) { .tab-label { display: block; } }
                .settings-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
                .settings-scroll-area { flex: 1; overflow-y: auto; padding: 15px; }
                .settings-footer { flex-shrink: 0; background: var(--bg-secondary); border-top: 1px solid var(--border-default); padding: 15px; }
                .section-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 12px; color: var(--accent-primary); display: flex; align-items: center; gap: 8px; }
                .settings-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
                .settings-item:last-child { border-bottom: none; }
                .settings-select, .settings-input, .settings-input-number { background: var(--bg-secondary); border: 1px solid var(--border-default); color: var(--text-primary); padding: 8px; border-radius: 4px; font-size: 0.85rem; }
                .settings-input { width: 100%; }
                .chip-checkbox { display: flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 16px; border: 1px solid var(--border-default); background: var(--bg-secondary); color: var(--text-primary); font-size: 0.8rem; cursor: pointer; }
                .chip-checkbox.active { background: var(--accent-primary); color: #fff; border-color: var(--accent-primary); }
                .keyword-chip { display: inline-flex; align-items: center; padding: 4px 8px; background: var(--bg-tertiary); border-radius: 4px; margin: 2px; font-size: 0.75rem; }
                .keyword-chip button { background: none; border: none; color: var(--accent-danger); margin-left: 6px; cursor: pointer; padding: 0; }
                .version-tag { text-align: right; font-size: 0.7rem; color: var(--text-muted); margin-top: 8px; font-family: monospace; opacity: 0.7; }
            `}</style>
        </div>
    );
}

// --- MERGED RANKING COMPONENT (3-Level Vertical Tabs) ---
const MergedRankingTab = ({ settings, updateNested, updateSettings, addToList, removeFromList }) => {
    // Top Level: 'main' (Global/TopStories), 'buzz', 'upahead'
    const [topLevelTab, setTopLevelTab] = useState('main');

    // Sub Level State (Managed independently per top level for better UX, or unified)
    const [buzzSubTab, setBuzzSubTab] = useState('entertainment');
    const [upAheadSubTab, setUpAheadSubTab] = useState('movies');

    const [localInputs, setLocalInputs] = useState({});
    const handleLocalInput = (key, val) => setLocalInputs(prev => ({ ...prev, [key]: val }));

    // --- 1. MAIN TAB CONTENT ---
    const renderMainContent = () => {
        const stars = calculatePreviewStars(settings.rankingWeights || {});
        return (
            <div>
                <div className="modern-card" style={{ padding: '16px', marginBottom: '20px', background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(0,0,0,0))', border: '1px solid rgba(255,215,0,0.3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div><div style={{ fontWeight: 600, color: '#FFD700' }}>★ Quality Rating</div></div>
                        <div style={{ fontSize: '1.8rem', color: '#FFD700' }}>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
                    </div>
                </div>

                <SectionTitle icon="🏆" title="Top Stories & Global" />
                <SettingCard>
                    <SettingItem label="🏆 Top Stories Boost" subLabel="Min Score for Top Stories">
                        <input type="range" min="8" max="30" step="1" value={settings.rankingWeights?.trending?.threshold || 12} onChange={(e) => updateNested('rankingWeights.trending.threshold', parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </SettingItem>
                    <SettingItem label="📌 Keyword Match" subLabel={`+${(settings.rankingWeights?.keyword?.matchBoost || 2.0).toFixed(1)} Points`}>
                        <input type="range" min="0" max="5" step="0.5" value={settings.rankingWeights?.keyword?.matchBoost || 2.0} onChange={(e) => updateNested('rankingWeights.keyword.matchBoost', parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </SettingItem>
                    <SettingItem label="📍 Location Match" subLabel={`${(settings.rankingWeights?.geo?.cityMatch || 1.5).toFixed(1)}x Multiplier`}>
                        <input type="range" min="1" max="5" step="0.1" value={settings.rankingWeights?.geo?.cityMatch || 1.5} onChange={(e) => updateNested('rankingWeights.geo.cityMatch', parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </SettingItem>
                </SettingCard>

                <SectionTitle icon="📉" title="Freshness & Decay" />
                <SettingCard>
                    <SettingItem label="🎚️ Freshness Sensitivity" subLabel="Left: Stricter (Newer) | Right: Relaxed">
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px' }}>
                            <span title="Strict/Fresh" style={{fontSize:'1.2rem'}}>⚡</span>
                            <input
                                type="range"
                                min="6"
                                max="72"
                                value={settings.rankingWeights?.freshness?.decayHours || 26}
                                onChange={(e) => updateNested('rankingWeights.freshness.decayHours', parseInt(e.target.value))}
                                style={{ flex: 1 }}
                            />
                            <span title="Relaxed/Older" style={{fontSize:'1.2rem'}}>🐢</span>
                        </div>
                        <div style={{textAlign:'right', fontSize:'0.7rem', color:'var(--text-muted)'}}>
                            Decay over {settings.rankingWeights?.freshness?.decayHours || 26}h
                        </div>
                    </SettingItem>
                    <SettingItem label="📉 Hide Stale News" subLabel={`> ${settings.hideOlderThanHours || 60}h`}>
                        <input type="number" min={1} max={168} value={settings.hideOlderThanHours || 60} onChange={(e) => updateSettings({ ...settings, hideOlderThanHours: parseInt(e.target.value) || 60 })} className="settings-input-number" style={{ width: '60px' }} />
                    </SettingItem>
                </SettingCard>

                <SectionTitle icon="🧠" title="Classification Logic" />
                <SettingCard>
                    <div style={{fontSize: '0.8rem', color:'var(--text-muted)', marginBottom:'15px'}}>
                        Automatic categorization logic.
                    </div>
                    <div className="settings-item__label" style={{color:'var(--accent-primary)', marginTop:'10px'}}>Entity Overrides (Exact Matches)</div>
                    <div style={{maxHeight:'200px', overflowY:'auto', background:'rgba(0,0,0,0.2)', padding:'10px', borderRadius:'8px', margin:'5px 0 15px 0', fontSize:'0.75rem', fontFamily:'monospace'}}>
                        {Object.entries(ENTITY_OVERRIDES).map(([entity, section]) => (
                            <div key={entity} style={{display:'flex', justifyContent:'space-between'}}>
                                <span style={{color:'var(--text-primary)'}}>{entity}</span>
                                <span style={{color:'var(--text-muted)'}}>→ {section}</span>
                            </div>
                        ))}
                    </div>
                </SettingCard>
            </div>
        );
    };

    // --- 2. BUZZ TAB CONTENT ---
    const renderBuzzContent = () => {
        const navItems = [
            { id: 'entertainment', label: 'Entertain', icon: '🎬' },
            { id: 'technology', label: 'Tech', icon: '💻' },
            { id: 'sports', label: 'Sports', icon: '⚽' },
            { id: 'social', label: 'Social', icon: '🔥' },
        ];

        return (
            <div style={{ display: 'flex', height: '100%', gap: '10px' }}>
                <div style={{ width: '70px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setBuzzSubTab(item.id)}
                            style={{
                                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                                padding:'8px 4px', border:'none', background: buzzSubTab === item.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                color: buzzSubTab === item.id ? '#fff' : 'var(--text-secondary)',
                                borderRadius:'8px', cursor:'pointer', fontSize:'0.7rem', fontWeight:500
                            }}
                        >
                            <span style={{fontSize:'1.3rem', marginBottom:'2px'}}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {buzzSubTab === 'social' ? (
                        <div>
                            <SectionTitle icon="🔥" title="Social Trends" />
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                                Uses <strong>Legacy Scoring</strong> (Freshness + Source).
                            </div>
                            <SettingCard>
                                <SettingItem label="📸 Visual Boost" subLabel="Videos/Images">
                                    <input type="range" min="1.0" max="3.0" step="0.1" value={settings.buzzRankingWeights?.visual?.videoBoost || 2.0} onChange={(e) => updateNested('buzzRankingWeights.visual.videoBoost', parseFloat(e.target.value))} style={{ width: '100%' }} />
                                </SettingItem>
                                <SettingItem label="🔥 Trend Threshold" subLabel="Lower = More Trending">
                                    <input type="range" min="5" max="20" step="1" value={settings.buzzRankingWeights?.trending?.threshold || 10} onChange={(e) => updateNested('buzzRankingWeights.trending.threshold', parseFloat(e.target.value))} style={{ width: '100%' }} />
                                </SettingItem>
                            </SettingCard>
                        </div>
                    ) : (
                        <GenericRankingConfig
                            title={buzzSubTab.charAt(0).toUpperCase() + buzzSubTab.slice(1)}
                            icon={navItems.find(i => i.id === buzzSubTab).icon}
                            configPath={`buzz.${buzzSubTab}`}
                            configData={settings.buzz?.[buzzSubTab] || {}}
                            updateNested={updateNested}
                            addToList={addToList}
                            removeFromList={removeFromList}
                            localInputs={localInputs}
                            handleLocalInput={handleLocalInput}
                            subTab={buzzSubTab}
                        />
                    )}
                </div>
            </div>
        );
    };

    // --- 3. UP AHEAD TAB CONTENT ---
    const renderUpAheadContent = () => {
        const categories = [
            { id: 'movies', label: 'Movies', icon: '🎬' },
            { id: 'events', label: 'Events', icon: '🎤' },
            { id: 'festivals', label: 'Festivals', icon: '🪔' },
            { id: 'sports', label: 'Sports', icon: '⚽' },
            { id: 'shopping', label: 'Shopping', icon: '🛒' },
            { id: 'airlines', label: 'Airlines', icon: '✈️' },
            { id: 'alerts', label: 'Alerts', icon: '⚠️' },
            { id: 'civic', label: 'Civic', icon: '🏛️' }
        ];

        // Helper to get merged config for Up Ahead (combining legacy raw keyword arrays with new multipliers)
        // We will store multipliers in `upAhead.ranking[catId]`
        // Keywords remain in `upAhead.keywords[catId]`
        const catConfig = settings.upAhead?.ranking?.[upAheadSubTab] || {};

        // Helper to resolve effective keywords (User Setting > Default)
        // If user setting is empty/undefined, the service uses defaults, so we show defaults.
        const getEffectiveKeywords = (type) => {
            const userList = type === 'positive'
                ? settings.upAhead?.keywords?.[upAheadSubTab]
                : settings.upAhead?.keywords?.[`${upAheadSubTab}_negative`];

            // If user list exists and has length, use it.
            if (userList && userList.length > 0) return userList;

            // Fallback to defaults
            const defaultList = type === 'positive'
                ? DEFAULT_SETTINGS.upAhead.keywords[upAheadSubTab]
                : DEFAULT_SETTINGS.upAhead.keywords[`${upAheadSubTab}_negative`];

            return defaultList || [];
        };

        const effectivePositiveKeywords = getEffectiveKeywords('positive');
        const effectiveNegativeKeywords = getEffectiveKeywords('negative');

        // Helper for global negatives
        const getEffectiveGlobalNegatives = () => {
             const userList = settings.upAhead?.keywords?.negative;
             if (userList && userList.length > 0) return userList;
             return DEFAULT_SETTINGS.upAhead.keywords.negative || [];
        };
        const effectiveGlobalNegatives = getEffectiveGlobalNegatives();
        const getEffectiveWeatherRuleList = (field) => {
            const userList = settings.upAhead?.weatherAlertRules?.[field];
            if (userList && userList.length > 0) return userList;
            return DEFAULT_SETTINGS.upAhead.weatherAlertRules?.[field] || [];
        };
        const effectiveAmbiguousKeywords = getEffectiveWeatherRuleList('ambiguousKeywords');
        const effectiveContextKeywords = getEffectiveWeatherRuleList('contextKeywords');
        const effectiveBannerKeywords = getEffectiveWeatherRuleList('bannerKeywords');
        const effectiveWeatherMinimumMatches = settings.upAhead?.weatherAlertRules?.minimumMatches ?? DEFAULT_SETTINGS.upAhead.weatherAlertRules?.minimumMatches ?? 2;
        const effectiveOfferKeywords = settings.upAhead?.offerRules?.offerKeywords?.length
            ? settings.upAhead.offerRules.offerKeywords
            : (DEFAULT_SETTINGS.upAhead.offerRules?.offerKeywords || []);
        const effectiveOfferMinimumMatches = settings.upAhead?.offerRules?.minimumMatches ?? DEFAULT_SETTINGS.upAhead.offerRules?.minimumMatches ?? 1;

        // We synthesize a config object that looks like the Buzz one for the generic component
        const synthesizedConfig = {
            enabled: settings.upAhead?.categories?.[upAheadSubTab] !== false,
            positiveMultiplier: catConfig.positiveMultiplier || 1.0,
            negativeMultiplier: catConfig.negativeMultiplier || 1.0,
            filterThreshold: catConfig.filterThreshold || 0,
            // Generic component expects keyword arrays in the config object
            positiveKeywords: effectivePositiveKeywords,
            negativeKeywords: [
                ...effectiveGlobalNegatives, // Global negatives
                ...effectiveNegativeKeywords // Category specific negatives
            ]
        };

        // Custom override for Up Ahead updating because data structure is split
        // Generic component tries to update `path.positiveKeywords`, but we need `upAhead.keywords.catId`
        const handleUpAheadUpdate = (field, val) => {
            if (field === 'enabled') {
                updateNested(`upAhead.categories.${upAheadSubTab}`, val);
            } else if (field === 'positiveMultiplier' || field === 'negativeMultiplier' || field === 'filterThreshold') {
                updateNested(`upAhead.ranking.${upAheadSubTab}.${field}`, val);
            }
        };

        const handleUpAheadListAdd = (type, val) => {
            if (!val || !val.trim()) return;
            const item = val.trim();

            if (type === 'positiveKeywords') {
                // Get current effective list (could be defaults)
                const currentList = getEffectiveKeywords('positive');
                if (currentList.some(k => k.toLowerCase() === item.toLowerCase())) return;

                // Save explicitly as user setting
                updateNested(`upAhead.keywords.${upAheadSubTab}`, [...currentList, item]);

            } else if (type === 'negativeKeywords') {
                const currentList = getEffectiveKeywords('negative');
                if (currentList.some(k => k.toLowerCase() === item.toLowerCase())) return;

                updateNested(`upAhead.keywords.${upAheadSubTab}_negative`, [...currentList, item]);
            }
        };

        const handleUpAheadListRemove = (type, val) => {
            if (type === 'positiveKeywords') {
                const currentList = getEffectiveKeywords('positive');
                const newList = currentList.filter(k => k !== val);
                // If newList is empty, it will revert to defaults on next render due to service logic.
                // To allow clearing, we'd need a special marker or logic change.
                // For now, saving empty list triggers default behavior, which is acceptable "Reset to Default" behavior implicitly.
                updateNested(`upAhead.keywords.${upAheadSubTab}`, newList);

            } else if (type === 'negativeKeywords') {
                // Handle negative removal (check local first)
                const localList = getEffectiveKeywords('negative');
                if (localList.includes(val)) {
                    const newList = localList.filter(k => k !== val);
                    updateNested(`upAhead.keywords.${upAheadSubTab}_negative`, newList);
                } else {
                    // Try removing from global list?
                    const globalList = getEffectiveGlobalNegatives();
                    if (globalList.includes(val)) {
                        if (window.confirm(`"${val}" is a global negative keyword. Remove it from ALL categories?`)) {
                             const newGlobal = globalList.filter(k => k !== val);
                             updateNested(`upAhead.keywords.negative`, newGlobal);
                        }
                    }
                }
            }
        };

        return (
            <div style={{ display: 'flex', height: '100%', gap: '10px' }}>
                <div style={{ width: '70px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setUpAheadSubTab(cat.id)}
                            style={{
                                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                                padding:'8px 4px', border:'none', background: upAheadSubTab === cat.id ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                color: upAheadSubTab === cat.id ? '#fff' : 'var(--text-secondary)',
                                borderRadius:'8px', cursor:'pointer', fontSize:'0.7rem', fontWeight:500
                            }}
                        >
                            <span style={{fontSize:'1.3rem', marginBottom:'2px'}}>{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <SectionTitle icon="🌍" title="Global Config" />
                    <SettingCard>
                        <div className="settings-item__label" style={{marginBottom:'5px'}}>Locations</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom:'15px' }}>
                            {['Chennai', 'Muscat', 'Trichy'].map(loc => (
                                <label key={loc} className={`chip-checkbox ${settings.upAhead?.locations?.includes(loc) ? 'active' : ''}`}>
                                    <input
                                        type="checkbox" style={{ display: 'none' }}
                                        checked={settings.upAhead?.locations?.includes(loc) || false}
                                        onChange={(e) => {
                                            const current = settings.upAhead?.locations || [];
                                            const next = e.target.checked ? [...current, loc] : current.filter(l => l !== loc);
                                            updateNested('upAhead.locations', next);
                                        }}
                                    />
                                    {loc}
                                </label>
                            ))}
                        </div>
                    </SettingCard>

                    <SettingCard>
                        <KeywordInput
                            label="Weather Alert Ambiguous Keywords"
                            placeholder="e.g. watch"
                            value={localInputs.ua_weather_ambiguous || ''}
                            onChange={(val) => handleLocalInput('ua_weather_ambiguous', val)}
                            onAdd={() => {
                                addToList('upAhead.weatherAlertRules.ambiguousKeywords', localInputs.ua_weather_ambiguous);
                                handleLocalInput('ua_weather_ambiguous', '');
                            }}
                            items={effectiveAmbiguousKeywords}
                            onRemove={(item) => removeFromList('upAhead.weatherAlertRules.ambiguousKeywords', item)}
                        />

                        <KeywordInput
                            label="Weather Alert Context Keywords"
                            placeholder="e.g. cyclone"
                            value={localInputs.ua_weather_context || ''}
                            onChange={(val) => handleLocalInput('ua_weather_context', val)}
                            onAdd={() => {
                                addToList('upAhead.weatherAlertRules.contextKeywords', localInputs.ua_weather_context);
                                handleLocalInput('ua_weather_context', '');
                            }}
                            items={effectiveContextKeywords}
                            onRemove={(item) => removeFromList('upAhead.weatherAlertRules.contextKeywords', item)}
                        />

                        <KeywordInput
                            label="Weather Banner Validation Keywords"
                            placeholder="e.g. flood"
                            value={localInputs.ua_weather_banner || ''}
                            onChange={(val) => handleLocalInput('ua_weather_banner', val)}
                            onAdd={() => {
                                addToList('upAhead.weatherAlertRules.bannerKeywords', localInputs.ua_weather_banner);
                                handleLocalInput('ua_weather_banner', '');
                            }}
                            items={effectiveBannerKeywords}
                            onRemove={(item) => removeFromList('upAhead.weatherAlertRules.bannerKeywords', item)}
                        />

                        <SettingItem
                            label="Weather Alert Minimum Matches"
                            subLabel={`${effectiveWeatherMinimumMatches} keyword match${effectiveWeatherMinimumMatches === 1 ? '' : 'es'}`}
                        >
                            <input
                                type="range"
                                min="1"
                                max="4"
                                step="1"
                                value={effectiveWeatherMinimumMatches}
                                onChange={(e) => updateNested('upAhead.weatherAlertRules.minimumMatches', parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </SettingItem>

                        <SettingItem
                            label="Weather Alert Freshness"
                            subLabel={`${settings.upAhead?.weatherAlertRules?.staleMaxAgeHours ?? DEFAULT_SETTINGS.upAhead.weatherAlertRules.staleMaxAgeHours} hours`}
                        >
                            <input
                                type="range"
                                min="1"
                                max="48"
                                step="1"
                                value={settings.upAhead?.weatherAlertRules?.staleMaxAgeHours ?? DEFAULT_SETTINGS.upAhead.weatherAlertRules.staleMaxAgeHours}
                                onChange={(e) => updateNested('upAhead.weatherAlertRules.staleMaxAgeHours', parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </SettingItem>
                    </SettingCard>

                    <SettingCard>
                        <KeywordInput
                            label="Offer Signal Keywords"
                            placeholder="e.g. fare sale"
                            value={localInputs.ua_offer_signal || ''}
                            onChange={(val) => handleLocalInput('ua_offer_signal', val)}
                            onAdd={() => {
                                addToList('upAhead.offerRules.offerKeywords', localInputs.ua_offer_signal);
                                handleLocalInput('ua_offer_signal', '');
                            }}
                            items={effectiveOfferKeywords}
                            onRemove={(item) => removeFromList('upAhead.offerRules.offerKeywords', item)}
                        />

                        <SettingItem
                            label="Offer Minimum Matches"
                            subLabel={`${effectiveOfferMinimumMatches} keyword match${effectiveOfferMinimumMatches === 1 ? '' : 'es'}`}
                        >
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="1"
                                value={effectiveOfferMinimumMatches}
                                onChange={(e) => updateNested('upAhead.offerRules.minimumMatches', parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </SettingItem>
                    </SettingCard>

                    <GenericRankingConfig
                        title={categories.find(c => c.id === upAheadSubTab).label}
                        icon={categories.find(c => c.id === upAheadSubTab).icon}
                        configData={synthesizedConfig}
                        // Pass custom handlers
                        customUpdate={handleUpAheadUpdate}
                        customAdd={handleUpAheadListAdd}
                        customRemove={handleUpAheadListRemove}
                        localInputs={localInputs}
                        handleLocalInput={handleLocalInput}
                        subTab={`ua_${upAheadSubTab}`}
                    />
                </div>
            </div>
        );
    };

    const runtime = getRuntimeCapabilities();

    return (
        <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            {runtime.isStaticHost && (
                <div style={{ padding: '0 15px' }}>
                    <EmptyState
                        title="Running in Static Host Mode"
                        message="The application is currently running in a limited environment (e.g., GitHub Pages). Some background syncs and live fetching features might be restricted."
                        hint="Data will be loaded from snapshots where available."
                    />
                </div>
            )}

            {/* Top Level Nav */}
            <div style={{display:'flex', gap:'10px', marginBottom:'15px', padding:'15px 15px 0 15px', flexShrink:0}}>
                <button className={`btn ${topLevelTab === 'main' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTopLevelTab('main')} style={{flex:1}}>
                    ⚙️ Main
                </button>
                <button className={`btn ${topLevelTab === 'buzz' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTopLevelTab('buzz')} style={{flex:1}}>
                    ⚡ Buzz
                </button>
                <button className={`btn ${topLevelTab === 'upahead' ? 'btn--primary' : 'btn--secondary'}`} onClick={() => setTopLevelTab('upahead')} style={{flex:1}}>
                    🗓️ Up Ahead
                </button>
            </div>

            {/* Content Area */}
            <div className="settings-tab-content" style={{flex:1, overflowY:'auto', overflowX:'hidden', padding:'0 15px 15px 15px'}}>
                {topLevelTab === 'main' && renderMainContent()}
                {topLevelTab === 'buzz' && renderBuzzContent()}
                {topLevelTab === 'upahead' && renderUpAheadContent()}
            </div>
        </div>
    );
};

// --- GENERIC RANKING CONFIGURATOR (Reusable for Buzz & UpAhead) ---
const GenericRankingConfig = ({
    title, icon, configPath, configData,
    updateNested, addToList, removeFromList,
    localInputs, handleLocalInput, subTab,
    customUpdate, customAdd, customRemove
}) => {

    // Handlers: prefer custom if provided (for UpAhead), else standard (for Buzz)
    const onUpdate = (field, val) => {
        if (customUpdate) customUpdate(field, val);
        else updateNested(`${configPath}.${field}`, val);
    };

    const onAdd = (type, val) => {
        if (customAdd) customAdd(type, val);
        else addToList(`${configPath}.${type}`, val);
    };

    const onRemove = (type, val) => {
        if (customRemove) customRemove(type, val);
        else removeFromList(`${configPath}.${type}`, val);
    };

    return (
        <div>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                <SectionTitle icon={icon} title={title} />
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <span style={{fontSize:'0.8rem', color:'var(--text-muted)'}}>{configData.enabled !== false ? 'Active' : 'Disabled'}</span>
                    <Toggle checked={configData.enabled !== false} onChange={(val) => onUpdate('enabled', val)} />
                </div>
            </div>

            <SettingCard>
                <div style={{fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:'15px'}}>
                    <strong>Ranking Formula:</strong> (Positive Matches × Multiplier) — (Negative Matches × Multiplier)
                </div>

                {/* POSITIVE BLOCK */}
                <div style={{background: 'rgba(76, 175, 80, 0.1)', border:'1px solid rgba(76, 175, 80, 0.3)', borderRadius:'8px', padding:'15px', marginBottom:'20px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <div style={{fontWeight:600, color:'#81c784'}}>✅ Positive Boost</div>
                        <div style={{display:'flex', alignItems:'center', gap:'10px', background:'rgba(0,0,0,0.3)', padding:'4px 8px', borderRadius:'6px'}}>
                            <span style={{fontSize:'0.75rem', color:'#fff'}}>Multi: <strong>{configData.positiveMultiplier || 1}x</strong></span>
                            <input
                                type="range" min="0" max="5" step="0.1"
                                value={configData.positiveMultiplier || 1}
                                onChange={(e) => onUpdate('positiveMultiplier', parseFloat(e.target.value))}
                                style={{width:'80px'}}
                            />
                        </div>
                    </div>
                    <KeywordInput
                        label=""
                        placeholder="Add positive keyword..."
                        value={localInputs[`${subTab}_pos`] || ''}
                        onChange={(val) => handleLocalInput(`${subTab}_pos`, val)}
                        onAdd={() => {
                            onAdd('positiveKeywords', localInputs[`${subTab}_pos`]);
                            handleLocalInput(`${subTab}_pos`, '');
                        }}
                        items={configData.positiveKeywords || []}
                        onRemove={(w) => onRemove('positiveKeywords', w)}
                    />
                </div>

                {/* NEGATIVE BLOCK */}
                <div style={{background: 'rgba(244, 67, 54, 0.1)', border:'1px solid rgba(244, 67, 54, 0.3)', borderRadius:'8px', padding:'15px', marginBottom:'20px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                        <div style={{fontWeight:600, color:'#e57373'}}>🚫 Negative Penalty</div>
                        <div style={{display:'flex', alignItems:'center', gap:'10px', background:'rgba(0,0,0,0.3)', padding:'4px 8px', borderRadius:'6px'}}>
                            <span style={{fontSize:'0.75rem', color:'#fff'}}>Multi: <strong>{configData.negativeMultiplier || 1}x</strong></span>
                            <input
                                type="range" min="0" max="5" step="0.1"
                                value={configData.negativeMultiplier || 1}
                                onChange={(e) => onUpdate('negativeMultiplier', parseFloat(e.target.value))}
                                style={{width:'80px'}}
                            />
                        </div>
                    </div>
                    <KeywordInput
                        label=""
                        placeholder="Add negative keyword..."
                        value={localInputs[`${subTab}_neg`] || ''}
                        onChange={(val) => handleLocalInput(`${subTab}_neg`, val)}
                        onAdd={() => {
                            onAdd('negativeKeywords', localInputs[`${subTab}_neg`]);
                            handleLocalInput(`${subTab}_neg`, '');
                        }}
                        items={configData.negativeKeywords || []}
                        onRemove={(w) => onRemove('negativeKeywords', w)}
                    />
                </div>

                {/* FILTER THRESHOLD */}
                <SettingItem label="🛡️ Filter Threshold" subLabel={`Hide if Score < ${configData.filterThreshold || 0}`}>
                    <input
                        type="range" min="-5" max="5" step="1"
                        value={configData.filterThreshold || 0}
                        onChange={(e) => onUpdate('filterThreshold', parseInt(e.target.value))}
                        style={{width:'100%'}}
                    />
                </SettingItem>
            </SettingCard>
        </div>
    );
};

const SectionTitle = ({ icon, title }) => <div className="section-title"><span>{icon}</span> {title}</div>;
const SettingCard = ({ children }) => <div className="modern-card" style={{padding: '16px', marginBottom: '20px', gap: '0'}}>{children}</div>;
const SettingItem = ({ label, subLabel, children }) => (
    <div className="settings-item">
        <div className="settings-item__label"><span>{label}</span>{subLabel && <small>{subLabel}</small>}</div>
        <div style={{ flex: '0 0 auto', marginLeft: '10px' }}>{children}</div>
    </div>
);
const KeywordInput = ({ label, placeholder, value, onChange, onAdd, items, onRemove }) => (
    <div style={{ marginBottom: '15px' }}>
        <div className="settings-item__label" style={{ marginBottom: '6px' }}>{label}</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="settings-input" onKeyDown={(e) => e.key === 'Enter' && onAdd()} />
            <button className="btn btn--secondary" onClick={onAdd} style={{padding:'0 15px'}}>Add</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {items.map((item, i) => (
                <span key={i} className="keyword-chip">{item}<button onClick={() => onRemove(item)}>×</button></span>
            ))}
            {items.length === 0 && <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>Default keywords only</span>}
        </div>
    </div>
);

export default SettingsPage;
