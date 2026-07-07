// SourcingGrantsV2.jsx
// Space OS v3 — Grants page reskin into light shell.
// Data: directory_listings where category='grant'.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import useSRWTitle from './srw/useSRWTitle.js';

const TENANT_SLUG_V2 = 'space-rising-v2';
const TENANT_DB_LOOKUP_SLUG = 'space-rising';

function formatAmount(min, max) {
  const fmt = (n) => {
    if (!n && n !== 0) return null;
    if (n >= 1000000) return `$${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return `$${n.toLocaleString()}`;
  };
  const lo = fmt(min);
  const hi = fmt(max);
  if (lo && hi) return `${lo} – ${hi}`;
  if (lo) return `${lo}+`;
  if (hi) return `Up to ${hi}`;
  return null;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (daysLeft < 0) return `Closed ${label}`;
  if (daysLeft <= 30) return `Due ${label} (${daysLeft}d)`;
  return `Due ${label}`;
}

function SourcingGrantsV2Inner() {
  useSRWTitle('Space Grants | Space OS');

  const [tenant, setTenant] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('directory_tenants')
        .select('*')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();
      if (data) setTenant(data);
    })();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let qb = supabase
          .from('directory_listings')
          .select('*')
          .eq('category', 'grant')
          .eq('status', 'active')
          .order('deadline', { ascending: true, nullsFirst: false });
        if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
        const { data, error } = await qb.limit(100);
        if (error) throw error;
        if (!cancelled) setListings(data || []);
      } catch (err) {
        console.error('GrantsV2 fetch error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenant]);

  const filteredListings = useMemo(() => {
    if (!searchInput.trim()) return listings;
    const terms = searchInput.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      const haystack = [
        l.title, l.description, l.grant_type,
      ].filter(Boolean).join(' ').toLowerCase();
      return terms.every((t) => haystack.includes(t));
    });
  }, [listings, searchInput]);

  return (
    <div style={{ padding: '32px' }}>
      <style>{`
        .osv3-grants-header {
          margin-bottom: 32px;
        }
        .osv3-grants-title {
          font-size: 32px;
          font-weight: 700;
          color: var(--v3-ink-primary);
          margin-bottom: 8px;
        }
        .osv3-grants-sub {
          font-size: 16px;
          font-weight: 400;
          color: var(--v3-muted);
        }
        .osv3-grants-search {
          margin-bottom: 24px;
          position: relative;
        }
        .osv3-grants-search input {
          width: 100%;
          max-width: 400px;
          padding: 10px 12px 10px 36px;
          font-size: 14px;
          font-weight: 400;
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          color: var(--v3-ink-primary);
          background-color: white;
          font-family: var(--v3-font-family-base);
        }
        .osv3-grants-search input::placeholder {
          color: var(--v3-muted);
        }
        .osv3-grants-search input:focus {
          outline: none;
          border-color: var(--v3-accent);
          box-shadow: 0 0 0 2px rgba(206, 68, 33, 0.1);
        }
        .osv3-grants-search svg {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          color: var(--v3-muted);
          pointer-events: none;
        }
        .osv3-grants-spinner {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          border: 2px solid var(--v3-border);
          border-top-color: var(--v3-accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: translateY(-50%) rotate(360deg); }
        }
        .osv3-grants-list {
          display: grid;
          gap: 16px;
        }
        .osv3-grant-card {
          background-color: white;
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          padding: 16px;
          transition: all var(--v3-transition-base);
          cursor: pointer;
          text-decoration: none;
          color: inherit;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
        }
        .osv3-grant-card:hover {
          border-color: var(--v3-accent);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        .osv3-grant-body {
          flex: 1;
          min-width: 0;
        }
        .osv3-grant-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--v3-ink-primary);
          margin-bottom: 8px;
        }
        .osv3-grant-meta {
          font-size: 14px;
          font-weight: 500;
          color: var(--v3-muted);
          margin-bottom: 8px;
        }
        .osv3-grant-description {
          font-size: 13px;
          font-weight: 400;
          color: var(--v3-ink-secondary);
          line-height: 1.5;
          margin-bottom: 8px;
        }
        .osv3-grant-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .osv3-grant-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          background-color: var(--v3-panel-bg);
          color: var(--v3-ink-primary);
        }
        .osv3-grant-badge.deadline-soon {
          background-color: rgba(206, 68, 33, 0.1);
          color: var(--v3-accent);
        }
        .osv3-grant-arrow {
          flex-shrink: 0;
          width: 16px;
          height: 16px;
          color: var(--v3-muted);
          margin-top: 2px;
        }
        .osv3-grants-empty {
          text-align: center;
          padding: 48px 24px;
          color: var(--v3-muted);
          font-size: 14px;
          font-weight: 400;
        }
        .osv3-grants-error {
          padding: 16px;
          border: 1px solid var(--v3-border);
          border-radius: 8px;
          background-color: var(--v3-panel-bg);
          color: var(--v3-muted);
          font-size: 13px;
          text-align: center;
        }
      `}</style>

      <div className="osv3-grants-header">
        <h2 className="osv3-grants-title">Grants</h2>
        <p className="osv3-grants-sub">Funding opportunities for the space economy.</p>
      </div>

      <div className="osv3-grants-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search grants, agencies, types..."
          aria-label="Search grants"
          autoComplete="off"
          spellCheck="false"
        />
        {loading && <div className="osv3-grants-spinner" />}
      </div>

      <div className="osv3-grants-list">
        {!supabase && (
          <div className="osv3-grants-error">
            Supabase not configured — copy your env keys to .env.local
          </div>
        )}

        {loading && supabase && (
          <>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{
                height: 100,
                borderRadius: '8px',
                background: 'var(--v3-panel-bg)',
                border: '1px solid var(--v3-border)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </>
        )}

        {!loading && filteredListings.map((grant) => {
          const amount = formatAmount(grant.grant_amount_min, grant.grant_amount_max);
          const deadline = formatDeadline(grant.deadline);
          const description = grant.description
            ? (grant.description.length > 140 ? grant.description.slice(0, 140) + '…' : grant.description)
            : '';
          const daysLeft = grant.deadline
            ? Math.ceil((new Date(grant.deadline) - new Date()) / (1000 * 60 * 60 * 24))
            : null;
          const isDeadlineSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

          return (
            <a
              key={grant.id}
              href={grant.url || '#'}
              target={grant.url ? '_blank' : undefined}
              rel={grant.url ? 'noopener noreferrer' : undefined}
              className="osv3-grant-card"
            >
              <div className="osv3-grant-body">
                <div className="osv3-grant-title">{grant.title || 'Untitled grant'}</div>
                <div className="osv3-grant-meta">
                  {[grant.grant_agency, deadline].filter(Boolean).join(' · ')}
                </div>
                {description && (
                  <div className="osv3-grant-description">{description}</div>
                )}
                <div className="osv3-grant-badges">
                  {grant.grant_type && (
                    <span className="osv3-grant-badge">{grant.grant_type}</span>
                  )}
                  {amount && (
                    <span className="osv3-grant-badge">{amount}</span>
                  )}
                  {isDeadlineSoon && deadline && (
                    <span className="osv3-grant-badge deadline-soon">{deadline}</span>
                  )}
                </div>
              </div>
              <svg className="osv3-grant-arrow" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M7 17l10-10M17 17V7h-10" />
              </svg>
            </a>
          );
        })}

        {!loading && supabase && filteredListings.length === 0 && (
          <div className="osv3-grants-empty">
            {searchInput ? `No grants match "${searchInput}"` : 'No grants available.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingGrantsV2() {
  return <SourcingGrantsV2Inner />;
}
