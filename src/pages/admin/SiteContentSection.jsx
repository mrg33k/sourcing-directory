/**
 * SiteContentSection — admin tab for editing hardcoded page copy
 *
 * Grouped by page. Each group shows its fields with text inputs/textareas
 * and a per-group Save button that upserts into directory_site_content.
 * Falls back gracefully when the table is empty (initial state).
 */

import React, { useState, useEffect, useCallback } from 'react';

/* ── Field definitions ── */
const PAGE_GROUPS = [
  {
    pageKey: 'home',
    label: 'Home Page',
    description: 'The welcome section visitors see when they land on Space OS.',
    fields: [
      { key: 'welcome_header',    label: 'Welcome Header (guest)',    type: 'input',    placeholder: 'Welcome to Space OS', note: 'Shown to guests and new visitors. Logged-in users see "Welcome back, [name]".' },
      { key: 'welcome_subheader', label: 'Welcome Subheader',         type: 'textarea', placeholder: "Here's what's happening in your space ecosystem.", note: 'One-line summary below the welcome heading.' },
    ],
  },
  {
    pageKey: 'membership',
    label: 'Membership Page',
    description: 'The /membership page where visitors sign up.',
    fields: [
      { key: 'headline', label: 'Headline (h1)', type: 'input',    placeholder: 'Join Space Rising', note: 'Main heading on the membership page.' },
      { key: 'subcopy',  label: 'Subcopy',       type: 'textarea', placeholder: 'Membership is free. Sign up and access everything SpaceOS has to offer.', note: 'Short paragraph below the headline.' },
    ],
  },
  {
    pageKey: 'directory',
    label: 'Directory',
    description: 'The /directory companies page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Directory' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Arizona space companies, defense contractors, and aerospace firms.' },
    ],
  },
  {
    pageKey: 'reports',
    label: 'Reports',
    description: 'The /reports section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Reports' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Intelligence reports, policy briefs, and market analysis for Arizona\'s space economy.' },
    ],
  },
  {
    pageKey: 'articles',
    label: 'Articles',
    description: 'The /articles section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Articles' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Research, analysis, and commentary from Arizona\'s space intelligence network.' },
    ],
  },
  {
    pageKey: 'events',
    label: 'Events',
    description: 'The /events (also /community) section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Events' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Space industry events, meetups, and conferences shaping Arizona\'s space economy.' },
    ],
  },
  {
    pageKey: 'jobs',
    label: 'Jobs',
    description: 'The /jobs (also /careers) section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Jobs' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Open positions across Arizona\'s space economy. From propulsion to policy.' },
    ],
  },
  {
    pageKey: 'marketplace',
    label: 'Marketplace',
    description: 'The /marketplace section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Marketplace' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Equipment, services, and products from Arizona\'s space economy.' },
    ],
  },
  {
    pageKey: 'discovery',
    label: 'Discovery',
    description: 'The /discovery whitepapers section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Discovery' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Whitepapers, research, and technical documents from Arizona\'s space ecosystem.' },
    ],
  },
  {
    pageKey: 'podcasts',
    label: 'Podcasts',
    description: 'The /podcasts section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Podcasts' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Conversations, briefings, and market intelligence from Arizona\'s space economy. Listen in.' },
    ],
  },
  {
    pageKey: 'videos',
    label: 'Videos',
    description: 'The /videos section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Videos' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Arizona\'s space story on film. Sessions, news coverage, and interviews from across the ecosystem.' },
    ],
  },
  {
    pageKey: 'news',
    label: 'News',
    description: 'The /news section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'News' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Real-time Arizona space coverage from KTAR, AZPBS, FOX 10, and local outlets tracking the ecosystem.' },
    ],
  },
  {
    pageKey: 'people',
    label: 'People',
    description: 'The /people section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'People' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Notable founders, researchers, and professionals building Arizona\'s space future. Curated public profiles.' },
    ],
  },
  {
    pageKey: 'rfps',
    label: 'RFPs',
    description: 'The /rfps section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'RFPs' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Open solicitations from NASA, DoD, and state agencies seeking Arizona-based vendors and partners.' },
    ],
  },
  {
    pageKey: 'grants',
    label: 'Grants',
    description: 'The /grants section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Grants' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'SBIR, STTR, Arizona Commerce Authority, and foundation funding for Arizona space companies and researchers.' },
    ],
  },
  {
    pageKey: 'organizations',
    label: 'Organizations',
    description: 'The /organizations section page.',
    fields: [
      { key: 'page_title',    label: 'Page Title',    type: 'input',    placeholder: 'Organizations' },
      { key: 'page_subtitle', label: 'Page Subtitle', type: 'textarea', placeholder: 'Nonprofits, agencies, universities, and industry bodies shaping Arizona\'s space economy.' },
    ],
  },
];

/* ── SiteContentSection ── */
export default function SiteContentSection({ adminSupabase, selectedTenantId, V }) {
  // contentMap: { [pageKey]: { [fieldKey]: value } }
  const [contentMap, setContentMap] = useState({});
  const [loadedTenant, setLoadedTenant] = useState(null);

  // Per-group save status: { [pageKey]: 'idle' | 'saving' | 'saved' | 'error' }
  const [saveStatus, setSaveStatus] = useState({});

  /* Fetch all content for this tenant */
  const fetchContent = useCallback(async () => {
    if (!adminSupabase || !selectedTenantId) return;
    const { data } = await adminSupabase
      .from('directory_site_content')
      .select('page_key, field_key, value')
      .eq('tenant_id', selectedTenantId);
    const map = {};
    (data || []).forEach(row => {
      if (!map[row.page_key]) map[row.page_key] = {};
      map[row.page_key][row.field_key] = row.value;
    });
    setContentMap(map);
    setLoadedTenant(selectedTenantId);
  }, [adminSupabase, selectedTenantId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  /* Track edits in a local draft layer */
  const [drafts, setDrafts] = useState({});

  // Reset drafts when tenant switches
  useEffect(() => {
    if (selectedTenantId !== loadedTenant) {
      setDrafts({});
    }
  }, [selectedTenantId, loadedTenant]);

  function getDisplayValue(pageKey, fieldKey) {
    // Draft takes priority, then saved value, then empty
    return drafts[pageKey]?.[fieldKey] ?? contentMap[pageKey]?.[fieldKey] ?? '';
  }

  function handleChange(pageKey, fieldKey, value) {
    setDrafts(prev => ({
      ...prev,
      [pageKey]: { ...(prev[pageKey] || {}), [fieldKey]: value },
    }));
    // Clear saved status when editing again
    setSaveStatus(prev => ({ ...prev, [pageKey]: 'idle' }));
  }

  /* Save a group (upsert all fields for this pageKey) */
  async function handleSaveGroup(group) {
    if (!adminSupabase || !selectedTenantId) return;
    setSaveStatus(prev => ({ ...prev, [group.pageKey]: 'saving' }));
    try {
      const rows = group.fields.map(f => ({
        tenant_id: selectedTenantId,
        page_key:  group.pageKey,
        field_key: f.key,
        value:     getDisplayValue(group.pageKey, f.key),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await adminSupabase
        .from('directory_site_content')
        .upsert(rows, {
          onConflict: 'tenant_id,page_key,field_key',
          ignoreDuplicates: false,
        });

      if (error) throw error;

      // Commit drafts into the saved map
      setContentMap(prev => ({
        ...prev,
        [group.pageKey]: { ...(prev[group.pageKey] || {}), ...(drafts[group.pageKey] || {}) },
      }));
      setDrafts(prev => { const d = { ...prev }; delete d[group.pageKey]; return d; });
      setSaveStatus(prev => ({ ...prev, [group.pageKey]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => ({ ...prev, [group.pageKey]: 'idle' })), 3000);
    } catch (err) {
      console.error('SiteContent save error:', err);
      setSaveStatus(prev => ({ ...prev, [group.pageKey]: 'error' }));
    }
  }

  if (!selectedTenantId) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: V.muted, fontFamily: V.font, fontSize: 14 }}>
        Select a tenant to edit its site content.
      </div>
    );
  }

  const inputBase = {
    width: '100%',
    fontFamily: V.font,
    fontSize: 14,
    color: V.text,
    background: V.bg,
    border: `1px solid ${V.border}`,
    borderRadius: 6,
    padding: '9px 12px',
    lineHeight: '1.5',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ maxWidth: 720, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 700, color: V.heading, fontFamily: V.font }}>
          Site Content
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: V.muted, fontFamily: V.font, lineHeight: 1.6 }}>
          Edit the page copy that visitors see across Space OS. Leave any field blank to keep the default text. Changes go live immediately after saving.
        </p>
      </div>

      {/* Groups */}
      {PAGE_GROUPS.map(group => {
        const status = saveStatus[group.pageKey] || 'idle';
        const hasDraft = Object.keys(drafts[group.pageKey] || {}).length > 0;

        return (
          <div key={group.pageKey} style={{
            background: V.card,
            border: `1px solid ${V.border}`,
            borderRadius: 10,
            padding: '24px 28px',
            marginBottom: 20,
          }}>
            {/* Group header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
              <div>
                <div style={{ fontFamily: V.font, fontSize: 15, fontWeight: 700, color: V.heading, marginBottom: 4 }}>
                  {group.label}
                </div>
                {group.description && (
                  <div style={{ fontFamily: V.font, fontSize: 12, color: V.muted }}>
                    {group.description}
                  </div>
                )}
              </div>

              {/* Save button + status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                {status === 'saved' && (
                  <span style={{ fontFamily: V.font, fontSize: 12, color: V.green, fontWeight: 600 }}>Saved</span>
                )}
                {status === 'error' && (
                  <span style={{ fontFamily: V.font, fontSize: 12, color: V.rose }}>Save failed</span>
                )}
                <button
                  onClick={() => handleSaveGroup(group)}
                  disabled={status === 'saving'}
                  style={{
                    background: hasDraft ? V.accent : V.border,
                    color: hasDraft ? '#fff' : V.muted,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontFamily: V.font,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: status === 'saving' ? 'wait' : 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {status === 'saving' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Fields */}
            {group.fields.map((field, fi) => (
              <div key={field.key} style={{ marginBottom: fi < group.fields.length - 1 ? 18 : 0 }}>
                <label style={{
                  display: 'block',
                  fontFamily: V.font,
                  fontSize: 12,
                  fontWeight: 600,
                  color: V.muted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}>
                  {field.label}
                </label>

                {field.type === 'textarea' ? (
                  <textarea
                    rows={2}
                    value={getDisplayValue(group.pageKey, field.key)}
                    placeholder={field.placeholder}
                    onChange={e => handleChange(group.pageKey, field.key, e.target.value)}
                    style={{ ...inputBase, resize: 'vertical', minHeight: 58 }}
                  />
                ) : (
                  <input
                    type="text"
                    value={getDisplayValue(group.pageKey, field.key)}
                    placeholder={field.placeholder}
                    onChange={e => handleChange(group.pageKey, field.key, e.target.value)}
                    style={inputBase}
                  />
                )}

                {field.note && (
                  <div style={{ fontFamily: V.font, fontSize: 11, color: V.dim, marginTop: 4, lineHeight: 1.5 }}>
                    {field.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
