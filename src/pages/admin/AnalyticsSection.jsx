import React from 'react';
import { StatCard, AdminSection } from './AdminUI.jsx';

export default function AnalyticsSection({ analyticsData, contacts, companyMap, selectedTenantId, V }) {
  return (
    <AdminSection title="Analytics" V={V}>
      {!selectedTenantId ? (
        <div style={{ padding: '24px 0', color: V.dim, fontSize: 13, fontFamily: V.space }}>
          Select a tenant to view analytics.
        </div>
      ) : !analyticsData ? (
        <div style={{ padding: '24px 0', color: V.dim, fontSize: 13, fontFamily: V.space }}>Loading analytics...</div>
      ) : (
        <div>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
            <StatCard label="Page Views (7d)" value={analyticsData.pageViewsWeek} color={V.accent} V={V} />
            <StatCard label="Page Views (30d)" value={analyticsData.pageViewsMonth} color={V.accent} V={V} />
            <StatCard label="Total Messages" value={contacts.length} color="#3B82F6" V={V} />
            <StatCard
              label="New Messages"
              value={contacts.filter(c => c.status === 'new').length}
              color={contacts.filter(c => c.status === 'new').length > 0 ? '#FDBA74' : V.muted}
              V={V}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Top companies */}
            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Top Viewed Companies (30d)
              </div>
              {analyticsData.topCompanies.length === 0 ? (
                <div style={{ fontSize: 13, color: V.dim, fontFamily: V.space }}>No profile views yet.</div>
              ) : (
                (() => {
                  const maxCount = Math.max(...analyticsData.topCompanies.map(c => c.count), 1);
                  return analyticsData.topCompanies.map(({ id, count }) => {
                    const co = companyMap[id];
                    const pct = Math.round((count / maxCount) * 100);
                    return (
                      <div key={id} style={{ position: 'relative', padding: '8px 0', borderBottom: `1px solid ${V.border}` }}>
                        <div style={{ position: 'absolute', left: 0, top: 4, bottom: 4, width: `${pct}%`, background: V.accentDim, borderRadius: 4, transition: 'width 0.3s' }} />
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 8px' }}>
                          <span style={{ fontSize: 13, color: V.text, fontFamily: V.space, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                            {co?.name || id.slice(0, 8) + '...'}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: V.mono, color: V.accent, flexShrink: 0 }}>
                            {count}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Recent searches */}
            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
                Recent Searches
              </div>
              {analyticsData.recentSearches.length === 0 ? (
                <div style={{ fontSize: 13, color: V.dim, fontFamily: V.space }}>No searches recorded yet.</div>
              ) : (
                analyticsData.recentSearches.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${V.border}`, gap: 8 }}>
                    <span style={{ fontSize: 13, color: V.text, fontFamily: V.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                      {s.metadata?.query || '—'}
                    </span>
                    <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, flexShrink: 0 }}>
                      {new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </AdminSection>
  );
}
