import { describe, expect, it } from 'vitest';
import {
  GRADE_BADGE_POSITIONS,
  getGradeBadgeClassName,
  getGradeBadgeStyle,
  getRecommendedGradeBadgePosition,
  normalizeGradeBadgePosition,
} from './gradeBadgePlacement';

describe('Grade badge placement certification', () => {
  it('normalizes invalid placement to top-right', () => {
    expect(normalizeGradeBadgePosition('bad-position')).toBe(GRADE_BADGE_POSITIONS.TOP_RIGHT);
  });

  it('builds collision-safe placement class names', () => {
    const className = getGradeBadgeClassName({
      tone: 'good',
      position: 'below-header',
      compact: true,
    });

    expect(className).toContain('grade-badge--good');
    expect(className).toContain('grade-badge--position-below-header');
    expect(className).toContain('grade-badge--compact');
  });

  it('exposes CSS variable style offsets', () => {
    const style = getGradeBadgeStyle({
      topOffset: 72,
      rightOffset: '18px',
      zIndex: 70,
    });

    expect(style['--grade-badge-top-offset']).toBe('72px');
    expect(style['--grade-badge-right-offset']).toBe('18px');
    expect(style['--grade-badge-z-index']).toBe('70');
  });

  it('recommends lower placement for collision-heavy pages', () => {
    expect(getRecommendedGradeBadgePosition('weather')).toBe('below-header');
    expect(getRecommendedGradeBadgePosition('market')).toBe('below-header');
    expect(getRecommendedGradeBadgePosition('insight')).toBe('floating-low');
  });
});
