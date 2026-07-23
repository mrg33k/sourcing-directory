/**
 * OSPeoplePage — People section built on OSMagazinePage engine
 *
 * Data: directory_listings WHERE category = 'person', tenant = 'space-rising'
 * Column map:
 *   title       → full name
 *   author_name → role / title
 *   vertical    → organization
 *   description → bio
 *   virtual_url → profile / LinkedIn URL
 *   image_url   → headshot (optional)
 *
 * CURATED: notable, PUBLIC Arizona space professionals only.
 * NOT private member signups — see directory_members for that.
 *
 * v3 tokens: #000C20 navy / #FEFDFD content bg / #CE4421 rust accent
 * Roboto only — no serif, no system-ui
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';
import { useSiteContentBySlug } from '../hooks/useSiteContent.js';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* role-based color for initials circle */
const ROLE_COLORS = [
  '#3B82F6', /* blue   — research */
  '#8B5CF6', /* violet — leadership */
  '#10B981', /* green  — industry */
  '#F59E0B', /* amber  — policy */
  '#CE4421', /* rust   — default */
];

function roleColor(index) {
  return ROLE_COLORS[index % ROLE_COLORS.length];
}

/* two-letter initials from a name */
function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* pill definitions */
const PILLS = [
  { label: 'All', value: 'all' },
  { label: 'Leadership', value: 'Leadership' },
  { label: 'Research', value: 'Research' },
  { label: 'Government', value: 'Government' },
  { label: 'Industry', value: 'Industry' },
];

/* ------------------------------------------------------------------ */
/* PersonMediaSlot — hero LEFT panel                                   */
/* Dashboard/profile aesthetic: orbital rings + large initials        */
function PersonMediaSlot({ name, role, imageUrl, colorIndex }) {
  const color = roleColor(colorIndex || 0);
  return (
    <div className="osv3-ppl-media">
      {/* background rings */}
      <div className="osv3-ppl-ring-outer" aria-hidden="true" />
      <div className="osv3-ppl-ring-mid" aria-hidden="true" />

      {/* avatar circle */}
      <div
        className="osv3-ppl-avatar-lg"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : { background: color }}
      >
        {!imageUrl && (
          <span className="osv3-ppl-initials-lg">{initials(name)}</span>
        )}
      </div>

      {/* FEATURED badge */}
      <div className="osv3-ppl-badge">FEATURED</div>

      {/* role label */}
      {role && (
        <div className="osv3-ppl-role-label">{role}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PersonCard — grid card renderer */
function PersonCard({ item, index }) {
  const color = roleColor(index);
  const link = item.virtual_url || item.apply_url;

  const handleClick = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="osv3-ppl-card"
      onClick={link ? handleClick : undefined}
      role={link ? 'button' : undefined}
      tabIndex={link ? 0 : undefined}
      onKeyDown={link ? (e => e.key === 'Enter' && handleClick()) : undefined}
    >
      {/* avatar */}
      <div className="osv3-ppl-card-top">
        <div
          className="osv3-ppl-avatar"
          style={item.image_url
            ? { backgroundImage: `url(${item.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: color }
          }
        >
          {!item.image_url && (
            <span className="osv3-ppl-initials">{initials(item.title)}</span>
          )}
        </div>
      </div>

      <div className="osv3-ppl-card-body">
        <h3 className="osv3-ppl-name">{item.title}</h3>

        {item.author_name && (
          <div className="osv3-ppl-role">{item.author_name}</div>
        )}

        {item.vertical && (
          <div className="osv3-ppl-org">{item.vertical}</div>
        )}

        {item.description && (
          <p className="osv3-ppl-bio">
            {item.description.slice(0, 120)}
            {item.description.length > 120 ? '...' : ''}
          </p>
        )}

        {link && (
          <span className="osv3-ppl-profile-link">
            View profile
            <span className="osv3-ppl-arrow"> →</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSPeoplePage — top-level page component */
function OSPeoplePage() {
  const navigate = useNavigate();
  const { get } = useSiteContentBySlug(TENANT_DB_LOOKUP_SLUG);
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadItems = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      let qb = supabase
        .from('directory_listings')
        .select('*')
        .eq('category', 'person')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setItems(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = activeFilter === 'all'
    ? items
    : items.filter(v =>
        (v.author_name || '').toLowerCase().includes(activeFilter.toLowerCase()) ||
        (v.vertical || '').toLowerCase().includes(activeFilter.toLowerCase())
      );

  const featured = items[0] || null;
  const featLink = featured ? (featured.virtual_url || featured.apply_url) : null;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Ecosystem Hub / People"
      pageTitle={get('people', 'page_title', 'People')}
      pageSubtitle={get('people', 'page_subtitle', 'Notable founders, researchers, and professionals building Arizona\'s space future. Curated public profiles.')}
      addLabel="Add Person"
      onAdd={() => navigate('/admin/listings?category=person')}

      /* feature */
      featuredItem={featured}
      mediaSlot={
        featured
          ? <PersonMediaSlot
              name={featured.title}
              role={featured.author_name}
              imageUrl={featured.image_url}
              colorIndex={0}
            />
          : null
      }
      featureEyebrow="FEATURED PROFILE"
      featureTitle={featured?.title || ''}
      featureHost={featured?.author_name || ''}
      featureHostTag="Role"
      featureDesc={featured?.description
        ? featured.description.slice(0, 240) + (featured.description.length > 240 ? '...' : '')
        : ''}
      featureMeta={[
        ...(featured?.vertical ? [{ label: 'Organization', value: featured.vertical }] : []),
      ]}
      featureActions={
        featured ? (
          <>
            {featLink && (
              <a
                href={featLink}
                target="_blank"
                rel="noopener noreferrer"
                className="osv3-mag-btn-play"
              >
                View Profile
              </a>
            )}
            <button
              className="osv3-mag-btn-ghost"
              type="button"
              onClick={() => navigate('/admin/listings?category=person')}
            >
              + Add Person
            </button>
          </>
        ) : null
      }

      /* grid */
      pills={PILLS}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={filtered}
      cardRenderer={(item, i) => (
        <PersonCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL PEOPLE"
    />
  );
}

export default OSPeoplePage;
