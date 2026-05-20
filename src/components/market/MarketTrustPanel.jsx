import React from 'react';
import './MarketTrustPanel.css';

function hasRows(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (!value || typeof value !== 'object') return false;
    return Object.keys(value).length > 0;
}

function getAgeLabel(timestamp) {
    if (!timestamp) return 'age unknown';

    const time = new Date(timestamp).getTime();
    if (!Number.isFinite(time)) return 'age unknown';

    const ageMs = Math.max(0, Date.now() - time);
    const minutes = Math.round(ageMs / 60000);

    if (minutes < 60) return `${minutes}m old`;

    const hours = Math.round(ageMs / 36e5);
    if (hours < 48) return `${hours}h old`;

    return `${Math.round(hours / 24)}d old`;
}

function getCoverage(marketData = {}) {
    return [
        {
            key: 'indices',
            label: 'Indices',
            ok: hasRows(marketData.indices),
            count: Array.isArray(marketData.indices) ? marketData.indices.length : 0
        },
        {
            key: 'movers',
            label: 'Movers',
            ok: hasRows(marketData.movers?.gainers) || hasRows(marketData.movers?.losers),
            count: (marketData.movers?.gainers?.length || 0) + (marketData.movers?.losers?.length || 0)
        },
        {
            key: 'sectorals',
            label: 'Sectorals',
            ok: hasRows(marketData.sectorals),
            count: Array.isArray(marketData.sectorals) ? marketData.sectorals.length : 0
        },
        {
            key: 'commodities',
            label: 'Commodities',
            ok: hasRows(marketData.commodities),
            count: Array.isArray(marketData.commodities) ? marketData.commodities.length : 0
        },
        {
            key: 'currency',
            label: 'Currency',
            ok: hasRows(marketData.currencies),
            count: Array.isArray(marketData.currencies) ? marketData.currencies.length : 0
        },
        {
            key: 'fiidii',
            label: 'FII/DII',
            ok: hasRows(marketData.fiidii?.fii) || hasRows(marketData.fiidii?.dii),
            count: Number(Boolean(marketData.fiidii?.fii)) + Number(Boolean(marketData.fiidii?.dii))
        },
        {
            key: 'mutualFunds',
            label: 'MF',
            ok: hasRows(marketData.mutualFunds),
            count: Array.isArray(marketData.mutualFunds) ? marketData.mutualFunds.length : 0
        },
        {
            key: 'ipo',
            label: 'IPO',
            ok: hasRows(marketData.ipo?.upcoming) || hasRows(marketData.ipo?.live) || hasRows(marketData.ipo?.recent),
            count: (marketData.ipo?.upcoming?.length || 0) +
                (marketData.ipo?.live?.length || 0) +
                (marketData.ipo?.recent?.length || 0)
        }
    ];
}

function getSourceStats(sourceHealth = {}) {
    const entries = Object.entries(sourceHealth || {});
    const live = entries.filter(([, statusObj]) => statusObj?.status === 'live' || statusObj === 'live').length;
    const snapshot = entries.filter(([, statusObj]) => statusObj?.status === 'snapshot' || statusObj === 'snapshot').length;
    const failed = entries.filter(([, statusObj]) => statusObj?.status === 'failed' || statusObj === 'failed').length;

    return {
        total: entries.length,
        live,
        snapshot,
        failed
    };
}

function getTrustGrade({ marketData, sourceHealth, error, lastFetch }) {
    const coverage = getCoverage(marketData);
    const available = coverage.filter(item => item.ok).length;
    const sourceStats = getSourceStats(sourceHealth);
    const ageLabel = getAgeLabel(lastFetch || marketData?.fetchedAt || marketData?.generatedAt);

    const mode = marketData?.isSnapshot
        ? 'snapshot'
        : marketData?.isStale
            ? 'cache'
            : marketData?.isSeed
                ? 'seed'
                : 'live';

    if (error && available === 0) {
        return {
            grade: 'F',
            tone: 'danger',
            title: 'Market data unavailable',
            message: typeof error === 'string' ? error : 'No displayable market section is currently available.',
            coverage,
            available,
            sourceStats,
            ageLabel,
            mode
        };
    }

    if (marketData?.isSeed) {
        return {
            grade: 'D',
            tone: 'danger',
            title: 'Seed / fallback data',
            message: 'Bundled fallback data is visible. Treat this as non-live display data.',
            coverage,
            available,
            sourceStats,
            ageLabel,
            mode
        };
    }

    if (marketData?.isStale || sourceStats.failed > 0) {
        return {
            grade: available >= 4 ? 'C' : 'D',
            tone: available >= 4 ? 'warn' : 'danger',
            title: 'Degraded feed coverage',
            message: `${available}/${coverage.length} sections are available; ${sourceStats.failed} source group(s) failed.`,
            coverage,
            available,
            sourceStats,
            ageLabel,
            mode
        };
    }

    if (available >= 6) {
        return {
            grade: 'A',
            tone: 'good',
            title: 'Broad market coverage',
            message: `${available}/${coverage.length} sections are available.`,
            coverage,
            available,
            sourceStats,
            ageLabel,
            mode
        };
    }

    if (available >= 3) {
        return {
            grade: 'B',
            tone: 'info',
            title: 'Partial but useful coverage',
            message: `${available}/${coverage.length} sections are available.`,
            coverage,
            available,
            sourceStats,
            ageLabel,
            mode
        };
    }

    return {
        grade: 'C',
        tone: 'warn',
        title: 'Thin market coverage',
        message: `${available}/${coverage.length} sections are available.`,
        coverage,
        available,
        sourceStats,
        ageLabel,
        mode
    };
}

function formatSourceLabel(key) {
    return String(key)
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, char => char.toUpperCase());
}

export default function MarketTrustPanel({
    marketData,
    sourceHealth,
    sessionState,
    error,
    lastFetch,
    loading,
    onRefresh
}) {
    const trust = getTrustGrade({
        marketData: marketData || {},
        sourceHealth: sourceHealth || {},
        error,
        lastFetch
    });

    const sourceEntries = Object.entries(sourceHealth || {});

    return (
        <section className={`market-trust-panel market-trust-panel--${trust.tone}`} data-market-trust-grade={trust.grade}>
            <div className="market-trust-panel__summary">
                <div className="market-trust-panel__grade">
                    <span>Grade</span>
                    <strong>{trust.grade}</strong>
                </div>

                <div className="market-trust-panel__body">
                    <div className="market-trust-panel__eyebrow">Data trust</div>
                    <h2>{trust.title}</h2>
                    <p>{trust.message}</p>

                    <div className="market-trust-panel__meta">
                        <span>{trust.mode}</span>
                        <span>{trust.ageLabel}</span>
                        <span>{typeof sessionState?.label === 'string' ? sessionState.label : 'session unknown'}</span>
                    </div>
                </div>

                <button
                    type="button"
                    className="market-trust-panel__refresh"
                    onClick={() => onRefresh?.()}
                    disabled={loading}
                >
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>

            <div className="market-trust-panel__coverage" aria-label="Market section coverage">
                {trust.coverage.map(item => (
                    <div
                        key={item.key}
                        className={`market-trust-panel__tile ${item.ok ? 'market-trust-panel__tile--ok' : 'market-trust-panel__tile--missing'}`}
                    >
                        <span>{item.label}</span>
                        <strong>{item.ok ? item.count || 'OK' : '—'}</strong>
                    </div>
                ))}
            </div>

            <details className="market-trust-panel__details">
                <summary>Source health details</summary>

                {sourceEntries.length > 0 ? (
                    <div className="market-trust-panel__source-grid">
                        {sourceEntries.map(([section, statusObj]) => {
                            const statusStr = typeof statusObj === 'object' && statusObj !== null ? statusObj.status : statusObj;
                            return (
                                <div key={section} className="market-trust-panel__source-row">
                                    <span>{formatSourceLabel(section)}</span>
                                    <strong className={`market-trust-panel__source-status market-trust-panel__source-status--${statusStr}`}>
                                        {statusStr}
                                    </strong>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="market-trust-panel__empty-source">
                        Source health unavailable.
                    </div>
                )}
            </details>
        </section>
    );
}