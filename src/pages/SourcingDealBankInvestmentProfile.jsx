// SourcingDealBankInvestmentProfile.jsx
// Deal Bank R7c (2026-06-09) — Investments profile page, real data.
// Route: /space-rising-v2/deal-bank/investments/:slug.
// Fetches real deal_bank_listings (approved status) with company metadata.
// Hero with breadcrumb + capital/round/revenue grid + three-tab content area
// (Profile / Team / Pitch Deck). Executive summary, leadership, deck download.

import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

const TENANT_SLUG_V2 = 'space-rising-v2';

const TABS = [
  { slug: 'profile',     label: 'Profile' },
  { slug: 'team',        label: 'Team' },
  { slug: 'pitch-deck',  label: 'Pitch Deck' },
];

function slugify(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

function SourcingDealBankInvestmentProfileInner() {
  const { slug } = useParams();
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);

  const [activeTab, setActiveTab] = useState('profile');
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        // Search for approved listing by company slug match
        const { data, error } = await supabase
          .from('deal_bank_listings')
          .select(`
            *,
            directory_companies (
              name,
              vertical,
              city,
              state,
              country
            )
          `)
          .eq('status', 'approved')
          .limit(100)
          .single();

        if (error || !data) {
          // Try searching all approved listings and filter by slug
          const { data: allListings, error: searchError } = await supabase
            .from('deal_bank_listings')
            .select(`
              *,
              directory_companies (
                name,
                vertical,
                city,
                state,
                country
              )
            `)
            .eq('status', 'approved');

          if (!searchError && allListings) {
            const matched = allListings.find((listing) => {
              const companySlug = slugify(listing.directory_companies?.name || '');
              return companySlug === slug;
            });
            if (matched) {
              setListing(matched);
            } else {
              setNotFound(true);
            }
          } else {
            setNotFound(true);
          }
        } else {
          setListing(data);
        }
      } catch (err) {
        console.error('Error fetching listing:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [slug]);

  if (loading) {
    return (
      <div
        data-tenant={TENANT_SLUG_V2}
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--tx)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Loading...
        </div>
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div
        data-tenant={TENANT_SLUG_V2}
        style={{
          minHeight: '100dvh',
          background: 'var(--bg)',
          color: 'var(--tx)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14, marginBottom: 16 }}>Listing not found.</div>
          <Link
            to="/space-rising-v2/deal-bank?tab=investments"
            style={{ fontSize: 12, color: 'var(--cyan)', textDecoration: 'none' }}
          >
            Back to Investments
          </Link>
        </div>
      </div>
    );
  }

  const companyName = listing.directory_companies?.name || 'Unknown Company';
  const segment = listing.directory_companies?.vertical || '—';
  const region = [listing.directory_companies?.city, listing.directory_companies?.state]
    .filter(Boolean).join(', ') || listing.directory_companies?.country || '—';

  return (
    <div
      data-tenant={TENANT_SLUG_V2}
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        color: 'var(--tx)',
        position: 'relative',
        fontFamily: '"Space Grotesk", "Hanken Grotesk", system-ui, -apple-system, sans-serif',
        '--bg': 'transparent', '--tx': '#E8E4DA',
        '--tx2': 'rgba(232,228,218,0.60)', '--tx3': 'rgba(232,228,218,0.25)',
        '--s1': 'rgba(11,11,13,0.72)', '--s2': 'rgba(11,11,13,0.82)', '--s3': 'rgba(11,11,13,0.92)',
        '--bd': 'rgba(232,228,218,0.10)', '--bd2': 'rgba(232,228,218,0.16)',
        '--cyan': '#E8A23A', '--cyan-dim': 'rgba(232,162,58,0.10)', '--cyan-brd': 'rgba(232,162,58,0.32)',
      }}
    >
      <div className="browse-hero" style={{ '--page-hero-bg': "url('/v2-assets/earth.png')" }}>
        <div className="browse-hero-bg" />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content" style={{ position: 'relative' }}>
          <div className="browse-hero-toprow">
            <Link to="/space-rising-v2/deal-bank?tab=investments" className="browse-back" style={{ textDecoration: 'none' }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              Investments
            </Link>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" className="tenant-hero-logo" />
          </div>
          <div className="browse-title">{companyName}.</div>
          <div className="browse-sub">
            {segment} • {region}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 16px' }}>
        <CapitalGrid listing={listing} />
      </div>

      <div className="chips" style={{ paddingBottom: 4 }} role="tablist" aria-label="Investment profile sections">
        {TABS.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            role="tab"
            aria-selected={tab.slug === activeTab}
            onClick={() => setActiveTab(tab.slug)}
            className={`chip${tab.slug === activeTab ? ' on' : ''}`}
            style={{ font: 'inherit', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
        <TabPanel tab={activeTab} listing={listing} />
      </div>
    </div>
  );
}

function CapitalGrid({ listing }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 1,
        background: 'rgba(232,228,218,0.10)',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <CapitalField label="Capital Sought" value={`$${listing.capital_sought || 0}M`} />
      <CapitalField label="Round" value={listing.round_stage || '—'} />
      <CapitalField label="Year 1 Revenue" value={`$${listing.revenue_y1 || 0}M`} />
      <CapitalField label="Year 2 Revenue" value={`$${listing.revenue_y2 || 0}M`} />
      <CapitalField label="Year 3 Revenue" value={`$${listing.revenue_y3 || 0}M`} />
    </div>
  );
}

function CapitalField({ label, value }) {
  return (
    <div
      style={{
        padding: '18px 20px',
        background: 'rgba(18,20,28,0.50)',
      }}
    >
      <div
        style={{
          color: 'rgba(232,228,218,0.55)',
          fontSize: 10,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ color: 'rgba(232,228,218,0.40)', fontSize: 15, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

function TabPanel({ tab, listing }) {
  if (tab === 'profile') {
    return (
      <div
        style={{
          padding: '32px 28px',
          border: '1px solid rgba(232,228,218,0.10)',
          borderRadius: 10,
          background: 'rgba(18,20,28,0.40)',
        }}
      >
        <div
          style={{
            color: 'rgba(232,228,218,0.55)',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 12,
          }}
        >
          Executive Summary
        </div>
        <div style={{ color: 'rgba(232,228,218,0.85)', fontSize: 16, lineHeight: 1.55 }}>
          {listing.exec_summary || 'No summary posted yet.'}
        </div>
      </div>
    );
  }
  if (tab === 'team') {
    const team = listing.leadership || [];
    if (!team || team.length === 0) {
      return (
        <EmptyTab
          eyebrow="Team"
          title="Team not posted yet."
          body="Leadership team members with photos, bios, and LinkedIn profiles will appear here."
        />
      );
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {team.map((member, idx) => (
          <TeamCard key={idx} member={member} />
        ))}
      </div>
    );
  }
  if (tab === 'pitch-deck') {
    if (!listing.deck_url) {
      return (
        <EmptyTab
          eyebrow="Pitch Deck"
          title="Deck not posted yet."
          body="Pitch deck download will appear here once uploaded."
        />
      );
    }
    return (
      <div
        style={{
          padding: '32px 28px',
          border: '1px solid rgba(232,228,218,0.10)',
          borderRadius: 10,
          background: 'rgba(18,20,28,0.40)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: 'rgba(232,228,218,0.55)',
            fontSize: 11,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: 12,
          }}
        >
          Pitch Deck
        </div>
        <a
          href={listing.deck_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '12px 24px',
            background: 'var(--cyan)',
            color: '#0B0B0D',
            textDecoration: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Download Deck →
        </a>
      </div>
    );
  }
  return null;
}

function TeamCard({ member }) {
  return (
    <div
      style={{
        padding: '24px',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        background: 'rgba(18,20,28,0.40)',
        textAlign: 'center',
      }}
    >
      {member.photo_url && (
        <img
          src={member.photo_url}
          alt={member.name}
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            marginBottom: 12,
            objectFit: 'cover',
            margin: '0 auto 12px',
            display: 'block',
          }}
        />
      )}
      <div style={{ color: 'rgba(232,228,218,0.85)', fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
        {member.name}
      </div>
      <div style={{ color: 'rgba(232,228,218,0.55)', fontSize: 12, marginBottom: 12 }}>
        {member.title}
      </div>
      {member.bio && (
        <div style={{ color: 'rgba(232,228,218,0.70)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
          {member.bio}
        </div>
      )}
      {member.linkedin_url && (
        <a
          href={member.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--cyan)', textDecoration: 'none', fontSize: 12, fontWeight: 600 }}
        >
          LinkedIn Profile →
        </a>
      )}
    </div>
  );
}

function EmptyTab({ eyebrow, title, body }) {
  return (
    <div
      style={{
        padding: '56px 24px',
        textAlign: 'center',
        border: '1px solid rgba(232,228,218,0.10)',
        borderRadius: 10,
        background: 'rgba(18,20,28,0.40)',
      }}
    >
      <div style={{ color: 'rgba(232,228,218,0.55)', fontSize: 11, fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>
        {eyebrow}
      </div>
      <div style={{ color: 'var(--tx)', fontSize: 22, fontWeight: 600, lineHeight: 1.2, marginBottom: 12 }}>
        {title}
      </div>
      <div style={{ color: 'rgba(232,228,218,0.70)', fontSize: 14, lineHeight: 1.55, maxWidth: 560, margin: '0 auto' }}>
        {body}
      </div>
    </div>
  );
}

export default function SourcingDealBankInvestmentProfile() {
  return (
    <SourcingThemeProvider>
      <SourcingDealBankInvestmentProfileInner />
    </SourcingThemeProvider>
  );
}
