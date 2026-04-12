import React from 'react';
import { StatCard } from './AdminUI.jsx';

export default function StatsSection({ stats, V }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatCard label="Total Companies" value={stats.totalCompanies} title="Total active and pending companies" V={V} />
        <StatCard label="Active Companies" value={stats.activeCompanies} color={V.accent} V={V} />
        <StatCard label="Pending Approval" value={stats.pendingCompanies} color={stats.pendingCompanies > 0 ? '#FDBA74' : V.muted} V={V} />
        <StatCard label="Organizations" value={stats.totalOrgs} color="#3B82F6" V={V} />
        <StatCard label="Total Listings" value={stats.totalListings} V={V} />
        <StatCard label="Active Listings" value={stats.activeListings} color={V.accent} V={V} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Companies by Vertical</div>
          {Object.entries(stats.byVertical).map(([v, count]) => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${V.border}` }}>
              <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space, textTransform: 'capitalize' }}>{v}</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: V.mono, color: V.text }}>{count}</span>
            </div>
          ))}
        </div>

        <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Listings by Category</div>
          {Object.entries(stats.byCategory).length === 0 && (
            <div style={{ fontSize: 13, color: V.dim, fontFamily: V.space }}>No listings yet.</div>
          )}
          {Object.entries(stats.byCategory).map(([cat, count]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${V.border}` }}>
              <span style={{ fontSize: 13, color: V.muted, fontFamily: V.space, textTransform: 'capitalize' }}>{cat}</span>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: V.mono, color: V.text }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
