/**
 * OSOrganizationsPage — Organizations section built on OSMagazinePage engine
 *
 * Data: directory_organizations (tenant = 'space-rising')
 * Column map: name → title, vertical → sector tag, description → desc,
 *   logo_url → thumbnail (fallback navy circle + initials),
 *   website → external link, membership_tiers → meta
 *
 * v3 tokens: #000C20 navy / #FEFDFD content bg / #CE4421 rust accent
 * Roboto only
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import OSMagazinePage from './OSMagazinePage.jsx';
import './osv3-magazine.css';

const TENANT_DB_LOOKUP_SLUG = 'space-rising';

/* cover gradient variants cycle */
const COV = ['osv3-cov-a', 'osv3-cov-b', 'osv3-cov-c', 'osv3-cov-d'];

/* two-letter initials from name */
function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* sector label normaliser */
function sectorLabel(vertical = '') {
  const map = {
    space: 'Space',
    defense: 'Defense',
    semiconductor: 'Semiconductor',
    biotech: 'Biotech',
    aerospace: 'Aerospace',
    tech: 'Technology',
  };
  return map[vertical?.toLowerCase()] || vertical;
}

/* sector → pill values */
const ALL_SECTORS = ['space', 'defense', 'semiconductor', 'biotech', 'aerospace', 'tech'];

/* ------------------------------------------------------------------ */
/* OrgMediaSlot — hero LEFT panel */
function OrgMediaSlot({ org }) {
  return (
    <div className="osv3-org-media">
      {/* orbital rings */}
      <div className="osv3-org-orbit" />
      <div className="osv3-org-orbit-two" />

      {/* center: logo or initials circle */}
      <div className="osv3-org-media-center">
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            className="osv3-org-media-logo"
          />
        ) : (
          <div className="osv3-org-media-init">
            {initials(org?.name || 'ORG')}
          </div>
        )}
      </div>

      {/* FEATURED badge */}
      <div className="osv3-org-badge">FEATURED</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OrgCard — grid card renderer */
function OrgCard({ item, index }) {
  const covClass = COV[index % COV.length];
  const logo = item.logo_url;

  const handleClick = () => {
    if (item.website) window.open(item.website, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="osv3-org-card" onClick={item.website ? handleClick : undefined}
      role={item.website ? 'button' : undefined}
      tabIndex={item.website ? 0 : undefined}
      onKeyDown={item.website ? (e => e.key === 'Enter' && handleClick()) : undefined}>
      <div className={`osv3-org-cover ${logo ? 'osv3-org-cover-img' : covClass}`}
        style={logo ? { backgroundImage: `url(${logo})` } : undefined}>
        {!logo && (
          <>
            <div className="osv3-org-cover-ring" />
            <div className="osv3-org-cover-init">{initials(item.name)}</div>
          </>
        )}
        {item.vertical && (
          <div className="osv3-org-sector">{sectorLabel(item.vertical)}</div>
        )}
      </div>
      <div className="osv3-org-body">
        <h3 className="osv3-org-name">{item.name}</h3>
        {item.description && (
          <p className="osv3-org-desc">
            {item.description.slice(0, 100)}{item.description.length > 100 ? '...' : ''}
          </p>
        )}
        <div className="osv3-org-foot">
          {item.website && (
            <span className="osv3-org-link">
              <span className="osv3-org-arrow">&#8599;</span>
              Visit
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OSOrganizationsPage — top-level page component */
function OSOrganizationsPage() {
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const loadOrgs = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      /* step 1: resolve tenant */
      const { data: tenantData } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single();

      /* step 2: fetch organizations */
      let qb = supabase
        .from('directory_organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantData?.id) qb = qb.eq('tenant_id', tenantData.id);

      const { data, error } = await qb.limit(50);
      if (!error && data) setOrgs(data);
    } catch (_) {
      /* silently degrade */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  /* derive available sectors from actual data */
  const presentSectors = [...new Set(orgs.map(o => o.vertical).filter(Boolean))];
  const pills = [
    { label: 'All', value: 'all' },
    ...presentSectors.map(s => ({ label: sectorLabel(s), value: s })),
  ];

  /* filter */
  const filtered = activeFilter === 'all'
    ? orgs
    : orgs.filter(o => (o.vertical || '') === activeFilter);

  /* featured = Space Rising (the operator), fallback to first */
  const featured =
    orgs.find(o => o.name?.toLowerCase().includes('space rising')) ||
    orgs[0] ||
    null;
  const gridItems = filtered;

  /* feature computed fields */
  const tierCount = featured?.membership_tiers?.length || 0;

  return (
    <OSMagazinePage
      breadcrumb="Space OS / Ecosystem Hub / Organizations"
      pageTitle="Organizations"
      pageSubtitle="Nonprofits, agencies, universities, and industry bodies shaping Arizona's space economy."
      addLabel="Add Organization"
      onAdd={() => navigate('/admin/organizations')}

      /* feature */
      featuredItem={featured}
      mediaSlot={featured ? <OrgMediaSlot org={featured} /> : null}
      featureEyebrow="FEATURED ORGANIZATION"
      featureTitle={featured?.name || ''}
      featureHost={featured?.vertical ? sectorLabel(featured.vertical) : ''}
      featureHostTag="Sector"
      featureDesc={featured?.description
        ? featured.description.slice(0, 220) + (featured.description.length > 220 ? '...' : '')
        : ''}
      featureMeta={[
        ...(tierCount > 0 ? [{ label: 'Membership Tiers', value: tierCount }] : []),
        ...(featured?.website ? [{ label: 'Website', value: featured.website.replace(/^https?:\/\//, '') }] : []),
      ]}
      featureActions={
        featured ? (
          <>
            {featured.website && (
              <a
                href={featured.website}
                target="_blank"
                rel="noopener noreferrer"
                className="osv3-mag-btn-play"
              >
                <span style={{ fontSize: '1.1em', marginRight: 6 }}>&#8599;</span>
                Visit Website
              </a>
            )}
            <button className="osv3-mag-btn-ghost" type="button"
              onClick={() => navigate('/admin/organizations')}>
              + Add Org
            </button>
          </>
        ) : null
      }

      /* grid */
      pills={pills}
      activeFilter={activeFilter}
      onFilter={setActiveFilter}
      items={gridItems}
      cardRenderer={(item, i) => (
        <OrgCard key={item.id || i} item={item} index={i} />
      )}
      isLoading={isLoading}
      sectionLabel="ALL ORGANIZATIONS"
    />
  );
}

export default OSOrganizationsPage;
