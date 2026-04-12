import React, { useState } from 'react';
import { AdminSection, ListingRow } from './AdminUI.jsx';

export default function ListingsSection({ listings, companyMap, handleListingToggle, V }) {
  const [listingFilter, setListingFilter] = useState('all');

  const filteredListings = listingFilter === 'all'
    ? listings
    : listings.filter(l => l.category === listingFilter);

  return (
    <AdminSection title="Listings" V={V}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', 'equipment', 'job', 'event', 'article'].map(cat => (
          <button key={cat} onClick={() => setListingFilter(cat)} style={{
            background: listingFilter === cat ? V.accentDim : 'transparent',
            border: `1px solid ${listingFilter === cat ? V.accentBrd : V.border}`,
            color: listingFilter === cat ? V.accent : V.muted,
            borderRadius: 6, padding: '5px 12px', fontSize: 12,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px', gap: 12, padding: '8px 16px', background: V.card2 }}>
          {['Listing', 'Status', 'Posted', 'Action'].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
          ))}
        </div>
        {filteredListings.slice(0, 50).map(listing => (
          <ListingRow key={listing.id} listing={listing} company={companyMap[listing.company_id]} onToggle={handleListingToggle} V={V} />
        ))}
        {filteredListings.length === 0 && (
          <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>No listings.</div>
        )}
        {filteredListings.length > 50 && (
          <div style={{ padding: '12px 16px', color: V.dim, fontSize: 12, fontFamily: V.mono, textAlign: 'center' }}>
            Showing 50 of {filteredListings.length}
          </div>
        )}
      </div>
    </AdminSection>
  );
}
