import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens, ThemeToggle, useTenant } from './SourcingTheme.jsx';

// ─── Auth state hook for nav ─────────────────────────────────────────────────
function useAuthUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription?.unsubscribe();
  }, []);
  return user;
}

// ─── Vertical / filter config ─────────────────────────────────────────────────
const VERTICALS = [
  { key: 'all',           label: 'All Industries',   color: '#9ca3af' },
  { key: 'semiconductor', label: 'Semiconductor',     color: '#29B6F6' },
  { key: 'space',         label: 'Space & Aerospace', color: '#7C3AED' },
];

const CONDITIONS = [
  { key: 'all',          label: 'All Conditions' },
  { key: 'new',          label: 'New' },
  { key: 'used',         label: 'Used' },
  { key: 'refurbished',  label: 'Refurbished' },
];

const PRICE_RANGES = [
  { key: 'all',    label: 'Any Price',     min: null,   max: null },
  { key: 'under5', label: 'Under $5k',     min: null,   max: 5000 },
  { key: '5-25',   label: '$5k – $25k',    min: 5000,   max: 25000 },
  { key: '25-100', label: '$25k – $100k',  min: 25000,  max: 100000 },
  { key: 'over100',label: 'Over $100k',    min: 100000, max: null },
];

const CONDITION_COLORS = {
  new:          { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
  used:         { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
  refurbished:  { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.4)',  text: '#93C5FD' },
};

// ─── Sourcing Nav ─────────────────────────────────────────────────────────────
// tenantSlug: scope links to tenant. tenantName: display name. features: which tabs to show.
// brandColor: accent override from tenant. All optional for backward compat.
export function SourcingNav({ active, tenantSlug, tenantName, features, brandColor }) {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const accent = brandColor || '#22D3EE';
  const authUser = useAuthUser();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const base = tenantSlug ? `/${tenantSlug}` : '';
  const isS3CTenant = tenantSlug === 's3c-semiconductor';
  const tenantLogoUrl = isS3CTenant
    ? 'https://rag.aheadofmarket.com/files/arsenal/21b3072b-c02-hexagonal-badge-nobg.png'
    : null;
  const f = features || { jobs: true, marketplace: true, events: true, articles: true, signup: true };

  const isHome = active === 'home' || active === 'landing';
  const isDir = ['directory','marketplace','jobs','events','articles','grants','reports','membership','portal','settings','about','profile','signup','login','checkout'].includes(active);

  const handleSignOut = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate(tenantSlug ? `/${tenantSlug}/login` : '/');
  };

  const moreItems = [];
  // Only show section links when inside a tenant directory
  if (tenantSlug) {
    moreItems.push(
      { label: 'Jobs', sub: 'Open positions', href: `${base}/jobs`, icon: 'M20 7H4v14h16V7zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2', color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
      { label: 'Events', sub: 'Conferences & meetups', href: `${base}/events`, icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18', color: '#22D3EE', bg: 'rgba(34,211,238,0.1)' },
      { label: 'Reports', sub: 'Intelligence & analysis', href: `${base}/reports`, icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6', color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
      { label: 'Marketplace', sub: 'Equipment exchange', href: `${base}/marketplace`, icon: 'M9 21a1 1 0 100-2 1 1 0 000 2zM20 21a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
      { label: 'Membership', sub: 'Upgrade your account', href: `${base}/membership`, icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z', color: '#FB7185', bg: 'rgba(251,113,133,0.1)' },
      { label: 'Articles', sub: 'Industry news', href: `${base}/articles`, icon: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V5a2.5 2.5 0 012.5-2.5H20v17H6.5', color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
      { label: 'Deal Bank', sub: 'Closed funding rounds', href: `${base}/deal-bank`, icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6', color: '#E5451F', bg: 'rgba(229,69,31,0.12)' },
    );
  }
  if (authUser) {
    moreItems.push({ label: 'My Portal', sub: 'Company dashboard', href: tenantSlug ? `${base}/portal` : '/admin', icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z', color: '#E2E8F0', bg: 'rgba(255,255,255,0.05)' });
  }
  moreItems.push(
    { label: authUser ? 'Sign Out' : 'Sign In', sub: authUser ? '' : 'Manage your profile', href: authUser ? '#signout' : (tenantSlug ? `${base}/login` : '/space-rising/login'), icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z', color: '#94A3B8', bg: 'rgba(255,255,255,0.04)', action: authUser ? handleSignOut : null },
  );

  return (
    <>
      {/* Bottom Nav Bar -- v10 CSS classes */}
      <div className="v10-nav">
        <Link to="/" className={`v10-nav-btn ${isHome ? 'on' : ''}`}>
          <div className="v10-nav-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
          </div>
          <div className="v10-nav-label">Home</div>
        </Link>
        <Link to={base || '/'} className={`v10-nav-btn ${(isDir && !isHome) ? 'on' : ''}`}>
          <div className="v10-nav-icon" style={tenantLogoUrl ? { padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' } : undefined}>
            {tenantLogoUrl ? (
              <img
                src={tenantLogoUrl}
                alt={`${tenantName || 'S3C'} logo`}
                style={{ width: 22, height: 22, objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            )}
          </div>
          <div className="v10-nav-label">Directory</div>
        </Link>
        <div className="v10-nav-btn" onClick={() => { const el = document.querySelector('.browse-search input, .home-search-input, input[placeholder*="Search"], input[type="text"]'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => el.focus(), 150); } else { navigate(`${base}`); setTimeout(() => document.querySelector('input[type="text"]')?.focus(), 400); } }}>
          <div className="v10-nav-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </div>
          <div className="v10-nav-label">Search</div>
        </div>
        <div className={`v10-nav-btn ${moreOpen ? 'on' : ''}`} onClick={() => setMoreOpen(!moreOpen)}>
          <div className="v10-nav-icon">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </div>
          <div className="v10-nav-label">More</div>
        </div>
      </div>

      {/* More Menu */}
      <div className={`more-overlay ${moreOpen ? 'open' : ''}`} onClick={() => setMoreOpen(false)} />
      <div className={`more-sheet ${moreOpen ? 'open' : ''}`}>
        <div className="more-handle" />
        {moreItems.map((item, i) => (
          <React.Fragment key={i}>
            {i === moreItems.length - 2 && <div className="more-divider" />}
            {item.action ? (
              <div className="more-item" onClick={() => { setMoreOpen(false); item.action(); }}>
                <div className="more-item-icon" style={{ background: item.bg, color: item.color }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={item.icon}/></svg>
                </div>
                <div>
                  <div className="more-item-label">{item.label}</div>
                  {item.sub && <div className="more-item-sub">{item.sub}</div>}
                </div>
              </div>
            ) : (
              <Link to={item.href} className="more-item" onClick={() => setMoreOpen(false)}>
                <div className="more-item-icon" style={{ background: item.bg, color: item.color }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d={item.icon}/></svg>
                </div>
                <div>
                  <div className="more-item-label">{item.label}</div>
                  {item.sub && <div className="more-item-sub">{item.sub}</div>}
                </div>
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>
    </>
  );
}

// ─── Membership Gate (used by posting pages) ────────────────────────────────
export function MembershipGate({ children, featureName }) {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug } = useTenant();
  const base = tenantSlug ? `/${tenantSlug}` : '';
  const accent = tenant?.brand_color || V.accent;
  const [state, setState] = useState('loading'); // loading | no-auth | free | paid

  useEffect(() => {
    if (!supabase) { setState('no-auth'); return; }
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState('no-auth'); return; }
      if (!tenant?.id) { setState('no-auth'); return; }

      const { data: member } = await supabase
        .from('directory_members')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .eq('tenant_id', tenant.id)
        .single();

      if (!member?.company_id) { setState('no-auth'); return; }

      const { data: company } = await supabase
        .from('directory_companies')
        .select('membership_tier')
        .eq('id', member.company_id)
        .single();

      const tier = company?.membership_tier || 'free';
      setState(tier === 'free' ? 'free' : 'paid');
    })();
  }, [tenant]);

  if (state === 'loading') {
    return (
      <div style={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `2px solid ${V.border}`, borderTop: `2px solid ${accent}`,
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state === 'no-auth') {
    return (
      <div style={{
        maxWidth: 480, margin: '60px auto', padding: '40px 28px',
        background: V.card, border: `1px solid ${V.border}`, borderRadius: 12,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>
          <svg width="40" height="40" fill="none" stroke={accent} strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#fff', margin: '0 0 10px' }}>
          Sign in required
        </h2>
        <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: '0 0 20px', lineHeight: 1.6 }}>
          You need to be signed in to {featureName || 'access this feature'}.
        </p>
        <Link
          to={`${base}/login`}
          style={{
            display: 'inline-block', background: accent, color: '#fff',
            textDecoration: 'none', borderRadius: 8, padding: '10px 28px',
            fontSize: 14, fontWeight: 600, fontFamily: V.space,
          }}
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (state === 'free') {
    return (
      <div style={{
        maxWidth: 480, margin: '60px auto', padding: '40px 28px',
        background: V.card, border: `1px solid ${V.border}`, borderRadius: 12,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>
          <svg width="40" height="40" fill="none" stroke={accent} strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: '#fff', margin: '0 0 10px' }}>
          Paid membership required
        </h2>
        <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, margin: '0 0 20px', lineHeight: 1.6 }}>
          Posting {featureName || 'content'} is available to paid members. Upgrade your membership to unlock this feature.
        </p>
        <Link
          to={`${base}/membership`}
          style={{
            display: 'inline-block', background: accent, color: '#fff',
            textDecoration: 'none', borderRadius: 8, padding: '10px 28px',
            fontSize: 14, fontWeight: 600, fontFamily: V.space,
          }}
        >
          View Membership Options
        </Link>
      </div>
    );
  }

  // Paid member: show the form
  return children;
}

// ─── Condition Badge ──────────────────────────────────────────────────────────
function ConditionBadge({ condition, V }) {
  if (!condition) return null;
  const c = CONDITION_COLORS[condition] || CONDITION_COLORS.used;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {condition}
    </span>
  );
}

// ─── Listing Card ─────────────────────────────────────────────────────────────
function ListingCard({ listing, company, onClick, V }) {
  const [hovered, setHovered] = useState(false);
  const photos = Array.isArray(listing.photo_urls) ? listing.photo_urls : [];
  const hasPhoto = photos.length > 0 || listing.image_url;
  const photoSrc = photos[0] || listing.image_url;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? V.cardHov : V.card,
        border: `1px solid ${hovered ? V.borderHov : V.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: hovered ? `0 0 0 1px ${V.accent}20` : 'none',
      }}
    >
      {/* Photo */}
      <div style={{
        width: '100%', height: 160,
        background: hasPhoto ? 'transparent' : V.card2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {hasPhoto ? (
          <img
            src={photoSrc}
            alt={listing.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ fontSize: 40, opacity: 0.3 }}>⚙️</div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          fontSize: 15, fontWeight: 700, fontFamily: V.syne,
          color: V.text, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {listing.title}
        </div>

        {listing.description && (
          <div style={{
            fontSize: 12, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {listing.description}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <ConditionBadge condition={listing.condition} V={V} />
          {listing.price && (
            <span style={{ fontSize: 16, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>
              ${listing.price >= 1000 ? `${(listing.price / 1000).toFixed(listing.price % 1000 === 0 ? 0 : 1)}k` : listing.price.toLocaleString()}
            </span>
          )}
        </div>

        {company && (
          <div style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>
            {company.name} · {[company.city, company.state].filter(Boolean).join(', ')}
          </div>
        )}

        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
          {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

// ─── Listing Detail Modal ─────────────────────────────────────────────────────
function ListingModal({ listing, company, onClose, V }) {
  const photos = Array.isArray(listing.photo_urls) ? listing.photo_urls : [];
  const hasPhoto = photos.length > 0 || listing.image_url;
  const photoSrc = photos[0] || listing.image_url;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, maxWidth: 640, width: '100%',
          maxHeight: '85vh', overflow: 'auto',
        }}
      >
        {hasPhoto && (
          <div style={{ width: '100%', height: 240, overflow: 'hidden', borderRadius: '12px 12px 0 0' }}>
            <img src={photoSrc} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, fontFamily: V.syne, color: V.text, margin: 0, lineHeight: 1.2 }}>
              {listing.title}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, flexShrink: 0, padding: 0 }}>
              ×
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <ConditionBadge condition={listing.condition} V={V} />
            {listing.price && (
              <span style={{ fontSize: 22, fontWeight: 800, color: V.accent, fontFamily: V.mono }}>
                ${listing.price.toLocaleString()}
              </span>
            )}
          </div>

          {listing.description && (
            <p style={{ fontSize: 14, color: V.muted, fontFamily: V.space, lineHeight: 1.7, margin: '0 0 20px' }}>
              {listing.description}
            </p>
          )}

          {company && (
            <div style={{
              background: V.card2, border: `1px solid ${V.border}`,
              borderRadius: 8, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontWeight: 700 }}>
                Seller
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 2 }}>
                {company.name}
              </div>
              <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
                {[company.city, company.state].filter(Boolean).join(', ')}
              </div>
              {company.website && (
                <a href={company.website} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: V.blue, fontFamily: V.space, textDecoration: 'none', display: 'block', marginTop: 4 }}>
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {listing.contact_email && (
            <a
              href={`mailto:${listing.contact_email}?subject=Inquiry: ${encodeURIComponent(listing.title)}`}
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box',
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 8, padding: '12px', fontSize: 14,
                fontWeight: 700, fontFamily: V.space, textAlign: 'center',
              }}
            >
              Contact Seller
            </a>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: V.dim, fontFamily: V.mono, textAlign: 'center' }}>
            Posted {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inner component (uses theme) ─────────────────────────────────────────────
function SourcingMarketplaceInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const { tenant, tenantSlug, loading: tenantLoading } = useTenant();

  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);
  const [vertical, setVertical] = useState('all');
  const [condition, setCondition] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [category, setCategory] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const fetchListings = useCallback(async (q, v, cond, price, pMin, pMax, cat) => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'equipment')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenant?.id) qb = qb.eq('tenant_id', tenant.id);
      if (v && v !== 'all') qb = qb.eq('vertical', v);
      if (cond && cond !== 'all') qb = qb.eq('condition', cond);
      if (cat && cat.trim()) qb = qb.ilike('item_category', `%${cat.trim()}%`);

      // Custom min/max overrides preset buttons when set
      const useCustomPrice = pMin !== '' || pMax !== '';
      if (useCustomPrice) {
        if (pMin !== '' && !isNaN(Number(pMin))) qb = qb.gte('price', Number(pMin));
        if (pMax !== '' && !isNaN(Number(pMax))) qb = qb.lte('price', Number(pMax));
      } else {
        const pr = PRICE_RANGES.find(r => r.key === price);
        if (pr) {
          if (pr.min !== null) qb = qb.gte('price', pr.min);
          if (pr.max !== null) qb = qb.lte('price', pr.max);
        }
      }

      if (q && q.trim()) {
        qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%`);
      }

      const { data, error } = await qb.limit(100);
      if (error) throw error;
      setListings(data || []);

      if (data && data.length > 0) {
        const companyIds = [...new Set(data.map(l => l.company_id))];
        const { data: compData } = await supabase
          .from('directory_companies')
          .select('*')
          .in('id', companyIds);
        const map = {};
        (compData || []).forEach(c => { map[c.id] = c; });
        setCompanies(map);
      } else {
        setCompanies({});
      }
    } catch (err) {
      console.error('Marketplace fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant]);

  useEffect(() => {
    if (tenantSlug && tenantLoading) return;
    fetchListings(query, vertical, condition, priceRange, priceMin, priceMax, category);
  }, [query, vertical, condition, priceRange, priceMin, priceMax, category, fetchListings, tenantLoading, tenantSlug]);

  const handleSearch = () => setQuery(searchInput.trim());
  const handleCategorySearch = () => setCategory(categoryInput.trim());

  const activeFilterCount = [
    vertical !== 'all',
    condition !== 'all',
    priceRange !== 'all' || priceMin !== '' || priceMax !== '',
    category !== '',
  ].filter(Boolean).length;

  const inputStyle = {
    background: V.card2, border: `1px solid ${V.border}`,
    color: V.text, borderRadius: 6, padding: '7px 10px',
    fontSize: 12, fontFamily: V.space, outline: 'none', width: '100%',
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @media (min-width: 640px) { .mkt-filters-panel { display: flex !important; } .mkt-filters-toggle { display: none !important; } }
      `}</style>

      <SourcingNav active="marketplace" tenantSlug={tenantSlug} tenantName={tenant?.nav_label || tenant?.name} features={tenant?.features} brandColor={tenant?.brand_color} />

      {/* v10 Hero */}
      <div className="browse-hero" style={{ minHeight: 200 }}>
        <div className="browse-hero-bg" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80')" }} />
        <div className="browse-hero-overlay" />
        <div className="browse-hero-content">
          <Link to={tenantSlug ? `/${tenantSlug}` : '/'} className="browse-back" style={{ textDecoration: 'none' }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7"/></svg>
            Back
          </Link>
          <div className="browse-title">Equipment Marketplace</div>
          <div className="browse-sub">Buy, sell, and trade industry equipment</div>
        </div>
      </div>

      {/* v10 Search */}
      <div className="browse-search">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search equipment, parts, materials..."
          autoComplete="off" spellCheck="false"
        />
        {loading && <div className="spinner" />}
      </div>

      <div style={{ padding: '0 24px 80px', maxWidth: 960, margin: '0 auto' }}>
        <div className="sec-hdr" style={{ padding: '12px 0' }}>
          <div className="sec-title">Latest Listings</div>
          <Link to={`${tenantSlug ? `/${tenantSlug}` : '/'}/marketplace/post`} style={{ textDecoration: 'none', color: 'var(--cyan)', fontSize: 12, fontWeight: 600 }}>+ Post a Listing</Link>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {/* Mobile filters toggle */}
          <button
            className="mkt-filters-toggle"
            onClick={() => setFiltersOpen(o => !o)}
            style={{
              background: activeFilterCount > 0 ? V.accentDim : V.card2,
              border: `1px solid ${activeFilterCount > 0 ? V.accentBrd : V.border}`,
              color: activeFilterCount > 0 ? V.accent : V.muted,
              borderRadius: 8, padding: '0 14px', fontSize: 13,
              fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
            }}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <span style={{ fontSize: 10 }}>{filtersOpen ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* Filter panel */}
        <div
          className="mkt-filters-panel"
          style={{
            display: filtersOpen ? 'flex' : 'none',
            flexDirection: 'column', gap: 12,
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '16px 18px', marginBottom: 16,
          }}
        >
          {/* Row 1: Vertical */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Industry</span>
            {VERTICALS.map(v => (
              <button key={v.key} onClick={() => setVertical(v.key)} style={{
                background: vertical === v.key ? `${v.color}20` : 'transparent',
                border: `1px solid ${vertical === v.key ? v.color : V.border}`,
                color: vertical === v.key ? v.color : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
                {v.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 2: Condition */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>Condition</span>
            {CONDITIONS.map(c => (
              <button key={c.key} onClick={() => setCondition(c.key)} style={{
                background: condition === c.key ? V.accentDim : 'transparent',
                border: `1px solid ${condition === c.key ? V.accentBrd : V.border}`,
                color: condition === c.key ? V.accent : V.muted,
                borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
                {c.label}
              </button>
            ))}
          </div>

          <div style={{ height: 1, background: V.border }} />

          {/* Row 3: Price + Category */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Price preset buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Price</span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PRICE_RANGES.map(r => (
                  <button key={r.key} onClick={() => { setPriceRange(r.key); setPriceMin(''); setPriceMax(''); }} style={{
                    background: priceRange === r.key && priceMin === '' && priceMax === '' ? V.accentDim : 'transparent',
                    border: `1px solid ${priceRange === r.key && priceMin === '' && priceMax === '' ? V.accentBrd : V.border}`,
                    color: priceRange === r.key && priceMin === '' && priceMax === '' ? V.accent : V.muted,
                    borderRadius: 6, padding: '5px 11px', fontSize: 12,
                    fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom price min/max */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Custom Range ($)</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <input
                  type="number"
                  value={priceMin}
                  onChange={e => { setPriceMin(e.target.value); setPriceRange('all'); }}
                  placeholder="Min"
                  style={{ ...inputStyle, width: 90 }}
                />
                <span style={{ color: V.dim, fontSize: 12, fontFamily: V.mono, flexShrink: 0 }}>–</span>
                <input
                  type="number"
                  value={priceMax}
                  onChange={e => { setPriceMax(e.target.value); setPriceRange('all'); }}
                  placeholder="Max"
                  style={{ ...inputStyle, width: 90 }}
                />
              </div>
            </div>

            {/* Category/type search */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 160 }}>
              <span style={{ fontSize: 11, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={categoryInput}
                  onChange={e => setCategoryInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCategorySearch()}
                  placeholder="e.g. semiconductor, pump..."
                  style={{ ...inputStyle, minWidth: 160 }}
                />
                <button onClick={handleCategorySearch} style={{
                  background: category ? V.accentDim : 'transparent',
                  border: `1px solid ${category ? V.accentBrd : V.border}`,
                  color: category ? V.accent : V.muted,
                  borderRadius: 6, padding: '5px 10px', fontSize: 11,
                  fontWeight: 700, fontFamily: V.mono, cursor: 'pointer', flexShrink: 0,
                }}>Go</button>
                {category && (
                  <button onClick={() => { setCategoryInput(''); setCategory(''); }} style={{
                    background: 'transparent', border: `1px solid ${V.border}`,
                    color: V.muted, borderRadius: 6, padding: '5px 8px', fontSize: 11,
                    fontFamily: V.mono, cursor: 'pointer', flexShrink: 0,
                  }}>×</button>
                )}
              </div>
            </div>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <button onClick={() => {
                setVertical('all'); setCondition('all'); setPriceRange('all');
                setPriceMin(''); setPriceMax(''); setCategoryInput(''); setCategory('');
              }} style={{
                background: 'transparent', border: `1px solid ${V.border}`,
                color: V.muted, borderRadius: 6, padding: '5px 11px', fontSize: 12,
                fontWeight: 600, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
            {loading ? 'Loading...' : (
              <>
                <span style={{ color: V.text, fontWeight: 600 }}>{listings.length}</span>
                {' '}listing{listings.length !== 1 ? 's' : ''}
                {query && <> for <span style={{ color: V.accent }}>"{query}"</span></>}
              </>
            )}
          </div>
        </div>

        {!supabase && (
          <div style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8, padding: '20px 24px', textAlign: 'center' }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>Run migration 001 + 002 in Supabase SQL editor to activate.</div>
          </div>
        )}

        {loading && supabase && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, height: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        )}

        {!loading && listings.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {listings.map(listing => (
              <ListingCard
                key={listing.id}
                listing={listing}
                company={companies[listing.company_id]}
                onClick={() => setSelected(listing)}
                V={V}
              />
            ))}
          </div>
        )}

        {!loading && supabase && listings.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '60px 24px',
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 12,
          }}>
            <svg width="56" height="56" fill="none" stroke={V.dim} strokeWidth="1.5" viewBox="0 0 24 24" style={{ marginBottom: 16, opacity: 0.5 }}>
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 8 }}>
              No equipment listed
            </div>
            <div style={{ fontSize: 14, color: V.muted, fontFamily: V.space, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
              {query ? `No results for "${query}". Try different filters or keywords.` : 'No equipment listed yet. Buy, sell, and trade industry equipment here.'}
            </div>
            <Link
              to={`${tenantSlug ? `/${tenantSlug}` : '/'}/marketplace/post`}
              style={{
                background: V.accent, color: '#fff', textDecoration: 'none',
                borderRadius: 7, padding: '10px 20px', fontSize: 13,
                fontWeight: 700, fontFamily: V.space, display: 'inline-block',
              }}
            >
              List Equipment
            </Link>
          </div>
        )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ListingModal
          listing={selected}
          company={companies[selected.company_id]}
          onClose={() => setSelected(null)}
          V={V}
        />
      )}
    </div>
  );
}

// ─── Main export (wrapped with theme provider) ────────────────────────────────
export default function SourcingMarketplace() {
  return (
    <SourcingThemeProvider>
      <SourcingMarketplaceInner />
    </SourcingThemeProvider>
  );
}
