import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Header, { DataStatePill } from '../components/Header';
import { ImageCard } from '../components/ImageCard';
import { useWatchlist } from '../hooks/useWatchlist';
import { downloadCalendarEvent } from '../utils/calendar';
import {
    fetchStaticUpAheadData,
    fetchLiveUpAheadData,
    mergeUpAheadData,
    loadFromCache,
    saveToCache,
    clearUpAheadCache,
    isActualWeatherAlertText,
    isActualOfferText
} from '../services/upAheadService';
import plannerStorage from '../utils/plannerStorage';
import { useSettings } from '../context/SettingsContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { useLongPress } from '../hooks/useLongPress';
import ProgressBar from '../components/ProgressBar';
import { shortenSourceLabel } from '../utils/storyMeta';
import { getRuntimeCapabilities } from '../runtime/runtimeCapabilities';
import { getUpAheadEvidence } from '../services/upAheadEvidence';
import { getUpAheadBriefing } from '../services/upAheadBriefing';
import './UpAhead.css';

function normalizePlanDate(dateStr) {
    if (!dateStr) return new Date().toISOString().slice(0, 10);

    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString().slice(0, 10);
    }

    return dateStr;
}

function hasVisibleUpAheadContent(data) {
    if (!data) return false;
    if (Array.isArray(data.timeline) && data.timeline.some(day => (day?.items || []).length > 0)) return true;
    if (data.sections && Object.values(data.sections).some(items => Array.isArray(items) && items.length > 0)) return true;
    if (Array.isArray(data.weekly_plan) && data.weekly_plan.some(day => (day?.items || []).length > 0)) return true;
    return false;
}



function formatConciseDate(dateStr) {
    if (!dateStr) return 'Coming Soon';

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;

    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate().toString().padStart(2, '0');
    const month = d.toLocaleDateString('en-US', { month: 'short' });

    return `${dayName}, ${dayNum} ${month}`;
}

function UpAheadEvidencePanel({ evidence }) {
    if (!evidence) return null;

    return (
        <section className={`ua-evidence ua-evidence--${evidence.status}`} data-upahead-evidence="coverage-quality">
            <div className="ua-evidence__header">
                <div>
                    <div className="ua-evidence__eyebrow">Coverage evidence</div>
                    <h2>{evidence.title}</h2>
                    <p>
                        Source mode {evidence.sourceModeLabel} · {evidence.locationCount} location(s) · {evidence.coveredCategories.length}/{evidence.enabledCategories.length} categories covered.
                    </p>
                </div>
                <div className="ua-evidence__score">
                    <span>Score</span>
                    <strong>{evidence.qualityScore}</strong>
                </div>
            </div>

            <div className="ua-evidence__grid">
                <div className="ua-evidence__tile">
                    <span>Source</span>
                    <strong>{evidence.sourceModeLabel}</strong>
                </div>
                <div className="ua-evidence__tile">
                    <span>Locations</span>
                    <strong>{evidence.locationCount}</strong>
                </div>
                <div className="ua-evidence__tile">
                    <span>Timeline</span>
                    <strong>{evidence.timelineStats.itemCount}</strong>
                </div>
                <div className="ua-evidence__tile">
                    <span>Plan</span>
                    <strong>{evidence.weeklyPlanStats.itemCount}</strong>
                </div>
                <div className="ua-evidence__tile">
                    <span>Alerts</span>
                    <strong>{evidence.visibleAlertCount}</strong>
                </div>
                <div className="ua-evidence__tile">
                    <span>Offers</span>
                    <strong>{evidence.visibleOfferCount}</strong>
                </div>
            </div>

            <div className="ua-evidence__chips">
                {evidence.locations.map(location => (
                    <span key={location}>{location}</span>
                ))}
                {evidence.coveredCategories.slice(0, 8).map(category => (
                    <span key={category}>{category}</span>
                ))}
            </div>

            <details className="ua-evidence__details">
                <summary>Evidence notes</summary>
                <ul>
                    {evidence.notes.map((note, index) => (
                        <li key={`ua-evidence-note-${index}`}>{note}</li>
                    ))}
                </ul>
            </details>
        </section>
    );
}

function UpAheadBriefingPanel({ briefing }) {
    if (!briefing) return null;

    const primaryBuckets = briefing.buckets.filter(bucket => bucket.count > 0).slice(0, 5);

    return (
        <section className={`ua-briefing ua-briefing--${briefing.status}`} data-upahead-briefing="professional-horizon">
            <div className="ua-briefing__header">
                <div>
                    <div className="ua-briefing__eyebrow">Horizon briefing</div>
                    <h2>{briefing.title}</h2>
                    <p>
                        {briefing.locationLabel} · {briefing.next72hCount} item(s) in the next 72h · {briefing.plannerReadyCount} planner-ready item(s).
                    </p>
                </div>
            </div>

            <div className="ua-briefing__stats">
                <div><span>Alerts</span><strong>{briefing.alertCount}</strong></div>
                <div><span>Today</span><strong>{briefing.todayCount}</strong></div>
                <div><span>Next 72h</span><strong>{briefing.next72hCount}</strong></div>
                <div><span>Events</span><strong>{briefing.eventCount}</strong></div>
                <div><span>Offers</span><strong>{briefing.offerCount}</strong></div>
                <div><span>Releases</span><strong>{briefing.movieCount}</strong></div>
            </div>

            {briefing.highlights.length > 0 && (
                <div className="ua-briefing__highlights">
                    {briefing.highlights.map(item => (
                        <article key={item.id} className="ua-briefing__highlight">
                            <span>{item.type}</span>
                            <strong>{item.title}</strong>
                            {item.date && <em>{formatConciseDate(item.date)}</em>}
                        </article>
                    ))}
                </div>
            )}

            <div className="ua-briefing__buckets">
                {primaryBuckets.map(bucket => (
                    <div key={bucket.key} className="ua-briefing__bucket">
                        <div className="ua-briefing__bucket-head">
                            <strong>{bucket.label}</strong>
                            <span>{bucket.count}</span>
                        </div>
                        <ul>
                            {bucket.items.slice(0, 3).map(item => (
                                <li key={item.id}>
                                    <span>{item.title}</span>
                                    {item.date && <em>{formatConciseDate(item.date)}</em>}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            <details className="ua-briefing__details">
                <summary>Briefing notes</summary>
                <ul>
                    {briefing.notes.map((note, index) => (
                        <li key={`ua-briefing-note-${index}`}>{note}</li>
                    ))}
                </ul>
            </details>
        </section>
    );
}

function UpAheadPage() {
    const { settings, updateSettings } = useSettings();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState(0);
    const [view, setView] = useState('plan');
    const [, setBlacklist] = useState(plannerStorage.getBlacklist ? plannerStorage.getBlacklist() : new Set());
    const { toggleWatchlist, isWatched } = useWatchlist();

    const { pullDistance } = usePullToRefresh(() => {
        return loadData({ forceRefresh: true, liveOnly: true });
    });

    const buildCardArticle = (item) => ({
        ...item,
        time: formatConciseDate(item.date || item.releaseDate),
        summary: item.description || item.summary || '',
        source: item.source || item.platform || item.category || 'Up Ahead'
    });

    const loadData = useCallback(async ({ forceRefresh = false, liveOnly = false } = {}) => {
        const { isStaticHost } = getRuntimeCapabilities();

        if (!isStaticHost) {
            await plannerStorage.loadBlacklistFromApi?.();
            await plannerStorage.loadPlanFromApi?.();
        }

        if (forceRefresh) {
            if (liveOnly) {
                clearUpAheadCache();
                setData(null);
                setLoading(true);
                setLoadingPhase(0);
            }
            setIsRefreshing(true);
            setLoadingPhase(1);
        } else {
            setLoading(true);
            setLoadingPhase(0);
        }

        if (!forceRefresh && !liveOnly) {
            const cached = loadFromCache(settings.upAhead);
            if (cached) {
                setData(cached);
                setLoading(false);
                setLoadingPhase(1);
            }
        }

        if (!liveOnly) {
            try {
                const staticData = await fetchStaticUpAheadData(settings.upAhead);
                if (staticData) {
                    setData(prev => {
                        const merged = mergeUpAheadData(prev, staticData, settings.upAhead);
                        saveToCache(merged, settings.upAhead);
                        return merged;
                    });
                    if (!forceRefresh) setLoadingPhase(2);
                    setLoading(false);
                }
            } catch (e) {
                console.warn('Static fetch failed', e);
            }
        }

        setIsRefreshing(true);
        try {
            const upAheadSettings = settings.upAhead || {
                categories: { movies: true, events: true, festivals: true, alerts: true, sports: true, shopping: true, civic: true, weather_alerts: true, airlines: true },
                locations: ['Chennai']
            };

            const liveData = await fetchLiveUpAheadData(upAheadSettings);

            setData(prev => {
                const merged = mergeUpAheadData(liveOnly ? null : prev, liveData, settings.upAhead);
                saveToCache(merged, settings.upAhead);
                return merged;
            });
            setLoadingPhase(3);
        } catch (err) {
            console.error('Failed to load Live Up Ahead data', err);
        } finally {
            setIsRefreshing(false);
            setLoading(false);
        }
    }, [settings.upAhead]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleRemoveFromPlan = (item) => {
        const id = item?.hiddenKey || item?.canonicalId || item?.id;
        if (!id) return;
        if (plannerStorage.addToBlacklist) {
            plannerStorage.addToBlacklist(id);
            setBlacklist(plannerStorage.getBlacklist());
            loadData();
        }
    };

    const handleAddToPlan = (item, dateStr) => {
        const hiddenKey = item.hiddenKey || item.canonicalId || item.id;
        const normalizedDate = item.planDate || normalizePlanDate(dateStr);

        plannerStorage.addItem(normalizedDate, {
            id: hiddenKey || item.id,
            hiddenKey,
            title: item.title,
            category: item.tags?.[0] || 'event',
            type: item.type || item.tags?.[0] || 'event',
            link: item.link,
            description: item.description,
            icon: item.icon,
            planDate: normalizedDate,
            eventDateKey: normalizedDate,
            eventDate: normalizedDate
        });
        loadData();
        alert('Added to Plan!');
    };

    const GridSection = ({ items, colorClass, emptyMessage, isOffer = false }) => {
        if (!items || items.length === 0) return <div className="modern-card empty-state" style={{borderStyle: 'dashed', padding: '40px'}}><p style={{color: 'var(--text-secondary)'}}>{emptyMessage}</p></div>;
        return (
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {items.map((item, i) => (
                    <div key={i} className="modern-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className={`ua-badge ${colorClass}`}>{formatConciseDate(item.date || item.releaseDate)}</div>
                            {isOffer && <span style={{ fontSize: '1.2rem' }}>🏷️</span>}
                        </div>
                        <h3 className="modern-card__title" style={{ marginTop: '8px' }}>{item.title}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '8px 0', flex: 1 }}>
                            {item.description || 'No description available.'}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                             <a href={item.link} target="_blank" rel="noopener noreferrer" className="ua-source-link">Details ↗</a>
                             <button className="ua-cal-btn" onClick={(e) => {
                                 handleAddToPlan(item, item.date || item.releaseDate);
                                 e.target.innerHTML = '✅ Saved';
                                 e.target.style.backgroundColor = 'var(--accent-primary)';
                                 e.target.style.color = 'white';
                                 setTimeout(() => {
                                     e.target.innerHTML = '+ Plan';
                                     e.target.style.backgroundColor = '';
                                     e.target.style.color = '';
                                 }, 2000);
                             }}>+ Plan</button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderEntertainmentStyleGrid = (items, emptyMessage) => {
        if (!items || items.length === 0) {
            return <div className="modern-card empty-state" style={{borderStyle: 'dashed', padding: '40px'}}><p style={{color: 'var(--text-secondary)'}}>{emptyMessage}</p></div>;
        }

        return (
            <div className="masonry-grid">
                {items.map((item, idx) => (
                    <ImageCard
                        key={item.id || idx}
                        article={buildCardArticle(item)}
                        href={item.link}
                        badge={shortenSourceLabel(item.source || item.platform || 'Up Ahead')}
                        size="medium"
                    />
                ))}
            </div>
        );
    };

    if (loading && !data) {
        return (
            <div className="page-container">
                <Header title="Up Ahead" icon="🗓️" loadingPhase={loadingPhase} />
                <div className="loading">
                    <div className="loading__spinner"></div>
                    <p>Scanning horizon...</p>
                </div>
            </div>
        );
    }

    if (!hasVisibleUpAheadContent(data)) {
         return (
            <div className="page-container">
                <Header title="Up Ahead" icon="🗓️" loadingPhase={loadingPhase} />
                <div className="modern-card empty-state" style={{borderStyle: 'dashed', margin: '20px auto', maxWidth: '600px'}}>
                    <span style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}>🔭</span>
                    <h3 style={{marginBottom: '8px', color: 'var(--text-primary)'}}>Nothing on the radar</h3>
                    <p style={{color: 'var(--text-secondary)'}}>No upcoming events found.</p>
                    <button onClick={() => loadData({ forceRefresh: true, liveOnly: true })} className="btn btn--primary" style={{ marginTop: '24px' }}>Force Refresh</button>
                    <div style={{ marginTop: '12px' }}><small style={{color: 'var(--text-muted)'}}>Try adding more locations or categories in <Link to="/settings" style={{ color: 'var(--accent-primary)' }}>Settings</Link>.</small></div>
                </div>
            </div>
        );
    }

    const weatherAlerts = (data.sections?.weather_alerts || []).filter(item =>
        isActualWeatherAlertText(`${item?.title || ''} ${item?.description || ''}`, settings.upAhead)
    );
    const generalAlerts = data.sections?.alerts || [];
    const civicAlerts = data.sections?.civic || [];
    const combinedAlerts = [...weatherAlerts, ...generalAlerts, ...civicAlerts];

    const highPriorityAlert = weatherAlerts[0] || generalAlerts[0] || null;
    const alertIcon = weatherAlerts.length > 0 ? '🌪️' : '⚠️';
    const alertTitle = weatherAlerts.length > 0 ? 'Weather Warning' : 'Worth Knowing';
    const offerItems = [...(data.sections?.shopping || []), ...(data.sections?.airlines || [])].filter(item =>
        isActualOfferText(`${item?.title || ''} ${item?.description || ''}`, settings.upAhead)
    );
    const movieCards = (data.sections?.movies || []).map(buildCardArticle);
    const festivalCards = (data.sections?.festivals || []).map(buildCardArticle);

    const upAheadEvidence = getUpAheadEvidence({
        data,
        settings,
        visible: {
            weatherAlerts,
            combinedAlerts,
            offerItems,
            movieCards,
            festivalCards
        }
    });

    const upAheadBriefing = getUpAheadBriefing({
        data,
        settings,
        visible: {
            weatherAlerts,
            combinedAlerts,
            offerItems,
            movieCards,
            festivalCards
        }
    });

    const { isStaticHost } = getRuntimeCapabilities();
    const modeStr = isStaticHost ? (data?.sourceMode === 'snapshot' ? 'snapshot' : 'degraded') : (data?.sourceMode === 'cache' ? 'cached' : 'live');
    const modeLabel = isStaticHost ? (data?.sourceMode === 'snapshot' ? 'Snapshot' : 'Limited') : (data?.sourceMode === 'cache' ? 'Cached' : 'Live');

    const rightElementUI = (
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            {isRefreshing && <div className="scanning-indicator" style={{fontSize:'0.7rem', color:'var(--accent-primary)'}}>Scanning...</div>}
            {data && <DataStatePill mode={modeStr} label={modeLabel} />}
        </div>
    );

    return (
        <div className="page-container up-ahead-page">
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
                {pullDistance > 40 ? 'Release to refresh' : 'Pull to refresh'}
            </div>
            <Header
                title="Up Ahead"
                icon="🗓️"
                loadingPhase={loadingPhase}
                actions={rightElementUI}
            />

            <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', padding: '6px', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                {isRefreshing ? (
                    <>
                        <div className="loading__spinner" style={{width:'12px', height:'12px', borderWidth:'2px'}}></div>
                        <span>Scanning horizon...</span>
                    </>
                ) : (
                    <>
                        <span>Live Feed • {settings.upAhead?.locations?.join(', ') || 'All Locations'}</span>
                        <button onClick={() => loadData({ forceRefresh: true })} style={{background:'none', border:'none', cursor:'pointer', fontSize:'0.8rem'}} title="Refresh using cached and static data first">🔄</button>
                        <button onClick={() => loadData({ forceRefresh: true, liveOnly: true })} className="btn btn--secondary" style={{ padding: '4px 8px', fontSize: '0.7rem' }} title="Clear stale Up Ahead cache and reload from live feeds only">Force Refresh</button>
                    </>
                )}
            </div>

            <UpAheadEvidencePanel evidence={upAheadEvidence} />
            <UpAheadBriefingPanel briefing={upAheadBriefing} />

            {highPriorityAlert && (
                <div className={`ua-alert-banner ${weatherAlerts.length > 0 ? 'weather-alert' : ''}`}>
                    <span className="ua-alert-icon">{alertIcon}</span>
                    <div className="ua-alert-content">
                        <h4>{alertTitle}</h4>
                        <p>{highPriorityAlert.text || highPriorityAlert.description || highPriorityAlert.title || 'Alert details unavailable.'}</p>
                    </div>
                </div>
            )}

            <main className="main-content">
                <div className="ua-view-toggle scrollable-tabs">
                    <button className={`ua-toggle-btn ${view === 'plan' ? 'active' : ''}`} onClick={() => setView('plan')}>Suggested</button>
                    <button className={`ua-toggle-btn ${view === 'offers' ? 'active' : ''}`} onClick={() => setView('offers')}>Offers</button>
                    <button className={`ua-toggle-btn ${view === 'movies' ? 'active' : ''}`} onClick={() => setView('movies')}>Releasing Soon</button>
                    <button className={`ua-toggle-btn ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>Upcoming Events</button>
                    <button className={`ua-toggle-btn ${view === 'alerts' ? 'active' : ''}`} onClick={() => setView('alerts')}>Alerts</button>
                    <button className={`ua-toggle-btn ${view === 'festivals' ? 'active' : ''}`} onClick={() => setView('festivals')}>Festivals</button>
                    <button className={`ua-toggle-btn ${view === 'feed' ? 'active' : ''}`} onClick={() => setView('feed')}>Timeline</button>
                    {import.meta.env.DEV && (
                      <button onClick={async () => {
                        const { runPlannerBenchmark } = await import('../benchmarks/runPlannerBenchmark.js');
                        const results = await runPlannerBenchmark();
                        alert(`Planner Benchmark: ${results.summary}`);
                      }} style={{fontSize:'0.7rem', padding:'4px 8px', marginLeft:'8px'}}>
                        🧪 Benchmark
                      </button>
                    )}
                </div>

                {view === 'plan' && (
                    <div className="ua-weekly-plan">
                         <ProgressBar active={loading || isRefreshing} style={{ marginBottom: '10px', borderRadius: '4px' }} />
                         {(data.weekly_plan && Array.isArray(data.weekly_plan)) ? data.weekly_plan.map((dayData, dIdx) => (
                             <div key={dIdx} className="modern-card" style={{ marginBottom: '16px' }}>
                                 <div className="modern-card__header" style={{ paddingBottom: '0', borderBottom: 'none' }}>
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="ua-plan-ribbon" style={{ borderRadius: '8px' }}>
                                            <div style={{fontSize: '0.95rem', fontWeight: 800, whiteSpace: 'nowrap'}}>
                                                {dayData.day}
                                            </div>
                                        </div>
                                        <span style={{opacity: 0.8, fontWeight: 500, color: 'var(--text-muted)'}}>{dayData.date}</span>
                                     </div>
                                 </div>
                                 <div className="ua-plan-day-content" style={{ border: 'none', padding: '8px 0 0 0', background: 'transparent' }}>
                                     {dayData.items && dayData.items.length > 0 ? (
                                         dayData.items.map((item, idx) => (
                                             <div key={idx} className="ua-plan-event-item" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                                  <button className="ua-plan-delete-btn" onClick={(e) => { e.preventDefault(); handleRemoveFromPlan(item); }} aria-label="Remove event" style={{background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'0.9rem', padding: '0 8px 0 0'}}>✕</button>
                                                 <a href={item.link} target="_blank" draggable="false" rel="noopener noreferrer" style={{flex:1, display:'flex', alignItems:'center', gap:'10px', textDecoration:'none', color:'inherit'}}>
                                                     <span className="ua-event-icon">{item.icon}</span>
                                                     <div style={{display:'flex', flexDirection:'column'}}>
                                                         <span className="ua-event-title">{item.title}</span>
                                                         {item.isOffer && <span className="ua-offer-badge">🛒 Ends Today</span>}
                                                     </div>
                                                 </a>
                                                 <div style={{display:'flex', gap:'8px'}}>
                                                     <button className="ua-plan-action-btn" onClick={(e) => { e.preventDefault(); downloadCalendarEvent(item.title, item.description || item.title); }} title="Add to Calendar" style={{background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem'}}>📅</button>
                                                 </div>
                                             </div>
                                         ))
                                     ) : <span className="ua-plan-empty" style={{padding: '10px', color: 'var(--text-muted)', fontSize: '0.9rem'}}>-</span>}
                                 </div>
                             </div>
                         )) : <div style={{textAlign:'center', padding:'20px'}}>Data unavailable.</div>}
                    </div>
                )}

                {view === 'movies' && <div className="ua-tab-view"><ProgressBar active={loading || isRefreshing} />{renderEntertainmentStyleGrid(movieCards, 'No upcoming movie releases found.')}</div>}
                {view === 'offers' && <div className="ua-tab-view"><ProgressBar active={loading || isRefreshing} /><GridSection items={offerItems} colorClass="type-shopping" emptyMessage="No offers found." isOffer={true} /></div>}
                {view === 'events' && <div className="ua-tab-view"><ProgressBar active={loading || isRefreshing} /><GridSection items={[...(data.sections?.events || []), ...(data.sections?.sports || [])]} colorClass="type-event" emptyMessage="No upcoming events found." /></div>}
                {view === 'alerts' && <div className="ua-tab-view"><ProgressBar active={loading || isRefreshing} /><GridSection items={combinedAlerts} colorClass="type-alert" emptyMessage="No alerts found." /></div>}
                {view === 'festivals' && (
                  <div className="ua-tab-view">
                    <ProgressBar active={loading || isRefreshing} />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center', padding: '8px' }}>
                      {(settings?.upAhead?.locations || ['Chennai', 'Muscat']).map(loc => (
                        <span key={loc} className="ua-badge type-festival" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {loc}
                          <span
                            title={`Remove ${loc}`}
                            style={{ opacity: 0.7, cursor: 'pointer', fontSize: '0.75rem' }}
                            onClick={() => {
                              const current = settings?.upAhead?.locations || ['Chennai', 'Muscat'];
                              const next = current.filter(l => l !== loc);
                              if (next.length > 0 && typeof updateSettings === 'function') {
                                updateSettings({ ...settings, upAhead: { ...settings.upAhead, locations: next } });
                              }
                            }}
                          >✕</span>
                        </span>
                      ))}
                      <button className="btn btn--secondary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => {
                          const loc = window.prompt('Add location (e.g. Trichy, Dubai):');
                          if (!loc?.trim()) return;
                          const current = settings?.upAhead?.locations || ['Chennai', 'Muscat'];
                          if (!current.includes(loc.trim())) {
                            const next = [...current, loc.trim()];
                            if (typeof updateSettings === 'function') {
                              updateSettings({ ...settings, upAhead: { ...settings.upAhead, locations: next } });
                            }
                          }
                        }}>+ Add</button>
                      <button className="btn btn--primary"
                        style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                        onClick={() => typeof loadData === 'function' && loadData({ forceRefresh: true })}>
                        🔄 Fetch Festivals
                      </button>
                    </div>
                    {renderEntertainmentStyleGrid(festivalCards, 'No festivals found. Tap "Fetch Festivals" to load.')}
                  </div>
                )}

                {view === 'feed' && (
                    <div className="ua-timeline">
                        {(data.timeline || []).map((day) => (
                            <div key={day.date} className="ua-day-section timeline-track">
                                <div className="ua-day-header">
                                    <div className="ua-day-label">{day.dayLabel}</div>
                                    <div className="ua-date-sub">{day.date}</div>
                                </div>
                                {day.items?.map(item => {
                                    const TimelineCardInternal = ({ item, dayDate }) => {
                                        const [actionSheetItem, setActionSheetItem] = useState(null);

                                        const handleLongPress = () => {
                                            setActionSheetItem({ item, dateKey: dayDate });
                                        };
                                        const longPressHandlers = useLongPress(handleLongPress);

                                        const handleActionSheetClose = () => setActionSheetItem(null);

                                        return (
                                            <>
                                                <div key={item.id} className="timeline-card" style={{ marginBottom: '16px' }} {...longPressHandlers}>
                                                    <div className="ua-media-content" style={{ padding: 0 }}>
                                                        <div className="ua-media-header">
                                                            <span className={`ua-badge type-${item.type}`}>{item.type.toUpperCase()}</span>
                                                            <button className={`ua-watch-btn ${isWatched(item.id) ? 'active' : ''}`} onClick={() => toggleWatchlist(item.id)}>{isWatched(item.id) ? '★' : '☆'}</button>
                                                        </div>
                                                        <h3 className="ua-media-title">{item.title}</h3>
                                                        <p className="ua-media-desc">{item.description ? (item.description.length > 100 ? item.description.substring(0, 100) + '...' : item.description) : ''}</p>
                                                        <div className="ua-media-footer">
                                                            {item.link && <a href={item.link} target="_blank" rel="noopener noreferrer" className="ua-source-link">Read Source ↗</a>}
                                                            <button className="ua-cal-btn" onClick={(e) => { 
                                                                handleAddToPlan(item, dayDate);
                                                                e.target.innerHTML = '✅ Saved';
                                                                e.target.style.backgroundColor = 'var(--accent-primary)';
                                                                e.target.style.color = 'white';
                                                                setTimeout(() => {
                                                                    e.target.innerHTML = '📌 Plan';
                                                                    e.target.style.backgroundColor = '';
                                                                    e.target.style.color = '';
                                                                }, 2000);
                                                            }} title="Save to My Planner">📌 Plan</button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {actionSheetItem && (
                                                    <div style={{
                                                        position: 'fixed',
                                                        top: 0, left: 0, right: 0, bottom: 0,
                                                        backgroundColor: 'rgba(0,0,0,0.5)',
                                                        zIndex: 2000,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end'
                                                    }} onClick={handleActionSheetClose}>
                                                        <div style={{
                                                            backgroundColor: 'var(--bg-primary)',
                                                            borderTopLeftRadius: '16px',
                                                            borderTopRightRadius: '16px',
                                                            padding: '24px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '12px',
                                                            animation: 'slideUp 0.2s ease-out'
                                                        }} onClick={e => e.stopPropagation()}>
                                                            <h3 style={{ margin: '0 0 12px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                                                {actionSheetItem.item.title}
                                                            </h3>
                                                            {actionSheetItem.item.link && (
                                                                <button className="btn btn--secondary" style={{ textAlign: 'left', padding: '12px' }} onClick={() => {
                                                                    window.open(actionSheetItem.item.link, '_blank');
                                                                    handleActionSheetClose();
                                                                }}>
                                                                    🌐 Open Source
                                                                </button>
                                                            )}
                                                            <button className="btn btn--secondary" style={{ textAlign: 'left', padding: '12px' }} onClick={() => {
                                                                downloadCalendarEvent(actionSheetItem.item.title, actionSheetItem.item.description || actionSheetItem.item.title);
                                                                handleActionSheetClose();
                                                            }}>
                                                                📅 Add to Calendar
                                                            </button>
                                                            <button className="btn btn--secondary" style={{ textAlign: 'left', padding: '12px' }} onClick={() => {
                                                                if (navigator.share) {
                                                                    navigator.share({
                                                                        title: actionSheetItem.item.title,
                                                                        url: actionSheetItem.item.link || window.location.href
                                                                    }).catch(() => {});
                                                                }
                                                                handleActionSheetClose();
                                                            }}>
                                                                🔗 Share
                                                            </button>
                                                            <button className="btn btn--secondary" style={{ textAlign: 'left', padding: '12px' }} onClick={() => {
                                                                handleAddToPlan(actionSheetItem.item, actionSheetItem.dateKey);
                                                                handleActionSheetClose();
                                                                alert('Saved to Planner');
                                                            }}>
                                                                📌 Save to Planner
                                                            </button>
                                                            {(import.meta.env.DEV || localStorage.getItem('debugMode') === 'true') ? (
                                                                <button className="btn btn--secondary" style={{ textAlign: 'left', padding: '12px' }} onClick={() => {
                                                                    alert(JSON.stringify({
                                                                        id: actionSheetItem.item.id,
                                                                        canonicalId: actionSheetItem.item.canonicalId,
                                                                        decisionTrace: actionSheetItem.item.decisionTrace,
                                                                        classificationBreakdown: actionSheetItem.item.classificationBreakdown
                                                                    }, null, 2));
                                                                }}>
                                                                    🐛 Debug Details
                                                                </button>
                                                            ) : null}
                                                            <button className="btn" style={{ textAlign: 'center', padding: '12px', marginTop: '12px', backgroundColor: 'transparent', color: 'var(--text-muted)' }} onClick={handleActionSheetClose}>
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    };
                                    return <TimelineCardInternal key={item.id} item={item} dayDate={day.date} />;
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default UpAheadPage;
