import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function MessagesSection({ contacts, companyMap, handleContactStatusUpdate, selectedTenantId, V }) {
  const [expandedContact, setExpandedContact] = useState(null);

  return (
    <AdminSection title="Messages & Inquiries" V={V}>
      {!selectedTenantId ? (
        <div style={{ padding: '24px 0', color: V.dim, fontSize: 13, fontFamily: V.space }}>
          Select a tenant to view messages.
        </div>
      ) : contacts.length === 0 ? (
        <div style={{ padding: '24px 0', color: V.dim, fontSize: 13, fontFamily: V.space }}>No messages yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {contacts.map(contact => {
            const co = companyMap[contact.company_id];
            const isExpanded = expandedContact === contact.id;
            const statusColors = {
              new:     { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.4)',   text: '#FDE68A' },
              read:    { bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.4)',  text: '#93C5FD' },
              replied: { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
            };
            const sc = statusColors[contact.status] || statusColors.new;
            const typeLabel = { contact: 'General Inquiry', rfq: 'RFQ', inquiry: 'Partnership' }[contact.type] || contact.type;

            return (
              <div
                key={contact.id}
                style={{
                  background: V.card, border: `1px solid ${isExpanded ? V.accentBrd : V.border}`,
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Row */}
                <div
                  onClick={() => {
                    setExpandedContact(isExpanded ? null : contact.id);
                    if (!isExpanded && contact.status === 'new') handleContactStatusUpdate(contact.id, 'read');
                  }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 90px 80px',
                    gap: 12, padding: '12px 16px', alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {contact.sender_name}
                      {' '}
                      <span style={{ fontSize: 12, color: V.dim, fontWeight: 400 }}>
                        &lt;{contact.sender_email}&gt;
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: V.muted, fontFamily: V.mono, marginTop: 2 }}>
                      {co?.name || 'Unknown company'} · {typeLabel}
                    </div>
                    {!isExpanded && (
                      <div style={{ fontSize: 12, color: V.dim, fontFamily: V.space, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {contact.message}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, textAlign: 'right' }}>
                    {new Date(contact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div>
                    <span style={{
                      background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text,
                      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                      padding: '2px 7px', borderRadius: 3,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {contact.status}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <svg
                      width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                      style={{ color: V.dim, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${V.border}` }}>
                    <div style={{ marginTop: 14, marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                        Message
                      </div>
                      <div style={{
                        background: V.card2, border: `1px solid ${V.border}`,
                        borderRadius: 7, padding: '12px 14px',
                        fontSize: 13, color: V.text, fontFamily: V.space, lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {contact.message}
                      </div>
                    </div>
                    {contact.sender_phone && (
                      <div style={{ fontSize: 12, color: V.muted, fontFamily: V.mono, marginBottom: 12 }}>
                        Phone: {contact.sender_phone}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {contact.status !== 'read' && (
                        <button
                          onClick={() => handleContactStatusUpdate(contact.id, 'read')}
                          style={{
                            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.4)',
                            color: '#93C5FD', borderRadius: 5, padding: '5px 12px',
                            fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                          }}
                        >
                          Mark as Read
                        </button>
                      )}
                      {contact.status !== 'replied' && (
                        <button
                          onClick={() => handleContactStatusUpdate(contact.id, 'replied')}
                          style={{
                            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)',
                            color: '#86EFAC', borderRadius: 5, padding: '5px 12px',
                            fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                          }}
                        >
                          Mark as Replied
                        </button>
                      )}
                      <a
                        href={`mailto:${contact.sender_email}?subject=Re: Your inquiry about ${co?.name || 'our company'}`}
                        style={{
                          background: V.accentDim, border: `1px solid ${V.accentBrd}`,
                          color: V.accent, borderRadius: 5, padding: '5px 12px',
                          fontSize: 12, fontWeight: 700, fontFamily: V.space,
                          textDecoration: 'none', cursor: 'pointer',
                        }}
                      >
                        Reply via Email
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AdminSection>
  );
}
