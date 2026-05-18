import React, { useState, useEffect, useCallback } from 'react';
import { AdminSection } from './AdminUI.jsx';

/**
 * DealBankSection — admin approval queue for Deal Bank listings and investors.
 * Matches the visual pattern of PendingContentSection.
 */
export default function DealBankSection({ adminSupabase, selectedTenantId, V }) {
  const [pendingListings, setPendingListings] = useState([]);
  const [pendingInvestors, setPendingInvestors] = useState([]);
  const [completedRounds, setCompletedRounds] = useState([]);
  const [companyMap, setCompanyMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({});

  const fetchData = useCallback(async () => {
    if (!adminSupabase) return;
    setLoading(true);
    try {
      const [listingsRes, investorsRes, roundsRes, companiesRes] = await Promise.all([
        adminSupabase
          .from('deal_bank_listings')
          .select('*')
          .in('status', ['pending', 'rejected'])
          .order('submitted_at', { ascending: false }),
        adminSupabase
          .from('deal_bank_investors')
          .select('*')
          .in('status', ['pending', 'rejected'])
          .order('submitted_at', { ascending: false }),
        adminSupabase
          .from('deal_bank_completed_rounds')
          .select('*')
          .order('date', { ascending: false })
          .limit(20),
        adminSupabase
          .from('directory_companies')
          .select('id, name, logo_url')
          .eq('status', 'active'),
      ]);

      setPendingListings(listingsRes.data || []);
      setPendingInvestors(investorsRes.data || []);
      setCompletedRounds(roundsRes.data || []);

      const map = {};
      (companiesRes.data || []).forEach(c => { map[c.id] = c; });
      setCompanyMap(map);
    } catch (err) {
      console.error('DealBank fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [adminSupabase, selectedTenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleListingAction = async (id, action) => {
    if (!adminSupabase) return;
    setRefreshing(prev => ({ ...prev, [id]: true }));
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await adminSupabase
        .from('deal_bank_listings')
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      await fetchData();
    } catch (err) {
      console.error('Listing action error:', err);
    } finally {
      setRefreshing(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleInvestorAction = async (id, action) => {
    if (!adminSupabase) return;
    setRefreshing(prev => ({ ...prev, [id]: true }));
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await adminSupabase
        .from('deal_bank_investors')
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      await fetchData();
    } catch (err) {
      console.error('Investor action error:', err);
    } finally {
      setRefreshing(prev => ({ ...prev, [id]: false }));
    }
  };

  const pendingCount = pendingListings.length + pendingInvestors.length;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: V.muted, fontFamily: V.space }}>
        Loading Deal Bank data...
      </div>
    );
  }

  return (
    <div>
      {/* ─── Pending Investment Listings ───────────────────────────────────── */}
      <AdminSection
        title={`Pending Investment Listings${pendingListings.length > 0 ? ` (${pendingListings.length})` : ''}`}
        V={V}
      >
        {pendingListings.length === 0 ? (
          <EmptyState message="No pending investment listings." V={V} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingListings.map(listing => {
              const company = companyMap[listing.company_id];
              const submitted = new Date(listing.submitted_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              return (
                <ApprovalCard
                  key={listing.id}
                  id={listing.id}
                  isRefreshing={!!refreshing[listing.id]}
                  status={listing.status}
                  title={company?.name || 'Unknown Company'}
                  meta={[
                    listing.round_stage && { label: 'Stage', value: listing.round_stage },
                    listing.capital_sought && { label: 'Seeking', value: listing.capital_sought },
                    { label: 'Submitted', value: submitted },
                  ].filter(Boolean)}
                  tagLabel="listing"
                  tagColor="#93C5FD"
                  tagBg="rgba(59,130,246,0.15)"
                  excerpt={listing.exec_summary}
                  extra={listing.deck_url && (
                    <a
                      href={listing.deck_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, textDecoration: 'none' }}
                    >
                      View Deck ↗
                    </a>
                  )}
                  onApprove={() => handleListingAction(listing.id, 'approve')}
                  onReject={() => handleListingAction(listing.id, 'reject')}
                  V={V}
                />
              );
            })}
          </div>
        )}
      </AdminSection>

      {/* ─── Pending Investor Profiles ─────────────────────────────────────── */}
      <AdminSection
        title={`Pending Investor Profiles${pendingInvestors.length > 0 ? ` (${pendingInvestors.length})` : ''}`}
        V={V}
      >
        {pendingInvestors.length === 0 ? (
          <EmptyState message="No pending investor profiles." V={V} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {pendingInvestors.map(investor => {
              const submitted = new Date(investor.submitted_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              const checkRange = investor.check_size_min || investor.check_size_max
                ? `$${fmtNum(investor.check_size_min)} – $${fmtNum(investor.check_size_max)}`
                : null;
              return (
                <ApprovalCard
                  key={investor.id}
                  id={investor.id}
                  isRefreshing={!!refreshing[investor.id]}
                  status={investor.status}
                  title={investor.firm_name}
                  meta={[
                    checkRange && { label: 'Check', value: checkRange },
                    investor.deals_last_18mo != null && { label: 'Deals (18mo)', value: investor.deals_last_18mo },
                    { label: 'Submitted', value: submitted },
                  ].filter(Boolean)}
                  tagLabel="investor"
                  tagColor="#6EE7B7"
                  tagBg="rgba(16,185,129,0.15)"
                  excerpt={investor.criteria}
                  extra={investor.website && (
                    <a
                      href={investor.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, textDecoration: 'none' }}
                    >
                      {investor.website.replace(/^https?:\/\//, '')} ↗
                    </a>
                  )}
                  onApprove={() => handleInvestorAction(investor.id, 'approve')}
                  onReject={() => handleInvestorAction(investor.id, 'reject')}
                  V={V}
                />
              );
            })}
          </div>
        )}
      </AdminSection>

      {/* ─── Completed Rounds (read-only view) ────────────────────────────── */}
      <AdminSection title={`Completed Rounds (${completedRounds.length})`} V={V}>
        {completedRounds.length === 0 ? (
          <EmptyState message="No completed rounds yet. Add them directly in the database." V={V} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {completedRounds.map(r => (
              <div
                key={r.id}
                style={{
                  background: V.card, border: `1px solid ${V.border}`,
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 16, flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 2 }}>
                    {r.company}
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    {r.amount_raised && (
                      <span style={{ fontSize: 12, color: '#86EFAC', fontFamily: V.mono, fontWeight: 700 }}>
                        {r.amount_raised}
                      </span>
                    )}
                    {r.round && (
                      <span style={{ fontSize: 11, color: V.muted, fontFamily: V.mono }}>{r.round}</span>
                    )}
                    {r.date && (
                      <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                        {new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {r.notes && (
                      <span style={{ fontSize: 11, color: V.muted, fontFamily: V.space, fontStyle: 'italic' }}>
                        {r.notes.slice(0, 80)}{r.notes.length > 80 ? '…' : ''}
                      </span>
                    )}
                  </div>
                </div>
                {r.source_url && (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, textDecoration: 'none', flexShrink: 0 }}
                  >
                    Source ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminSection>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (!n) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(0) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
  return n.toString();
}

function EmptyState({ message, V }) {
  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 10, padding: '32px 24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 4 }}>
        {message}
      </div>
      <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space }}>
        All pending items have been reviewed.
      </div>
    </div>
  );
}

function ApprovalCard({
  id, isRefreshing, status, title, meta, tagLabel, tagColor, tagBg,
  excerpt, extra, onApprove, onReject, V,
}) {
  return (
    <div style={{
      background: V.card,
      border: `1px solid ${status === 'rejected' ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.2)'}`,
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 4 }}>
            {title}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
            {/* Tag badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: V.mono,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '2px 8px', borderRadius: 4,
              background: tagBg, color: tagColor,
            }}>
              {tagLabel}
            </span>
            {/* Status badge */}
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: V.mono,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              padding: '2px 8px', borderRadius: 4,
              background: status === 'rejected' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.15)',
              color: status === 'rejected' ? '#FCA5A5' : '#FDE68A',
            }}>
              {status}
            </span>
            {/* Meta items */}
            {meta.map(({ label, value }) => (
              <span key={label} style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                <span style={{ color: V.muted, fontWeight: 600 }}>{label}</span>{' '}{value}
              </span>
            ))}
          </div>
          {excerpt && (
            <div style={{
              fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
              marginBottom: extra ? 8 : 0,
            }}>
              {excerpt}
            </div>
          )}
          {extra}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onApprove}
            disabled={isRefreshing}
            style={{
              background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
              color: '#86EFAC', borderRadius: 6, padding: '6px 14px', fontSize: 12,
              fontWeight: 700, fontFamily: V.space, cursor: isRefreshing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', opacity: isRefreshing ? 0.5 : 1,
            }}
          >
            Approve
          </button>
          <button
            onClick={onReject}
            disabled={isRefreshing}
            style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#FCA5A5', borderRadius: 6, padding: '6px 14px', fontSize: 12,
              fontWeight: 700, fontFamily: V.space, cursor: isRefreshing ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', opacity: isRefreshing ? 0.5 : 1,
            }}
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
