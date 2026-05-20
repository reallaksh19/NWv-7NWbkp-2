import React, { useEffect, useState, useCallback } from 'react';
import MarketStickyHeader from '../components/MarketStickyHeader';
import MutualFundCard from '../components/MutualFundCard';
import IPOCard from '../components/IPOCard';
import SectionNavigator from '../components/SectionNavigator';
import MarketSparkline from '../components/MarketSparkline';
import { useMarket } from '../context/MarketContext';
import { useSettings } from '../context/SettingsContext';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getMarketSessionState } from '../utils/marketSession';
import EmptyState from '../components/EmptyState';
import GradeBadge from '../components/audit/GradeBadge.jsx';
import { auditMarketTabQuality } from '../services/pageAuditGrading.js';

const PRIMARY_INDEX_NAMES = ['NIFTY 50', 'SENSEX', 'BANK NIFTY', 'MIDCAP 150'];
const GLOBAL_INDEX_NAMES = ['S&P 500', 'NASDAQ', 'NIKKEI 225', 'HANG SENG', 'FTSE 100'];
const INDEX_ALIAS_MAP = {
    'NIFTY 50': ['NIFTY 50', 'NIFTY50', '^NSEI'],
    'SENSEX': ['SENSEX', 'BSE SENSEX', '^BSESN'],
    'BANK NIFTY': ['BANK NIFTY', 'NIFTY BANK', '^NSEBANK'],
    'MIDCAP 150': ['MIDCAP 150', 'MIDCAP', 'NIFTY MIDCAP 150', 'NIFTYMIDCAP150.NS']
};
const GLOBAL_INDEX_ALIAS_MAP = {
    'S&P 500': ['S&P 500', 'SP 500', '^GSPC'],
    'NASDAQ': ['NASDAQ', '^IXIC'],
    'NIKKEI 225': ['NIKKEI 225', '^N225'],
    'HANG SENG': ['HANG SENG', '^HSI'],
    'FTSE 100': ['FTSE 100', '^FTSE']
};

function formatUpdated(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp).toLocaleString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: 'short'
    });
}

function getIndexByName(indices, names) {
    return names
        .map((name) => indices?.find((item) => item.name === name))
        .filter(Boolean);
}

function getIndexByAliases(indices, map, names) {
    return names
        .map((name) => {
            const aliases = map[name] || [name];
            return indices?.find((item) => aliases.some((alias) => item.name === alias || item.symbol === alias));
        })
        .filter(Boolean);
}

function getFloat(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getMarketMood(indices) {
    if (!indices || indices.length === 0) {
        return { tone: 'neutral', label: 'No active market data' };
    }

    const avg = indices.reduce((sum, item) => sum + getFloat(item.changePercent), 0) / indices.length;
    if (avg >= 0.6) return { tone: 'positive', label: 'Broad risk-on tone' };
    if (avg <= -0.6) return { tone: 'negative', label: 'Broad risk-off tone' };
    return { tone: 'neutral', label: 'Mixed market tone' };
}

function getMarketTone(value) {
    const parsed = getFloat(value);
    if (parsed > 0) return 'positive';
    if (parsed < 0) return 'negative';
    return 'neutral';
}

function getMarketToneClass(value) {
    return `market-tone--${getMarketTone(value)}`;
}

function MarketStat({ label, value, hint, tone = 'neutral' }) {
    return (
        <div className={`market-stat market-stat--${tone}`}>
            <div className="market-stat__label">{label}</div>
            <div className="market-stat__value">{value}</div>
            {hint && <div className="market-stat__hint">{hint}</div>}
        </div>
    );
}

function hasUsableSectionData(section) {
  if (Array.isArray(section)) return section.length > 0;
  if (!section || typeof section !== 'object') return false;
  return Object.keys(section).length > 0;
}

function MarketPage() {
    const { marketData, loading, error, refreshMarket, lastFetch, ensureBoot } = useMarket();
    const { settings } = useSettings();
    const marketSettings = settings?.market || {};
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        ensureBoot();
    }, [ensureBoot]);

    const handleRefresh = useCallback(() => refreshMarket(true), [refreshMarket]);
    const { pullDistance } = usePullToRefresh(handleRefresh);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Phase 6: Log offline/snapshot fallback metrics
    useEffect(() => {
      if (!marketData) return;

      console.log({
        page: 'market',
        mode: marketData?.isSnapshot ? 'snapshot' : marketData?.isStale ? 'cache' : 'live',
        availability: {
          indices: hasUsableSectionData(marketData.indices),
          mutualFunds: hasUsableSectionData(marketData.mutualFunds),
          movers:
            hasUsableSectionData(marketData.movers?.gainers) ||
            hasUsableSectionData(marketData.movers?.losers),
          sectorals: hasUsableSectionData(marketData.sectorals),
          commodities: hasUsableSectionData(marketData.commodities),
          currencies: hasUsableSectionData(marketData.currencies),
          fiidii:
            hasUsableSectionData(marketData.fiidii?.fii) ||
            hasUsableSectionData(marketData.fiidii?.dii)
        }
      });
    }, [marketData]);

    const indices = marketData?.indices || [];
    const primaryIndices = getIndexByAliases(indices, INDEX_ALIAS_MAP, PRIMARY_INDEX_NAMES);
    const globalIndices = getIndexByAliases(indices, GLOBAL_INDEX_ALIAS_MAP, GLOBAL_INDEX_NAMES);
    const mood = getMarketMood(primaryIndices.length ? primaryIndices : indices.slice(0, 3));
    const sourceHealth = React.useMemo(() => marketData?.sourceHealth || {}, [marketData?.sourceHealth]);
    const sessionState = getMarketSessionState({
        lastUpdated: lastFetch || marketData?.fetchedAt,
        tradingHolidays: marketSettings.tradingHolidays || []
    });
    const moverGainers = marketData?.movers?.gainers || [];
    const moverLosers = marketData?.movers?.losers || [];
    const marketBreath = {
        up: indices.filter((item) => getFloat(item.change) >= 0).length,
        down: indices.filter((item) => getFloat(item.change) < 0).length
    };
    const displayedPrimaryIndices = primaryIndices.length ? primaryIndices : indices.slice(0, 4);
    const heroIndex = displayedPrimaryIndices[0] || indices[0];
    const heroSeries = heroIndex?.series || heroIndex?.history || [];
    const sectoralIndices = (marketData?.sectorals?.length ? marketData.sectorals : getIndexByName(indices, ['BANK NIFTY', 'NIFTY IT', 'NIFTY PHARMA', 'NIFTY AUTO']))
        .filter((item, idx, arr) => arr.findIndex((candidate) => candidate.name === item.name) === idx);

    const marketTabAudit = React.useMemo(() => auditMarketTabQuality({
        marketData,
        sourceHealth,
        sessionState,
        error,
        loading,
        lastFetch,
    }), [marketData, sourceHealth, sessionState, error, loading, lastFetch]);

    const navSections = [
        (marketSettings.showGainers !== false || marketSettings.showLosers !== false) && { id: 'market-movers', icon: '📈', label: 'Top Movers' },
        marketSettings.showSectorals !== false && { id: 'sectoral-indices', icon: '🏛️', label: 'Sectorals' },
        marketSettings.showCommodities !== false && hasUsableSectionData(marketData?.commodities) && { id: 'commodities', icon: '🪙', label: 'Commodities' },
        marketSettings.showCurrency !== false && hasUsableSectionData(marketData?.currencies) && { id: 'currency', icon: '💱', label: 'Currency' },
        marketSettings.showFIIDII !== false && (hasUsableSectionData(marketData?.fiidii?.fii) || hasUsableSectionData(marketData?.fiidii?.dii)) && { id: 'fiidii', icon: '🏦', label: 'FII/DII' },
        marketSettings.showMutualFunds !== false && hasUsableSectionData(marketData?.mutualFunds) && { id: 'mutual-funds', icon: '💰', label: 'Mutual Funds' },
        marketSettings.showMarketHealth !== false && { id: 'source-health', icon: '📡', label: 'Source Health' },
        marketSettings.showIPO !== false && (hasUsableSectionData(marketData?.ipo?.upcoming) || hasUsableSectionData(marketData?.ipo?.live) || hasUsableSectionData(marketData?.ipo?.recent)) && { id: 'ipo-tracker', icon: '🎯', label: 'IPO Watch' }
    ].filter(Boolean);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading && !marketData) {
        return (
            <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
                <div className="loading">
                    <div className="loading__spinner" />
                    <span>Loading Market Data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="page-container market-page-shell" style={{ padding: 0 }}>
            <GradeBadge
                audit={marketTabAudit}
                label="Market tab quality grade"
                position="below-header"
                topOffset="74px"
                compact={true}
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
            
            <MarketStickyHeader
                marketData={marketData}
                indices={primaryIndices.length ? primaryIndices : indices.slice(0, 4)}
                onRefresh={refreshMarket}
                loading={loading}
                lastUpdated={lastFetch}
                tradingHolidays={marketSettings.tradingHolidays || []}
            />

            <main className="main-content market-page market-page--revamp" style={{ padding: '16px', marginTop: 0 }}>
                {error && typeof error === 'string' && (
                    <div className="market-inline-banner">
                        <div className="market-inline-banner__title">Degraded feed detected</div>
                        <div className="market-inline-banner__body">{error}</div>
                    </div>
                )}

                {marketSettings.showIndices !== false && displayedPrimaryIndices.length > 0 && (
                    <section className="market-hero-grid">
                        <div className="market-hero-panel modern-card">
                            <div className="market-hero-panel__top">
                                <div>
                                    <div className="market-hero-panel__eyebrow">India-first market board</div>
                                    <h1 className="market-hero-panel__title">Market pulse</h1>
                                    <div className={`market-hero-panel__status ${mood.tone === 'positive' ? 'text-success' : mood.tone === 'negative' ? 'text-danger' : 'text-muted'}`}>
                                        {mood.label}
                                    </div>
                                </div>
                                <div className={`market-status-pill market-status-pill--${sessionState.tone}`}>
                                    {sessionState.label} · {sessionState.ageLabel}
                                </div>
                            </div>

                            <div className="market-hero-panel__body">
                                <div className="market-hero-board">
                                    {displayedPrimaryIndices.map((index, idx) => {
                                        const isUp = getFloat(index.change) >= 0;
                                        return (
                                            <div key={`${index.name}-${idx}`} className={`market-hero-board__tile ${getMarketToneClass(index.change)}`}>
                                                <div className="market-hero-board__symbol">{index.name}</div>
                                                <div className="market-hero-board__value">{index.value}</div>
                                                <div className={`market-hero-board__change ${isUp ? 'text-success' : 'text-danger'}`}>
                                                    {isUp ? '▲' : '▼'} {Math.abs(getFloat(index.changePercent)).toFixed(2)}%
                                                </div>
                                                <div className="market-hero-board__range">
                                                    {index.dayLow ? Number(index.dayLow).toLocaleString('en-IN') : '--'} - {index.dayHigh ? Number(index.dayHigh).toLocaleString('en-IN') : '--'}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="market-hero-panel__spark">
                                    <MarketSparkline series={heroSeries} positive={getFloat(displayedPrimaryIndices[0]?.change) >= 0} />
                                    <div className="market-hero-panel__timestamp">Updated {formatUpdated(lastFetch || marketData?.fetchedAt)}</div>
                                </div>
                            </div>

                            <div className="market-stat-grid">
                                <MarketStat
                                    label="Breadth"
                                    value={`${marketBreath.up}/${marketBreath.down}`}
                                    hint="advancers / decliners"
                                    tone={marketBreath.up >= marketBreath.down ? 'positive' : 'negative'}
                                />
                                <MarketStat
                                    label="Last Fetch"
                                    value={lastFetch ? new Date(lastFetch).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--'}
                                    hint="local cache or live"
                                />
                                <MarketStat
                                    label="Feed Age"
                                    value={sessionState.ageLabel}
                                    hint={sessionState.reason}
                                />
                                <MarketStat
                                    label="Source Mode"
                                    value={sessionState.label}
                                    hint={sessionState.reason}
                                    tone={sessionState.tone === 'success' ? 'positive' : sessionState.tone === 'warning' ? 'warning' : 'neutral'}
                                />
                            </div>
                        </div>

                        <div className="market-hero-side">
                            {marketSettings.showGlobalIndices !== false && (
                                <div className="market-side-panel modern-card">
                                    <div className="market-side-panel__title">Global context</div>
                                    <div className="market-global-rail">
                                        {globalIndices.length > 0 ? globalIndices.map((item) => {
                                            const isUp = getFloat(item.change) >= 0;
                                            return (
                                                <div key={item.name} className={`market-global-rail__item ${getMarketToneClass(item.change)}`}>
                                                    <div className="market-global-rail__name">{item.name}</div>
                                                    <div className="market-global-rail__value">{item.value}</div>
                                                    <div className={`market-global-rail__change ${isUp ? 'text-success' : 'text-danger'}`}>
                                                        {isUp ? '▲' : '▼'} {Math.abs(getFloat(item.changePercent)).toFixed(2)}%
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Global indices unavailable.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </section>
                )}

                {(marketSettings.showGainers !== false || marketSettings.showLosers !== false) && (
                    <section id="market-movers" className="market-section modern-card">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Live movers</div>
                                <h2 className="modern-card__title">Top Movers</h2>
                            </div>
                            <div className="market-section__subtitle">Market breadth leaders and laggards</div>
                        </div>

                        <div className="market-movers-grid">
                            {marketSettings.showGainers !== false && (
                                <div className="market-movers-column">
                                    <div className="market-column-title text-success">Top Gainers</div>
                                    <div className="market-table">
                                        {moverGainers.length > 0 ? moverGainers.slice(0, 5).map((stock, idx) => (
                                            <div key={`${stock.symbol}-${idx}`} className={`market-table__row ${getMarketToneClass(stock.changePercent)}`}>
                                                <div>
                                                    <div className="market-table__symbol">{stock.symbol}</div>
                                                    <div className="market-table__meta">{stock.action || stock.volume ? `Vol ${stock.volume || '--'}` : 'Live quote'}</div>
                                                </div>
                                                <div className="market-table__value">
                                                    <div>{stock.price}</div>
                                                    <div className="text-success">+{Math.abs(getFloat(stock.changePercent)).toFixed(2)}%</div>
                                                </div>
                                            </div>
                                        )) : <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No gainers data available.</div>}
                                    </div>
                                </div>
                            )}

                            {marketSettings.showLosers !== false && (
                                <div className="market-movers-column">
                                    <div className="market-column-title text-danger">Top Losers</div>
                                    <div className="market-table">
                                        {moverLosers.length > 0 ? moverLosers.slice(0, 5).map((stock, idx) => (
                                            <div key={`${stock.symbol}-${idx}`} className={`market-table__row ${getMarketToneClass(stock.changePercent)}`}>
                                                <div>
                                                    <div className="market-table__symbol">{stock.symbol}</div>
                                                    <div className="market-table__meta">{stock.action || stock.volume ? `Vol ${stock.volume || '--'}` : 'Live quote'}</div>
                                                </div>
                                                <div className="market-table__value">
                                                    <div>{stock.price}</div>
                                                    <div className="text-danger">-{Math.abs(getFloat(stock.changePercent)).toFixed(2)}%</div>
                                                </div>
                                            </div>
                                        )) : <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>No losers data available.</div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {marketSettings.showSectorals !== false && (
                    <section id="sectoral-indices" className="market-section modern-card">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Rotation map</div>
                                <h2 className="modern-card__title">Sectoral Indices</h2>
                            </div>
                            <div className="market-section__subtitle">Breadth by sector, not just headline indices</div>
                        </div>

                        <div className="market-heatmap">
                            {sectoralIndices.length > 0 ? sectoralIndices.map((sector) => {
                                const isUp = getFloat(sector.changePercent) >= 0;
                                return (
                                    <div key={sector.name} className={`market-heatmap__tile ${isUp ? 'market-heatmap__tile--up' : 'market-heatmap__tile--down'} ${getMarketToneClass(sector.changePercent)}`}>
                                        <div className="market-heatmap__name">{sector.name}</div>
                                        <div className="market-heatmap__value">{sector.value}</div>
                                        <div className={isUp ? 'text-success' : 'text-danger'}>
                                            {isUp ? '▲' : '▼'} {Math.abs(getFloat(sector.changePercent)).toFixed(2)}%
                                        </div>
                                    </div>
                                );
                            }) : <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Sector data unavailable.</div>}
                        </div>
                    </section>
                )}

                <section className="market-macro-grid">
                    {marketSettings.showCommodities !== false && (
                        !hasUsableSectionData(marketData?.commodities) ? 
                        <div id="commodities" className="market-section modern-card"><div className="modern-card__header"><h3 className="modern-card__title">🪙 Commodities</h3></div><div className="market-empty-explanation" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Commodities snapshot unavailable</div></div> :
                        <div id="commodities" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">Macro watch</div>
                                    <h2 className="modern-card__title">Commodities</h2>
                                </div>
                                <div className="market-section__subtitle">Gold, silver and crude</div>
                            </div>

                            <div className="market-macro-list">
                                {marketData.commodities.map((commodity) => {
                                    const isUp = getFloat(commodity.changePercent) >= 0;
                                    return (
                                        <div key={commodity.name} className={`market-macro-item ${getMarketToneClass(commodity.changePercent)}`}>
                                            <div>
                                                <div className="market-macro-item__name">{commodity.name}</div>
                                                <div className="market-macro-item__meta">{commodity.unit}</div>
                                            </div>
                                            <div className="market-macro-item__value">
                                                <div>{commodity.value}</div>
                                                <div className={isUp ? 'text-success' : 'text-danger'}>
                                                    {isUp ? '+' : ''}{getFloat(commodity.changePercent).toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {marketSettings.showCurrency !== false && (
                        !hasUsableSectionData(marketData?.currencies) ? 
                        <div id="currency" className="market-section modern-card"><div className="modern-card__header"><h3 className="modern-card__title">💱 Currency</h3></div><div className="market-empty-explanation" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Currency snapshot unavailable</div></div> :
                        <div id="currency" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">FX</div>
                                    <h2 className="modern-card__title">Currency Rates</h2>
                                </div>
                                <div className="market-section__subtitle">INR reference pairs</div>
                            </div>

                            <div className="market-macro-list">
                                {marketData.currencies.map((currency) => {
                                    const isUp = getFloat(currency.changePercent) >= 0;
                                    return (
                                        <div key={currency.name} className={`market-macro-item ${getMarketToneClass(currency.changePercent)}`}>
                                            <div>
                                                <div className="market-macro-item__name">{currency.name}</div>
                                                <div className="market-macro-item__meta">{currency.source || 'live'}</div>
                                            </div>
                                            <div className="market-macro-item__value">
                                                <div>{currency.value}</div>
                                                <div className={isUp ? 'text-success' : 'text-danger'}>
                                                    {isUp ? '+' : ''}{getFloat(currency.changePercent).toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {marketSettings.showFIIDII !== false && (
                        !(hasUsableSectionData(marketData?.fiidii?.fii) || hasUsableSectionData(marketData?.fiidii?.dii)) ? 
                        <div id="fiidii" className="market-section modern-card"><div className="modern-card__header"><h3 className="modern-card__title">🏦 FII / DII Activity</h3></div><div className="market-empty-explanation" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>FII/DII feed not configured</div></div> :
                        <div id="fiidii" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">Flows</div>
                                    <h2 className="modern-card__title">FII / DII Activity</h2>
                                </div>
                                <div className="market-section__subtitle">Latest available institutional flow readout</div>
                            </div>

                            <div className="market-flow-grid">
                                <div className={`market-flow-card ${getMarketToneClass(marketData?.fiidii?.fii?.net)}`}>
                                    <div className="market-flow-card__title">FII</div>
                                    <div className="market-flow-card__row"><span>Buy</span><strong className="text-success">₹{marketData?.fiidii?.fii?.buy ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Sell</span><strong className="text-danger">₹{marketData?.fiidii?.fii?.sell ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Net</span><strong className={getFloat(marketData?.fiidii?.fii?.net) >= 0 ? 'text-success' : 'text-danger'}>₹{marketData?.fiidii?.fii?.net ?? '--'} Cr</strong></div>
                                </div>
                                <div className={`market-flow-card ${getMarketToneClass(marketData?.fiidii?.dii?.net)}`}>
                                    <div className="market-flow-card__title">DII</div>
                                    <div className="market-flow-card__row"><span>Buy</span><strong className="text-success">₹{marketData?.fiidii?.dii?.buy ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Sell</span><strong className="text-danger">₹{marketData?.fiidii?.dii?.sell ?? '--'} Cr</strong></div>
                                    <div className="market-flow-card__row"><span>Net</span><strong className={getFloat(marketData?.fiidii?.dii?.net) >= 0 ? 'text-success' : 'text-danger'}>₹{marketData?.fiidii?.dii?.net ?? '--'} Cr</strong></div>
                                </div>
                            </div>
                            <div className="market-flow-card__footer">As of {marketData?.fiidii?.date || 'N/A'}</div>
                        </div>
                    )}
                </section>

                <section className="market-bottom-grid">
                    {marketSettings.showMutualFunds !== false && (
                        !hasUsableSectionData(marketData?.mutualFunds) ? (
                            <div id="mutual-funds" className="market-section modern-card">
                                <div className="modern-card__header">
                                    <h3 className="modern-card__title">💰 Mutual Funds</h3>
                                </div>
                                <div className="market-empty-explanation" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Mutual funds snapshot unavailable</div>
                            </div>
                        ) : (
                        <div id="mutual-funds" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">NAV board</div>
                                    <h2 className="modern-card__title">Mutual Funds</h2>
                                </div>
                                <div className="market-section__subtitle">Tracked funds with latest NAV movement</div>
                            </div>
                            <MutualFundCard funds={marketData.mutualFunds} />
                        </div>
                        )
                    )}

                    {marketSettings.showIPO !== false && (
                        !(hasUsableSectionData(marketData?.ipo?.upcoming) || hasUsableSectionData(marketData?.ipo?.live) || hasUsableSectionData(marketData?.ipo?.recent)) ? (
                            <div id="ipo-tracker" className="market-section modern-card">
                                <div className="modern-card__header">
                                    <h3 className="modern-card__title">🎯 IPO Watch</h3>
                                </div>
                                <div className="market-empty-explanation" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>IPO live scrape disabled in static-host mode</div>
                            </div>
                        ) : (
                        <div id="ipo-tracker" className="market-section modern-card">
                            <div className="modern-card__header">
                                <div>
                                    <div className="market-section__eyebrow">Primary issues</div>
                                    <h2 className="modern-card__title">IPO Tracker</h2>
                                </div>
                                <div className="market-section__subtitle">Upcoming, live and recent issues</div>
                            </div>
                            <IPOCard ipoData={marketData.ipo} />
                        </div>
                        )
                    )}
                </section>

                

                {marketSettings.showMarketHealth !== false && (
                    <section id="source-health" className="market-section modern-card market-source-health-section">
                        <div className="modern-card__header">
                            <div>
                                <div className="market-section__eyebrow">Reliability</div>
                                <h2 className="modern-card__title">Source health</h2>
                            </div>
                            <div className="market-section__subtitle">Live, snapshot, or failed status by feed</div>
                        </div>

                        <div className="market-health-list market-health-list--bottom">
                            {Object.entries(sourceHealth).length > 0 ? Object.entries(sourceHealth).map(([section, statusObj]) => {
                                const statusStr = typeof statusObj === 'object' && statusObj !== null ? statusObj.status : statusObj;
                                return (
                                <div key={section} className="market-health-row">
                                    <span className="market-health-row__label">{section.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                                    <span className={`market-status-pill market-status-pill--${statusStr === 'live' ? 'success' : statusStr === 'snapshot' ? 'warning' : statusStr === 'failed' ? 'danger' : 'muted'}`}>
                                        {statusStr}
                                    </span>
                                </div>
                                );
                            }) : (
                                <div className="market-empty-state" style={{textAlign: 'center', padding: '20px', color: 'var(--text-muted)'}}>Source health unavailable.</div>
                            )}
                        </div>
                    </section>
                )}

                <div className="market-disclaimer market-disclaimer--revamp">
                    <div>* Data is for informational purposes only. Not investment advice.</div>
                    <div className="market-disclaimer__meta">
                        Last Updated: {marketData?.fetchedAt ? new Date(marketData.fetchedAt).toLocaleString() : 'N/A'}
                    </div>
                </div>
            </main>

            <SectionNavigator sections={navSections} />

            <button
                onClick={scrollToTop}
                className="market-back-to-top"
                style={{
                    opacity: showBackToTop ? 1 : 0,
                    pointerEvents: showBackToTop ? 'auto' : 'none'
                }}
            >
                ↑
            </button>
        </div>
    );
}

export default MarketPage;
