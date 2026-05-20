export const GRADE_BADGE_POSITIONS = {
  TOP_RIGHT: 'top-right',
  BELOW_HEADER: 'below-header',
  INLINE: 'inline',
  FLOATING_LOW: 'floating-low',
};

export function normalizeGradeBadgePosition(value) {
  const normalized = String(value || '').trim().toLowerCase();

  if (Object.values(GRADE_BADGE_POSITIONS).includes(normalized)) {
    return normalized;
  }

  return GRADE_BADGE_POSITIONS.TOP_RIGHT;
}

export function getGradeBadgeClassName({
  tone = 'bad',
  position = GRADE_BADGE_POSITIONS.TOP_RIGHT,
  compact = false,
  className = '',
} = {}) {
  const safePosition = normalizeGradeBadgePosition(position);
  const classes = [
    'grade-badge',
    'grade-badge--' + tone,
    'grade-badge--position-' + safePosition,
  ];

  if (compact) classes.push('grade-badge--compact');
  if (className) classes.push(className);

  return classes.join(' ');
}

export function getGradeBadgeStyle({
  topOffset = null,
  rightOffset = null,
  zIndex = null,
} = {}) {
  const style = {};

  if (topOffset != null) {
    style['--grade-badge-top-offset'] = typeof topOffset === 'number'
      ? topOffset + 'px'
      : String(topOffset);
  }

  if (rightOffset != null) {
    style['--grade-badge-right-offset'] = typeof rightOffset === 'number'
      ? rightOffset + 'px'
      : String(rightOffset);
  }

  if (zIndex != null) {
    style['--grade-badge-z-index'] = String(zIndex);
  }

  return style;
}

export function getRecommendedGradeBadgePosition(pageId) {
  const id = String(pageId || '').toLowerCase();

  if (id.includes('weather')) return GRADE_BADGE_POSITIONS.BELOW_HEADER;
  if (id.includes('market')) return GRADE_BADGE_POSITIONS.BELOW_HEADER;
  if (id.includes('insight')) return GRADE_BADGE_POSITIONS.FLOATING_LOW;

  return GRADE_BADGE_POSITIONS.TOP_RIGHT;
}
