'use client';

import { useState, useEffect, useId } from 'react';

const TEXT_PRIMARY = '#E7E4DD';
const TEXT_MUTED = '#6E767B';
const CARD_BORDER = '#2A3136';

// A section that opens and closes from its heading. Closed by default
// unless `defaultOpen`; with `storageKey`, each viewer's open/closed choice
// is remembered in this browser (a convenience — it works without storage).
export default function Collapsible({ title, subtitle, storageKey, defaultOpen = false, badge, children, style }) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved === '1' || saved === '0') setOpen(saved === '1');
    } catch {}
  }, [storageKey]);
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (storageKey) {
        try {
          window.localStorage.setItem(storageKey, next ? '1' : '0');
        } catch {}
      }
      return next;
    });
  };

  return (
    <section style={{ marginTop: 32, ...style }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
          background: 'none', border: 'none', borderBottom: `1px solid ${CARD_BORDER}`, padding: '0 0 10px', cursor: 'pointer', color: 'inherit',
        }}
      >
        <span aria-hidden="true" style={{ color: TEXT_MUTED, fontSize: 12, lineHeight: '20px', width: 12, flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: TEXT_PRIMARY }}>{title}</span>
            {badge && <span style={{ fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: TEXT_MUTED, border: `1px solid ${CARD_BORDER}`, borderRadius: 3, padding: '1px 5px' }}>{badge}</span>}
          </span>
          {subtitle && <span style={{ display: 'block', fontSize: 11, color: TEXT_MUTED, marginTop: 4, lineHeight: 1.5 }}>{subtitle}</span>}
        </span>
      </button>
      <div id={bodyId} hidden={!open}>
        {open && children}
      </div>
    </section>
  );
}
