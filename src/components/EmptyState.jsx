import React from 'react';

export default function EmptyState({ title, message, hint }) {
  return (
    <div className="empty-state" style={{ padding: '16px', background: 'var(--card-bg, #f9fafb)', borderRadius: '8px', textAlign: 'center', marginTop: '16px', border: '1px dashed var(--border-color, #e5e7eb)' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-primary, #111827)' }}>{title}</h3>
      <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary, #4b5563)' }}>{message}</p>
      {hint && <small style={{ color: 'var(--text-muted, #9ca3af)', fontSize: '0.8rem' }}>{hint}</small>}
    </div>
  );
}
