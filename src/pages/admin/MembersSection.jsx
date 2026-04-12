import React, { useState } from 'react';
import { AdminSection } from './AdminUI.jsx';

export default function MembersSection({
  pendingMembers, memberCompanyMap, handleMemberAction,
  handleMemberUpgrade, V, adminSupabase, fetchData,
}) {
  // Local state for member management
  const [memberActionStatus, setMemberActionStatus] = useState({});
  const [memberEmailDraft, setMemberEmailDraft] = useState({});
  const [memberEmailEditing, setMemberEmailEditing] = useState({});
  const [memberDeleteConfirm, setMemberDeleteConfirm] = useState(null);

  const setMemberActionMessage = (memberId, message) => {
    setMemberActionStatus(prev => ({ ...prev, [memberId]: message }));
  };

  const handleMemberEmailSave = async (member) => {
    const nextEmail = (memberEmailDraft[member.id] || '').trim();
    if (!nextEmail) {
      setMemberActionMessage(member.id, 'Enter a valid email address.');
      return;
    }
    if (!adminSupabase) return;
    setMemberActionMessage(member.id, 'Saving email...');
    try {
      const { error } = await adminSupabase
        .from('directory_members')
        .update({ email: nextEmail })
        .eq('id', member.id);
      if (error) throw error;
      setMemberActionStatus(prev => ({ ...prev, [member.id]: 'Email updated.' }));
      setMemberEmailEditing(prev => ({ ...prev, [member.id]: false }));
      await fetchData();
    } catch (err) {
      setMemberActionMessage(member.id, err.message || 'Failed to update email.');
    }
  };

  const handleMemberDelete = async () => {
    if (!adminSupabase || !memberDeleteConfirm) return;
    const member = memberDeleteConfirm;
    setMemberActionMessage(member.id, 'Deleting account...');
    try {
      const { error } = await adminSupabase.from('directory_members').delete().eq('id', member.id);
      if (error) throw error;
      setMemberDeleteConfirm(null);
      setMemberActionStatus(prev => ({ ...prev, [member.id]: 'Account deleted.' }));
      await fetchData();
    } catch (err) {
      setMemberActionMessage(member.id, err.message || 'Failed to delete account.');
    }
  };

  return (
    <>
      <AdminSection title={`Pending Reviews (${pendingMembers.length})`} V={V}>
        {pendingMembers.length === 0 ? (
          <div style={{
            background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 10, padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
              No pending reviews
            </div>
            <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
              All member signups have been reviewed.
            </div>
          </div>
        ) : (
          <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 240px', gap: 12, padding: '8px 16px', background: V.card2 }}>
              {['Member', 'Company', 'Status', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
              ))}
            </div>
            {pendingMembers.map(member => {
              const memberCompany = memberCompanyMap[member.id];
              const actionStatus = memberActionStatus[member.id];
              const isEditingEmail = !!memberEmailEditing[member.id];
              const emailDraft = memberEmailDraft[member.id] ?? member.email ?? '';
              return (
                <div key={member.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 80px 240px',
                  gap: 12, padding: '12px 16px', alignItems: 'center',
                  borderBottom: `1px solid ${V.border}`,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {member.full_name || 'No name'}
                    </div>
                    <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                      {member.email}
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {memberCompany ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {memberCompany.name}
                        </div>
                        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                          {memberCompany.vertical} {memberCompany.city ? `\u00b7 ${memberCompany.city}` : ''}
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: V.dim, fontFamily: V.space }}>No company</span>
                    )}
                  </div>
                  <div>
                    <span style={{
                      background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.4)', color: '#FDE68A',
                      fontSize: 10, fontWeight: 700, fontFamily: V.mono,
                      padding: '2px 7px', borderRadius: 3,
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      pending
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => handleMemberAction(member.id, 'approve')} style={{
                        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                        color: '#86EFAC', borderRadius: 5, padding: '4px 10px', fontSize: 11,
                        fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                      }}>
                        Approve
                      </button>
                      <button onClick={() => handleMemberAction(member.id, 'reject')} style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#FCA5A5', borderRadius: 5, padding: '4px 10px', fontSize: 11,
                        fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                      }}>
                        Reject
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => handleMemberUpgrade(member)} style={{
                        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                        color: '#93C5FD', borderRadius: 5, padding: '4px 10px', fontSize: 11,
                        fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                      }}>
                        Upgrade to Paid
                      </button>
                      <button onClick={() => {
                        setMemberEmailEditing(prev => ({ ...prev, [member.id]: !prev[member.id] }));
                        setMemberEmailDraft(prev => ({ ...prev, [member.id]: prev[member.id] ?? member.email ?? '' }));
                        setMemberActionMessage(member.id, '');
                      }} style={{
                        background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.35)',
                        color: '#D8B4FE', borderRadius: 5, padding: '4px 10px', fontSize: 11,
                        fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                      }}>
                        Change Email
                      </button>
                      <button onClick={() => setMemberDeleteConfirm(member)} style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#FCA5A5', borderRadius: 5, padding: '4px 10px', fontSize: 11,
                        fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                      }}>
                        Delete Account
                      </button>
                    </div>
                    {isEditingEmail && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          type="email"
                          value={emailDraft}
                          onChange={e => setMemberEmailDraft(prev => ({ ...prev, [member.id]: e.target.value }))}
                          placeholder="New email"
                          style={{
                            background: V.card2, border: `1px solid ${V.border}`,
                            color: V.text, borderRadius: 6, padding: '8px 10px', fontSize: 12,
                            fontFamily: V.space, width: '100%',
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => handleMemberEmailSave(member)} style={{
                            background: V.accent, border: 'none', color: '#fff', borderRadius: 5,
                            padding: '5px 10px', fontSize: 11, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                          }}>
                            Save
                          </button>
                          <button onClick={() => {
                            setMemberEmailEditing(prev => ({ ...prev, [member.id]: false }));
                            setMemberEmailDraft(prev => ({ ...prev, [member.id]: member.email ?? '' }));
                            setMemberActionMessage(member.id, '');
                          }} style={{
                            background: 'transparent', border: `1px solid ${V.border}`, color: V.dim, borderRadius: 5,
                            padding: '5px 10px', fontSize: 11, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                          }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {actionStatus && (
                      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.space }}>{actionStatus}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AdminSection>

      {/* Delete confirmation modal */}
      {memberDeleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(7,10,18,0.78)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            width: '100%', maxWidth: 460, background: V.card, border: `1px solid ${V.border}`,
            borderRadius: 14, padding: 24, boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: V.syne, color: V.text, marginBottom: 10 }}>
              Delete account?
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: V.muted, fontFamily: V.space, marginBottom: 18 }}>
              Are you sure you want to delete the account for {memberDeleteConfirm.full_name || memberDeleteConfirm.email}? This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setMemberDeleteConfirm(null)} style={{
                background: 'transparent', border: `1px solid ${V.border}`, color: V.dim,
                borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 700,
                fontFamily: V.space, cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={handleMemberDelete} style={{
                background: '#DC2626', border: 'none', color: '#fff', borderRadius: 8,
                padding: '10px 14px', fontSize: 12, fontWeight: 700,
                fontFamily: V.space, cursor: 'pointer',
              }}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
