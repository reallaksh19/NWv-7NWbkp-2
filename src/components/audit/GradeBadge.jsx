import { useState } from 'react';
import AuditDetailModal from './AuditDetailModal.jsx';
import { auditGradeLabel, auditGradeTone } from '../../services/pageAuditGrading.js';
import { getGradeBadgeClassName, getGradeBadgeStyle } from './gradeBadgePlacement.js';
import './GradeBadge.css';
import './AuditDetailModal.css';

export default function GradeBadge({
  audit,
  label = 'Quality grade',
  position = 'top-right',
  compact = false,
  topOffset = null,
  rightOffset = null,
  zIndex = null,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const grade = auditGradeLabel(audit);
  const tone = auditGradeTone(audit);
  const badgeClassName = getGradeBadgeClassName({
    tone,
    position,
    compact,
    className,
  });
  const badgeStyle = getGradeBadgeStyle({
    topOffset,
    rightOffset,
    zIndex,
  });

  return (
    <>
      <button
        type="button"
        className={badgeClassName}
        style={badgeStyle}
        onClick={() => setOpen(true)}
        aria-label={label + ': ' + grade + '. Open audit details'}
        title={label + ': ' + grade}
        data-grade-badge={grade}
      >
        <span className="grade-badge__letter">{grade}</span>
      </button>

      {open && (
        <AuditDetailModal
          audit={audit}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
