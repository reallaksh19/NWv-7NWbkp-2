import React, { useMemo, useState } from 'react';

const FUND_TABS = [
    { id: 'large-cap', label: 'Large Cap' },
    { id: 'mid-cap', label: 'Mid Cap' },
    { id: 'flexi-cap', label: 'Flexi Cap' },
    { id: 'value', label: 'Value' },
    { id: 'elss', label: 'ELSS' }
];

function normalizeFundType(fund = {}) {
    const explicitType = String(fund.fundType || '').toLowerCase();
    if (FUND_TABS.some((tab) => tab.id === explicitType)) {
        return explicitType;
    }

    const text = `${fund.name || ''} ${fund.category || ''}`.toLowerCase();
    if (/(elss|tax saver|long term equity)/.test(text)) return 'elss';
    if (/(value|contra|dividend yield)/.test(text)) return 'value';
    if (/(mid[- ]?cap|midcap|emerging|small[- ]?cap)/.test(text)) return 'mid-cap';
    if (/(large[- ]?cap|bluechip|index)/.test(text)) return 'large-cap';
    if (/(flexi[- ]?cap|multi[- ]?cap|balanced advantage|dynamic asset)/.test(text)) return 'flexi-cap';
    return 'flexi-cap';
}

function getTabLabel(tabId) {
    return FUND_TABS.find((tab) => tab.id === tabId)?.label || 'Flexi Cap';
}

function MutualFundCard({ funds }) {
    const groupedFunds = useMemo(() => {
        const buckets = FUND_TABS.reduce((acc, tab) => {
            acc[tab.id] = [];
            return acc;
        }, {});

        (funds || []).forEach((fund) => {
            const type = normalizeFundType(fund);
            buckets[type].push({
                ...fund,
                fundType: type,
                fundTypeLabel: getTabLabel(type)
            });
        });

        return buckets;
    }, [funds]);

    const defaultTab = FUND_TABS.find((tab) => (groupedFunds[tab.id] || []).length > 0)?.id || FUND_TABS[0].id;
    const [activeTab, setActiveTab] = useState(defaultTab);

    const resolvedActiveTab = (groupedFunds[activeTab] || []).length > 0 ? activeTab : defaultTab;
    const displayFunds = groupedFunds[resolvedActiveTab] || [];

    if (!funds || funds.length === 0) {
        return (
            <div className="mf-card mf-card--empty">
                <div className="mf-card__header">
                    <span>Charts</span> Mutual Funds
                </div>
                <p className="mf-card__empty-text">NAV data unavailable</p>
            </div>
        );
    }

    return (
        <div className="mf-card">
            <div className="mf-card__header">
                <div className="mf-card__title-wrap">
                    <span>Charts</span>
                    <span className="mf-card__title">Mutual Funds</span>
                </div>
                <span className="mf-card__date">{funds[0]?.navDate || 'Latest'}</span>
            </div>

            <div className="mf-card__tabs" role="tablist" aria-label="Mutual fund types">
                {FUND_TABS.map((tab) => {
                    const count = (groupedFunds[tab.id] || []).length;
                    const active = resolvedActiveTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={`mf-tab ${active ? 'mf-tab--active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span>{tab.label}</span>
                            <span className="mf-tab__count">{count}</span>
                        </button>
                    );
                })}
            </div>

            <div className="mf-card__panel">
                {displayFunds.length > 0 ? (
                    <div className="mf-card__list">
                        {displayFunds.map((fund, idx) => (
                            <div key={fund.code || `${fund.name}-${idx}`} className="mf-fund">
                                <div className="mf-fund__info">
                                    <div className="mf-fund__name">{fund.name}</div>
                                    <div className="mf-fund__category">
                                        {fund.category}
                                        {fund.fundHouse ? ` · ${fund.fundHouse}` : ''}
                                    </div>
                                    <div className="mf-fund__badge">{fund.fundTypeLabel || getTabLabel(fund.fundType)}</div>
                                </div>
                                <div className="mf-fund__nav">
                                    <div className="mf-fund__value">₹{fund.nav}</div>
                                    <div className={`mf-fund__change mf-fund__change--${fund.direction}`}>
                                        {fund.direction === 'up' ? '▲' : '▼'} {fund.changePercent}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mf-card__empty-state">
                        No funds currently mapped to {getTabLabel(activeTab)}.
                    </div>
                )}
            </div>
        </div>
    );
}

export default MutualFundCard;
