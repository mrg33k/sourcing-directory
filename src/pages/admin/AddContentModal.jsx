import React, { useEffect } from 'react';

// ─── Content-type registry ────────────────────────────────────────────────────
// `tab` = the activeTab key that opens the relevant section in SourcingAdmin.
// Each section has its own insert path — clicking here lands on that section.
const CONTENT_TYPES = [
  {
    key: 'company',
    label: 'Company',
    tab: 'add',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    key: 'organization',
    label: 'Organization',
    tab: 'orgs',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
        <path d="M12 7v4m0 0-5 6m5-6 5 6"/>
      </svg>
    ),
  },
  {
    key: 'listing',
    label: 'Listing',
    tab: 'listings',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    key: 'deal',
    label: 'Deal',
    tab: 'deal-bank',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    key: 'report',
    label: 'Report',
    tab: 'reports',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    key: 'member',
    label: 'Member',
    tab: 'members',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    key: 'message',
    label: 'Message',
    tab: 'messages',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    key: 'ticket',
    label: 'Ticket',
    tab: 'tickets',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 1 0 0-4V7a2 2 0 0 1 2-2z"/>
      </svg>
    ),
  },
  {
    key: 'tag',
    label: 'Tag',
    tab: 'tags',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
        <line x1="7" y1="7" x2="7.01" y2="7"/>
      </svg>
    ),
  },
];

// ─── AddContentModal ──────────────────────────────────────────────────────────
export default function AddContentModal({ setActiveTab, onClose }) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(1, 11, 19, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FEFDFD',
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(1,11,19,0.18)',
          padding: '32px',
          width: '100%',
          maxWidth: 540,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#CE4421',
              fontFamily: 'var(--v3-font-family-base)', marginBottom: 4,
            }}>
              ADD CONTENT
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#010B13', fontFamily: 'var(--v3-font-family-base)' }}>
              What are you adding?
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', padding: 4, cursor: 'pointer',
              color: '#6B7280', borderRadius: 4,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* 3×3 grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {CONTENT_TYPES.map(type => (
            <button
              key={type.key}
              onClick={() => setActiveTab(type.tab)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 10,
                padding: '20px 12px',
                background: '#FFFFFF',
                border: '1px solid #D7DEE2',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'border-color 150ms, background 150ms',
                fontFamily: 'var(--v3-font-family-base)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(206,68,33,0.40)';
                e.currentTarget.style.background = 'rgba(206,68,33,0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#D7DEE2';
                e.currentTarget.style.background = '#FFFFFF';
              }}
            >
              <span style={{ color: '#CE4421', display: 'flex', alignItems: 'center' }}>
                {type.icon}
              </span>
              <span style={{
                fontSize: 12, fontWeight: 600, color: '#010B13',
                letterSpacing: '0.01em',
              }}>
                {type.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
