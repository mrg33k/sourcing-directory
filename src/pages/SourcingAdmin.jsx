import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
const SourcingCreate = lazy(() => import('./SourcingCreate.jsx'));
const SourcingSettings = lazy(() => import('./SourcingSettings.jsx'));
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';

// ─── Scout Chat Panel ─────────────────────────────────────────────────────────
function ScoutPanel({ V, tenantId }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [toolPills, setToolPills] = useState({}); // msgId -> [pill labels]
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', text };
    const assistantId = Date.now() + 1;
    const assistantMsg = { id: assistantId, role: 'assistant', text: '', pills: [] };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    try {
      const res = await fetch('/api/sourcing/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: 'admin', tenantId: tenantId || null }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, text: m.text + event.text } : m
              ));
            } else if (event.type === 'tool_call') {
              const label = event.name.replace(/_/g, ' ');
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, pills: [...(m.pills || []), label] } : m
              ));
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, text: `Error: ${err.message}` } : m
      ));
    } finally {
      setStreaming(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Scout -- AI Directory Manager"
        style={{
          position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
          width: 52, height: 52, borderRadius: '50%',
          background: '#E85D26', border: 'none',
          boxShadow: '0 4px 20px rgba(232,93,38,0.45)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(232,93,38,0.55)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(232,93,38,0.45)'; }}
      >
        {open ? (
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" fill="none" stroke="#fff" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 400,
          background: '#0F1117', borderLeft: '1px solid rgba(255,255,255,0.08)',
          zIndex: 999, display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#22C55E', boxShadow: '0 0 6px #22C55E',
            }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'Inter Tight', Inter, sans-serif", letterSpacing: '-0.01em' }}>
              Scout
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace", marginLeft: 2 }}>
              directory manager
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, fontFamily: "'Space Grotesk', sans-serif", textAlign: 'center', marginTop: 40, lineHeight: 1.6 }}>
                Tell me what to do.<br/>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
                  "Create a directory for Arizona Biotech Council and seed it with 15 companies"
                </span>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {/* Tool call pills */}
                {msg.role === 'assistant' && msg.pills && msg.pills.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 2 }}>
                    {msg.pills.map((pill, i) => (
                      <span key={i} style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: 10, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                        padding: '2px 8px', borderRadius: 3,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {pill}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{
                  maxWidth: '88%',
                  background: msg.role === 'user' ? '#E85D26' : 'rgba(255,255,255,0.05)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '3px 12px 12px 12px',
                  padding: '9px 13px',
                  fontSize: 13, color: '#fff',
                  fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.text || (msg.role === 'assistant' && streaming ? (
                    <span style={{ opacity: 0.5 }}>...</span>
                  ) : '')}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Tell Scout what to do..."
                rows={2}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '9px 12px',
                  color: '#fff', fontSize: 13,
                  fontFamily: "'Space Grotesk', sans-serif",
                  resize: 'none', lineHeight: 1.4, outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={streaming || !input.trim()}
                style={{
                  background: streaming || !input.trim() ? 'rgba(232,93,38,0.3)' : '#E85D26',
                  border: 'none', borderRadius: 8,
                  width: 38, height: 38, flexShrink: 0,
                  cursor: streaming || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <svg width="16" height="16" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Auth is handled via Supabase Auth (email + password)

// Admin client — uses service role key if available (bypasses RLS), falls back to anon
// VITE_SOURCING_ADMIN_KEY should be set to service role key in Vercel env vars
const _adminKey = import.meta.env.VITE_SOURCING_ADMIN_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const _sbUrl = import.meta.env.VITE_SUPABASE_URL;
const adminSupabase = (_sbUrl && _adminKey)
  ? createClient(_sbUrl, _adminKey)
  : supabase;

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub, V }) {
  return (
    <div style={{
      background: V.card, border: `1px solid ${V.border}`,
      borderRadius: 10, padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, fontFamily: V.mono, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: V.syne, color: color || V.heading, lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: V.dim, fontFamily: V.space, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function AdminSection({ title, children, action, V }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${V.border}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const colors = {
    active:  { bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.4)',   text: '#86EFAC' },
    pending: { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.4)',   text: '#FDE68A' },
    expired: { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
    inactive:{ bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.4)',   text: '#FCA5A5' },
    sold:    { bg: 'rgba(138,132,124,0.1)', border: 'rgba(138,132,124,0.4)', text: '#8A847C' },
  };
  const c = colors[status] || colors.inactive;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      {status}
    </span>
  );
}

// ─── Company Row ──────────────────────────────────────────────────────────────
function CompanyRow({ company, onAction, refreshing, V }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px',
      gap: 12, padding: '12px 16px', alignItems: 'center',
      borderBottom: `1px solid ${V.border}`,
      opacity: refreshing ? 0.5 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {company.name}
        </div>
        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
          {company.vertical} · {[company.city, company.state].filter(Boolean).join(', ')}
        </div>
      </div>
      <div><StatusPill status={company.status} /></div>
      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{company.membership_tier}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {company.status === 'pending' && (
          <button onClick={() => onAction(company.id, 'approve')} style={{
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
            color: '#86EFAC', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Approve
          </button>
        )}
        {company.status === 'active' && (
          <button onClick={() => onAction(company.id, 'deactivate')} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Deactivate
          </button>
        )}
        {!company.featured && company.status === 'active' && (
          <button onClick={() => onAction(company.id, 'feature')} style={{
            background: V.accentDim, border: `1px solid ${V.accentBrd}`,
            color: V.accent, borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Feature
          </button>
        )}
        {company.featured && (
          <button onClick={() => onAction(company.id, 'unfeature')} style={{
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${V.border}`,
            color: V.muted, borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
          }}>
            Unfeature
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Listing Row ──────────────────────────────────────────────────────────────
function ListingRow({ listing, company, onToggle, V }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 70px 80px',
      gap: 12, padding: '10px 16px', alignItems: 'center',
      borderBottom: `1px solid ${V.border}`,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: V.space, color: V.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {listing.title}
        </div>
        <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>{company?.name || 'Unknown'} · {listing.category}</div>
      </div>
      <div><StatusPill status={listing.status} /></div>
      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
        {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      <div>
        {listing.status === 'active' ? (
          <button onClick={() => onToggle(listing.id, 'deactivate')} style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Remove
          </button>
        ) : (
          <button onClick={() => onToggle(listing.id, 'activate')} style={{
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
            color: '#86EFAC', borderRadius: 5, padding: '4px 8px', fontSize: 11,
            fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
          }}>
            Restore
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inner Component ──────────────────────────────────────────────────────────
function SourcingAdminInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Detect admin sub-routes
  const isNew = location.pathname === '/sourcing/admin/new';
  const isSettings = location.pathname.startsWith('/sourcing/admin/settings/');

  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState(''); // '' | 'sent' | 'error:msg'
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [newPwInput, setNewPwInput] = useState('');
  const [newPwError, setNewPwError] = useState('');
  const [newPwLoading, setNewPwLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');

  // Tenant switcher state
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(null); // null = global mode
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || null;

  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [listings, setListings] = useState([]);
  const [companyMap, setCompanyMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({});
  const [exportStatus, setExportStatus] = useState('');
  const [listingFilter, setListingFilter] = useState('all');
  const [pendingMembers, setPendingMembers] = useState([]);
  const [memberCompanyMap, setMemberCompanyMap] = useState({});
  const [pendingArticles, setPendingArticles] = useState([]);
  const [articleCompanyMap, setArticleCompanyMap] = useState({});

  // Analytics + Messages state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [expandedContact, setExpandedContact] = useState(null);

  // Quick Add Company
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [addCompanyForm, setAddCompanyForm] = useState({
    name: '', website: '', city: '', vertical: 'semiconductor',
    description: '', employee_count: '', year_founded: '', email: '', phone: '',
    membership_tier: 'free', featured: false,
  });
  const [addCompanyStatus, setAddCompanyStatus] = useState('');

  // Create Organization
  const [showAddOrg, setShowAddOrg] = useState(false);
  const [addOrgForm, setAddOrgForm] = useState({
    name: '', website: '', vertical: 'semiconductor', description: '',
  });
  const [addOrgStatus, setAddOrgStatus] = useState('');

  // CSV Import
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // { headers, rows }
  const [importStatus, setImportStatus] = useState('');
  const importFileRef = useRef(null);

  // Check existing Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthed(true);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setShowNewPw(true);
      } else {
        setAuthed(!!session);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setPwError('');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput, password: pwInput });
    setAuthLoading(false);
    if (error) {
      setPwError(error.message || 'Login failed.');
    } else {
      setAuthed(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthed(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotStatus('');
    try {
      const resp = await fetch('/api/sourcing/reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail,
          org_name: selectedTenant?.name || 'AOM Sourcing Directory',
          redirect_to: window.location.origin + '/sourcing/admin',
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setForgotStatus('error:' + (data.error || 'Failed to send reset email.'));
      } else {
        setForgotStatus('sent');
      }
    } catch (err) {
      setForgotStatus('error:' + (err.message || 'Failed to send reset email.'));
    }
    setForgotLoading(false);
  };

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setNewPwError('');
    if (!newPwInput) { setNewPwError('Please enter a new password.'); return; }
    setNewPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPwInput });
    setNewPwLoading(false);
    if (error) {
      setNewPwError(error.message || 'Failed to update password.');
    } else {
      setShowNewPw(false);
      setNewPwInput('');
    }
  };

  // Fetch tenants list
  useEffect(() => {
    async function loadTenants() {
      if (!adminSupabase) return;
      try {
        const { data } = await adminSupabase.from('directory_tenants').select('*').order('name');
        setTenants(data || []);
      } catch { /* ignore */ }
    }
    if (authed) loadTenants();
  }, [authed]);

  const fetchData = useCallback(async () => {
    if (!adminSupabase) return;
    setLoading(true);
    try {
      let compQ = adminSupabase.from('directory_companies').select('*').order('created_at', { ascending: false });
      let orgsQ = adminSupabase.from('directory_organizations').select('*').order('name');
      let listQ = adminSupabase.from('directory_listings').select('*').order('created_at', { ascending: false }).limit(200);
      // Scope to tenant if selected
      if (selectedTenantId) {
        compQ = compQ.eq('tenant_id', selectedTenantId);
        orgsQ = orgsQ.eq('tenant_id', selectedTenantId);
        listQ = listQ.eq('tenant_id', selectedTenantId);
      }
      // Fetch pending members too
      let membersQ = adminSupabase.from('directory_members').select('*').eq('status', 'pending').order('created_at', { ascending: false });
      if (selectedTenantId) {
        membersQ = membersQ.eq('tenant_id', selectedTenantId);
      }

      // Fetch pending articles
      let articlesQ = adminSupabase.from('directory_listings').select('*').eq('category', 'article').eq('status', 'pending').order('created_at', { ascending: false });
      if (selectedTenantId) {
        articlesQ = articlesQ.eq('tenant_id', selectedTenantId);
      }

      const [compRes, orgsRes, listingsRes, membersRes, articlesRes] = await Promise.all([compQ, orgsQ, listQ, membersQ, articlesQ]);

      const allCompanies = compRes.data || [];
      const allListings = listingsRes.data || [];
      const allPendingMembers = membersRes.data || [];
      const allPendingArticles = articlesRes.data || [];

      setCompanies(allCompanies);
      setOrgs(orgsRes.data || []);
      setListings(allListings);
      setPendingMembers(allPendingMembers);
      setPendingArticles(allPendingArticles);

      const map = {};
      allCompanies.forEach(c => { map[c.id] = c; });
      setCompanyMap(map);

      // Build member -> company map
      const mcMap = {};
      allPendingMembers.forEach(m => {
        if (m.company_id && map[m.company_id]) {
          mcMap[m.id] = map[m.company_id];
        }
      });
      setMemberCompanyMap(mcMap);

      // Build article -> company map
      const acMap = {};
      allPendingArticles.forEach(a => {
        if (a.company_id && map[a.company_id]) {
          acMap[a.id] = map[a.company_id];
        }
      });
      setArticleCompanyMap(acMap);

      const byVertical = {};
      allCompanies.forEach(c => {
        if (!byVertical[c.vertical]) byVertical[c.vertical] = 0;
        byVertical[c.vertical]++;
      });
      const byCategory = {};
      allListings.forEach(l => {
        if (!byCategory[l.category]) byCategory[l.category] = 0;
        byCategory[l.category]++;
      });

      setStats({
        totalCompanies: allCompanies.length,
        pendingCompanies: allCompanies.filter(c => c.status === 'pending').length,
        activeCompanies: allCompanies.filter(c => c.status === 'active').length,
        totalListings: allListings.length,
        activeListings: allListings.filter(l => l.status === 'active').length,
        byVertical,
        byCategory,
        totalOrgs: orgsRes.data?.length || 0,
      });
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData, selectedTenantId]);

  const fetchAnalytics = useCallback(async () => {
    if (!adminSupabase || !selectedTenantId) { setAnalyticsData(null); return; }
    try {
      const now = new Date();
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [weekViews, monthViews, recentSearches, profileViews] = await Promise.all([
        adminSupabase
          .from('directory_analytics')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', selectedTenantId)
          .eq('event_type', 'page_view')
          .gte('created_at', weekAgo),
        adminSupabase
          .from('directory_analytics')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', selectedTenantId)
          .eq('event_type', 'page_view')
          .gte('created_at', monthAgo),
        adminSupabase
          .from('directory_analytics')
          .select('metadata, created_at')
          .eq('tenant_id', selectedTenantId)
          .eq('event_type', 'search')
          .order('created_at', { ascending: false })
          .limit(20),
        adminSupabase
          .from('directory_analytics')
          .select('company_id')
          .eq('tenant_id', selectedTenantId)
          .eq('event_type', 'profile_view')
          .gte('created_at', monthAgo),
      ]);

      // Top companies by profile view count
      const viewCounts = {};
      (profileViews.data || []).forEach(r => {
        if (r.company_id) viewCounts[r.company_id] = (viewCounts[r.company_id] || 0) + 1;
      });
      const topCompanyIds = Object.entries(viewCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id, count]) => ({ id, count }));

      setAnalyticsData({
        pageViewsWeek: weekViews.count || 0,
        pageViewsMonth: monthViews.count || 0,
        recentSearches: recentSearches.data || [],
        topCompanies: topCompanyIds,
      });
    } catch (err) {
      console.error('Analytics fetch error:', err);
    }
  }, [selectedTenantId]);

  const fetchContacts = useCallback(async () => {
    if (!adminSupabase || !selectedTenantId) { setContacts([]); return; }
    try {
      const { data } = await adminSupabase
        .from('directory_contacts')
        .select('*')
        .eq('tenant_id', selectedTenantId)
        .order('created_at', { ascending: false })
        .limit(100);
      setContacts(data || []);
    } catch (err) {
      console.error('Contacts fetch error:', err);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (authed && selectedTenantId) {
      fetchAnalytics();
      fetchContacts();
    }
  }, [authed, selectedTenantId, fetchAnalytics, fetchContacts]);

  const handleContactStatusUpdate = async (id, status) => {
    if (!adminSupabase) return;
    await adminSupabase.from('directory_contacts').update({ status }).eq('id', id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleCompanyAction = async (id, action) => {
    if (!adminSupabase) return;
    setRefreshing(prev => ({ ...prev, [id]: true }));
    try {
      const updates = {
        approve:    { status: 'active' },
        deactivate: { status: 'inactive' },
        feature:    { featured: true },
        unfeature:  { featured: false },
      };
      await adminSupabase.from('directory_companies').update(updates[action]).eq('id', id);
      await fetchData();
    } catch (err) {
      console.error('Company action error:', err);
    } finally {
      setRefreshing(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleApproveAll = async () => {
    if (!adminSupabase) return;
    const pending = companies.filter(c => c.status === 'pending').map(c => c.id);
    if (pending.length === 0) return;
    await Promise.all(pending.map(id =>
      adminSupabase.from('directory_companies').update({ status: 'active' }).eq('id', id)
    ));
    await fetchData();
  };

  const handleListingToggle = async (id, action) => {
    if (!adminSupabase) return;
    const status = action === 'activate' ? 'active' : 'expired';
    await adminSupabase.from('directory_listings').update({ status }).eq('id', id);
    await fetchData();
  };

  const handleMemberAction = async (memberId, action) => {
    if (!adminSupabase) return;
    try {
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      await adminSupabase.from('directory_members').update({ status: newStatus }).eq('id', memberId);

      // If approving, also activate their company
      if (action === 'approve') {
        const member = pendingMembers.find(m => m.id === memberId);
        if (member?.company_id) {
          await adminSupabase.from('directory_companies').update({ status: 'active' }).eq('id', member.company_id);
        }
      }

      await fetchData();
    } catch (err) {
      console.error('Member action error:', err);
    }
  };

  const handleArticleAction = async (articleId, action) => {
    if (!adminSupabase) return;
    try {
      const newStatus = action === 'approve' ? 'active' : 'rejected';
      const { data: { user } } = await adminSupabase.auth.getUser();
      const moderatedBy = user?.email || 'admin';
      await adminSupabase.from('directory_listings').update({
        status: newStatus,
        moderated_at: new Date().toISOString(),
        moderated_by: moderatedBy,
      }).eq('id', articleId);
      await fetchData();
    } catch (err) {
      console.error('Article action error:', err);
    }
  };

  const handleExportCSV = async () => {
    // Fetch certs for all companies to include in export
    let certsMap = {};
    if (adminSupabase && companies.length > 0) {
      const ids = companies.map(c => c.id);
      const { data: certsData } = await adminSupabase
        .from('directory_certifications')
        .select('*')
        .in('company_id', ids);
      (certsData || []).forEach(cert => {
        if (!certsMap[cert.company_id]) certsMap[cert.company_id] = [];
        certsMap[cert.company_id].push(cert.cert_name);
      });
    }

    const headers = ['name', 'description', 'website', 'phone', 'email', 'city', 'state', 'vertical', 'employee_count', 'membership_tier', 'status', 'featured', 'year_founded', 'certifications'];
    const rows = [headers];
    companies.forEach(c => {
      const certList = (certsMap[c.id] || []).join(';');
      rows.push([
        c.name || '',
        c.description || '',
        c.website || '',
        c.phone || '',
        c.email || '',
        c.city || '',
        c.state || '',
        c.vertical || '',
        c.employee_count || '',
        c.membership_tier || '',
        c.status || '',
        c.featured ? 'true' : 'false',
        c.year_founded || '',
        certList,
      ]);
    });
    const csvStr = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const tenantSlug = selectedTenant?.slug || 'all';
    const date = new Date().toISOString().slice(0, 10);
    a.download = `${tenantSlug}-companies-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus('Downloaded');
    setTimeout(() => setExportStatus(''), 3000);
  };

  // ─── CSV Parser (no external library) ──────────────────────────────────────
  const parseCSV = (text) => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parseRow = (line) => {
      const fields = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          fields.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      fields.push(cur.trim());
      return fields;
    };
    const nonEmpty = lines.filter(l => l.trim());
    if (nonEmpty.length < 2) return null;
    const headers = parseRow(nonEmpty[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const rows = nonEmpty.slice(1).map(l => {
      const vals = parseRow(l);
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
    return { headers, rows };
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      if (!parsed) { setImportStatus('Could not parse CSV.'); return; }
      setImportPreview(parsed);
      setImportStatus('');
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!adminSupabase || !importPreview || !selectedTenantId) return;
    const { rows } = importPreview;
    let imported = 0;
    let skipped = 0;
    const skippedNames = [];

    setImportStatus(`Importing 0 of ${rows.length} companies...`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name || !row.name.trim()) { skipped++; skippedNames.push(`Row ${i + 2}: missing name`); continue; }

      const slug = row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now() + '-' + i;
      const insertData = {
        name: row.name.trim(),
        slug,
        description: row.description || null,
        website: row.website || null,
        phone: row.phone || null,
        email: row.email || null,
        city: row.city || null,
        state: row.state || null,
        vertical: row.vertical || 'other',
        employee_count: row.employee_count || null,
        membership_tier: row.membership_tier || 'free',
        status: 'active',
        tenant_id: selectedTenantId,
        country: 'US',
      };

      const { data: inserted, error } = await adminSupabase
        .from('directory_companies')
        .insert(insertData)
        .select('id')
        .single();

      if (error) { skipped++; skippedNames.push(`Row ${i + 2}: ${error.message}`); continue; }

      // Handle certifications
      if (row.certifications && row.certifications.trim() && inserted?.id) {
        const certNames = row.certifications.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        if (certNames.length > 0) {
          await adminSupabase.from('directory_certifications').insert(
            certNames.map(cert_name => ({ company_id: inserted.id, cert_name, tenant_id: selectedTenantId }))
          );
        }
      }

      imported++;
      setImportStatus(`Importing ${imported} of ${rows.length} companies...`);
    }

    let summary = `Done. Imported ${imported} of ${rows.length} companies.`;
    if (skipped > 0) summary += ` Skipped ${skipped}: ${skippedNames.slice(0, 3).join('; ')}${skippedNames.length > 3 ? '...' : ''}`;
    setImportStatus(summary);
    setImportPreview(null);
    if (importFileRef.current) importFileRef.current.value = '';
    await fetchData();
  };

  const handleAddCompany = async (e) => {
    e.preventDefault();
    if (!adminSupabase) return;
    setAddCompanyStatus('Saving...');
    const slug = addCompanyForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const orgId = orgs.find(o => o.vertical === addCompanyForm.vertical)?.id || null;
    const { error } = await adminSupabase.from('directory_companies').insert({
      name: addCompanyForm.name,
      slug,
      website: addCompanyForm.website || null,
      city: addCompanyForm.city || null,
      state: 'AZ',
      country: 'US',
      vertical: addCompanyForm.vertical,
      description: addCompanyForm.description || null,
      employee_count: addCompanyForm.employee_count || null,
      year_founded: addCompanyForm.year_founded ? parseInt(addCompanyForm.year_founded) : null,
      email: addCompanyForm.email || null,
      phone: addCompanyForm.phone || null,
      membership_tier: addCompanyForm.membership_tier,
      featured: addCompanyForm.featured,
      status: 'active',
      organization_id: orgId,
      ...(selectedTenantId ? { tenant_id: selectedTenantId } : {}),
    });
    if (error) {
      setAddCompanyStatus('Error: ' + error.message);
    } else {
      setAddCompanyStatus('Added!');
      setAddCompanyForm({ name: '', website: '', city: '', vertical: 'semiconductor', description: '', employee_count: '', year_founded: '', email: '', phone: '', membership_tier: 'free', featured: false });
      setTimeout(() => { setAddCompanyStatus(''); setShowAddCompany(false); }, 1500);
      await fetchData();
    }
  };

  const handleAddOrg = async (e) => {
    e.preventDefault();
    if (!adminSupabase) return;
    setAddOrgStatus('Saving...');
    const slug = addOrgForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { error } = await adminSupabase.from('directory_organizations').insert({
      name: addOrgForm.name,
      slug,
      website: addOrgForm.website || null,
      vertical: addOrgForm.vertical,
      description: addOrgForm.description || null,
      membership_tiers: [],
      ...(selectedTenantId ? { tenant_id: selectedTenantId } : {}),
    });
    if (error) {
      setAddOrgStatus('Error: ' + error.message);
    } else {
      setAddOrgStatus('Created!');
      setAddOrgForm({ name: '', website: '', vertical: 'semiconductor', description: '' });
      setTimeout(() => { setAddOrgStatus(''); setShowAddOrg(false); }, 1500);
      await fetchData();
    }
  };

  const filteredListings = listingFilter === 'all'
    ? listings
    : listings.filter(l => l.category === listingFilter);

  const pendingCompanies = companies.filter(c => c.status === 'pending');

  // ─── Password reset callback (user landed from reset email) ─────────────
  if (showNewPw) {
    return (
      <div style={{ minHeight: '100vh', background: V.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{`* { box-sizing: border-box; } input::placeholder { color: ${V.dim}; } input:focus { border-color: ${V.accentBrd} !important; outline: none; }`}</style>
        <div style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 380,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
              sourcing.directory
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: V.syne, color: V.heading }}>Set New Password</div>
          </div>
          <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>New Password</label>
              <input
                type="password"
                value={newPwInput}
                onChange={e => setNewPwInput(e.target.value)}
                placeholder="Enter new password"
                autoFocus
                required
                style={{
                  background: V.card2, border: `1px solid ${V.border}`,
                  color: V.text, borderRadius: 7, padding: '10px 12px',
                  fontSize: 14, fontFamily: V.mono, width: '100%',
                }}
              />
            </div>
            {newPwError && <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space }}>{newPwError}</div>}
            <button type="submit" disabled={newPwLoading} style={{
              background: V.accent, border: 'none', color: '#fff',
              borderRadius: 8, padding: '12px 0', fontSize: 14,
              fontWeight: 700, fontFamily: V.space, cursor: newPwLoading ? 'not-allowed' : 'pointer',
              opacity: newPwLoading ? 0.7 : 1,
            }}>
              {newPwLoading ? 'Saving...' : 'Save Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Login gate ───────────────────────────────────────────────────────────
  if (!authed) {
    if (authLoading) {
      return <div style={{ minHeight: '100vh', background: V.bg }} />;
    }
    return (
      <div style={{ minHeight: '100vh', background: V.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <style>{`* { box-sizing: border-box; } input::placeholder { color: ${V.dim}; } input:focus { border-color: ${V.accentBrd} !important; outline: none; }`}</style>
        <div style={{
          background: V.card, border: `1px solid ${V.border}`,
          borderRadius: 12, padding: '36px 32px', width: '100%', maxWidth: 380,
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 11, color: V.accent, fontFamily: V.mono, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
              sourcing.directory
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: V.syne, color: V.heading }}>
              {showForgotPw ? 'Reset Password' : 'Admin Panel'}
            </div>
          </div>

          {showForgotPw ? (
            forgotStatus === 'sent' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, color: V.text, fontFamily: V.space, marginBottom: 20 }}>
                  Check your email for a reset link.
                </div>
                <button
                  type="button"
                  onClick={() => { setShowForgotPw(false); setForgotStatus(''); setForgotEmail(''); }}
                  style={{ background: 'none', border: 'none', color: V.accent, fontFamily: V.space, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>Email</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="admin@example.com"
                    autoFocus
                    required
                    style={{
                      background: V.card2, border: `1px solid ${V.border}`,
                      color: V.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V.mono, width: '100%',
                    }}
                  />
                </div>
                {forgotStatus.startsWith('error:') && (
                  <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space }}>
                    {forgotStatus.slice(6)}
                  </div>
                )}
                <button type="submit" disabled={forgotLoading} style={{
                  background: V.accent, border: 'none', color: '#fff',
                  borderRadius: 8, padding: '12px 0', fontSize: 14,
                  fontWeight: 700, fontFamily: V.space, cursor: forgotLoading ? 'not-allowed' : 'pointer',
                  opacity: forgotLoading ? 0.7 : 1,
                }}>
                  {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <div style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPw(false); setForgotStatus(''); }}
                    style={{ background: 'none', border: 'none', color: V.muted, fontFamily: V.space, fontSize: 13, cursor: 'pointer' }}
                  >
                    Back to sign in
                  </button>
                </div>
              </form>
            )
          ) : (
            <>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>Email</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    placeholder="admin@example.com"
                    autoFocus
                    required
                    style={{
                      background: V.card2, border: `1px solid ${V.border}`,
                      color: V.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V.mono, width: '100%',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 12, color: V.muted, fontFamily: V.space, fontWeight: 600 }}>Password</label>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPw(true); setPwError(''); }}
                      style={{ background: 'none', border: 'none', color: V.accent, fontFamily: V.space, fontSize: 12, cursor: 'pointer', padding: 0 }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={pwInput}
                    onChange={e => setPwInput(e.target.value)}
                    placeholder="Password"
                    required
                    style={{
                      background: V.card2, border: `1px solid ${V.border}`,
                      color: V.text, borderRadius: 7, padding: '10px 12px',
                      fontSize: 14, fontFamily: V.mono, width: '100%',
                    }}
                  />
                </div>
                {pwError && <div style={{ color: '#EF4444', fontSize: 13, fontFamily: V.space }}>{pwError}</div>}
                <button type="submit" disabled={authLoading} style={{
                  background: V.accent, border: 'none', color: '#fff',
                  borderRadius: 8, padding: '12px 0', fontSize: 14,
                  fontWeight: 700, fontFamily: V.space, cursor: authLoading ? 'not-allowed' : 'pointer',
                  opacity: authLoading ? 0.7 : 1,
                }}>
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link to="/sourcing" style={{ fontSize: 13, color: V.muted, fontFamily: V.space, textDecoration: 'none' }}>
                  ← Back to Directory
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Admin Sub-routes (behind the gate) ──────────────────────────────────
  if (isNew) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: V.bg }} />}>
        <SourcingCreate />
      </Suspense>
    );
  }

  if (isSettings) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: V.bg }} />}>
        <SourcingSettings />
      </Suspense>
    );
  }

  // ─── Admin Dashboard ──────────────────────────────────────────────────────
  const newContactCount = contacts.filter(c => c.status === 'new').length;
  const TABS = [
    { key: 'stats',      label: 'Stats' },
    { key: 'companies',  label: `Companies${pendingCompanies.length > 0 ? ` (${pendingCompanies.length} pending)` : ''}` },
    { key: 'members',    label: `Pending Reviews${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}` },
    { key: 'articles',   label: `Pending Articles${pendingArticles.length > 0 ? ` (${pendingArticles.length})` : ''}` },
    { key: 'add',        label: '+ Add Company' },
    { key: 'orgs',       label: 'Organizations' },
    { key: 'listings',   label: 'Listings' },
    { key: 'analytics',  label: 'Analytics' },
    { key: 'messages',   label: `Messages${newContactCount > 0 ? ` (${newContactCount})` : ''}` },
    { key: 'actions',    label: 'Quick Actions' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: V.bg, color: V.text }}>
      <style>{`* { box-sizing: border-box; } a { color: inherit; }`}</style>

      {/* Top bar */}
      <div style={{
        borderBottom: `1px solid ${V.border}`, background: V.navBg,
        padding: '0 24px', display: 'flex', alignItems: 'center', gap: 16, height: 56,
      }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontSize: 13, fontWeight: 800, fontFamily: V.syne, color: V.accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>AOM</span>
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <Link to="/sourcing" style={{ textDecoration: 'none', fontSize: 13, color: V.muted, fontFamily: V.space }}>
          Sourcing Directory
        </Link>
        <span style={{ color: V.dim, fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: V.text, fontFamily: V.space }}>Admin</span>
        <div style={{ flex: 1 }} />
        {/* Tenant switcher */}
        {tenants.length > 0 && (
          <select
            value={selectedTenantId || ''}
            onChange={e => setSelectedTenantId(e.target.value || null)}
            style={{
              background: V.card2, border: `1px solid ${selectedTenantId ? V.accentBrd : V.border}`,
              color: selectedTenantId ? V.accent : V.muted,
              borderRadius: 6, padding: '5px 10px', fontSize: 12,
              fontFamily: V.space, cursor: 'pointer', outline: 'none',
              maxWidth: 220,
            }}
          >
            <option value="">All Directories (Global)</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        {selectedTenant && (
          <button
            onClick={() => navigate(`/sourcing/admin/settings/${selectedTenant.slug}`)}
            style={{
              background: V.accentDim, border: `1px solid ${V.accentBrd}`,
              color: V.accent, borderRadius: 6, padding: '5px 12px',
              fontSize: 12, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Edit Settings
          </button>
        )}
        <button
          onClick={() => navigate('/sourcing/admin/new')}
          style={{
            background: V.accent, border: 'none',
            color: '#fff', borderRadius: 6, padding: '5px 12px',
            fontSize: 12, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          + New Directory
        </button>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent', border: `1px solid ${V.border}`,
            color: V.muted, borderRadius: 6, padding: '5px 12px',
            fontSize: 12, fontFamily: V.space, cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '0 24px', borderBottom: `1px solid ${V.border}`, background: V.navBg, display: 'flex', gap: 0 }}>
        {TABS.map(tab => {
          const isActive = tab.key === activeTab;
          const isPending = (tab.key === 'companies' && pendingCompanies.length > 0) || (tab.key === 'members' && pendingMembers.length > 0) || (tab.key === 'articles' && pendingArticles.length > 0);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none', border: 'none',
                padding: '12px 16px', fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                fontFamily: V.space,
                color: isActive ? V.accent : isPending ? '#FDBA74' : V.muted,
                borderBottom: isActive ? `2px solid ${V.accent}` : '2px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 60px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: V.muted, fontFamily: V.space }}>Loading...</div>
        )}

        {!loading && !adminSupabase && (
          <div style={{ background: V.accentDim, border: `1px solid ${V.accentBrd}`, borderRadius: 8, padding: '24px', textAlign: 'center' }}>
            <div style={{ color: V.accent, fontFamily: V.mono, fontSize: 13, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ color: V.muted, fontFamily: V.space, fontSize: 12 }}>Run migrations 001-003 in Supabase SQL editor to activate the admin panel.</div>
          </div>
        )}

        {/* Stats */}
        {!loading && activeTab === 'stats' && stats && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
              <StatCard label="Total Companies" value={stats.totalCompanies} V={V} />
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
        )}

        {/* Companies */}
        {!loading && activeTab === 'companies' && (
          <AdminSection
            title="Companies"
            V={V}
            action={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {selectedTenantId && (
                  <label style={{
                    background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)',
                    color: '#93C5FD', borderRadius: 6, padding: '6px 14px',
                    fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    Import CSV
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleImportFile}
                      onClick={e => { e.target.value = ''; setImportPreview(null); setImportStatus(''); }}
                    />
                  </label>
                )}
                {pendingCompanies.length > 0 && (
                  <button onClick={handleApproveAll} style={{
                    background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                    color: '#86EFAC', borderRadius: 6, padding: '6px 14px',
                    fontSize: 12, fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    Approve All Pending ({pendingCompanies.length})
                  </button>
                )}
              </div>
            }
          >
            {/* CSV Import Preview */}
            {importPreview && (
              <div style={{ background: V.card, border: `1px solid rgba(59,130,246,0.35)`, borderRadius: 10, padding: '20px', marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 4 }}>
                  Import Preview — {importPreview.rows.length} rows detected
                </div>
                <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
                  Columns: {importPreview.headers.join(', ')}
                </div>
                <div style={{ overflowX: 'auto', marginBottom: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: V.space }}>
                    <thead>
                      <tr style={{ background: V.card2 }}>
                        {['name', 'description', 'website', 'city', 'vertical', 'membership_tier', 'certifications'].map(col => (
                          <th key={col} style={{ padding: '6px 10px', textAlign: 'left', color: V.dim, fontFamily: V.mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${V.border}` }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${V.border}`, opacity: !row.name ? 0.4 : 1 }}>
                          {['name', 'description', 'website', 'city', 'vertical', 'membership_tier', 'certifications'].map(col => (
                            <td key={col} style={{ padding: '7px 10px', color: V.text, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row[col] || <span style={{ color: V.dim }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importPreview.rows.length > 5 && (
                    <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono, padding: '6px 10px' }}>
                      + {importPreview.rows.length - 5} more rows not shown
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button onClick={handleImportConfirm} style={{
                    background: V.accent, border: 'none', color: '#fff',
                    borderRadius: 7, padding: '8px 20px', fontSize: 13,
                    fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                  }}>
                    Import {importPreview.rows.length} Companies
                  </button>
                  <button onClick={() => { setImportPreview(null); setImportStatus(''); }} style={{
                    background: 'transparent', border: `1px solid ${V.border}`,
                    color: V.muted, borderRadius: 7, padding: '8px 16px',
                    fontSize: 13, fontFamily: V.space, cursor: 'pointer',
                  }}>
                    Cancel
                  </button>
                  {importStatus && (
                    <span style={{ fontSize: 12, color: importStatus.startsWith('Error') || importStatus.startsWith('Could') ? '#EF4444' : V.accent, fontFamily: V.space }}>
                      {importStatus}
                    </span>
                  )}
                </div>
              </div>
            )}
            {!importPreview && importStatus && (
              <div style={{ fontSize: 13, color: V.accent, fontFamily: V.space, marginBottom: 14 }}>
                {importStatus}
              </div>
            )}

            {pendingCompanies.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: '#FDBA74', fontFamily: V.mono, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Pending Approval
                </div>
                <div style={{ background: V.card, border: `1px solid rgba(234,179,8,0.2)`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px', gap: 12, padding: '8px 16px', background: V.card2 }}>
                    {['Company', 'Status', 'Tier', 'Actions'].map(h => (
                      <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
                    ))}
                  </div>
                  {pendingCompanies.map(c => (
                    <CompanyRow key={c.id} company={c} onAction={handleCompanyAction} refreshing={refreshing[c.id]} V={V} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 120px', gap: 12, padding: '8px 16px', background: V.card2 }}>
                {['Company', 'Status', 'Tier', 'Actions'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
                ))}
              </div>
              {companies.filter(c => c.status !== 'pending').map(c => (
                <CompanyRow key={c.id} company={c} onAction={handleCompanyAction} refreshing={refreshing[c.id]} V={V} />
              ))}
              {companies.filter(c => c.status !== 'pending').length === 0 && (
                <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>No companies yet.</div>
              )}
            </div>
          </AdminSection>
        )}

        {/* Pending Member Reviews */}
        {!loading && activeTab === 'members' && (
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 140px', gap: 12, padding: '8px 16px', background: V.card2 }}>
                  {['Member', 'Company', 'Status', 'Actions'].map(h => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
                  ))}
                </div>
                {pendingMembers.map(member => {
                  const memberCompany = memberCompanyMap[member.id];
                  return (
                    <div key={member.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 80px 140px',
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
                      <div style={{ display: 'flex', gap: 6 }}>
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
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSection>
        )}

        {/* Pending Articles */}
        {!loading && activeTab === 'articles' && (
          <AdminSection title={`Pending Articles (${pendingArticles.length})`} V={V}>
            {pendingArticles.length === 0 ? (
              <div style={{
                background: V.card, border: `1px solid ${V.border}`,
                borderRadius: 10, padding: '40px 24px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.text, marginBottom: 6 }}>
                  No pending articles
                </div>
                <div style={{ fontSize: 13, color: V.muted, fontFamily: V.space }}>
                  All submitted articles have been reviewed.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingArticles.map(article => {
                  const company = articleCompanyMap[article.id];
                  const postedDate = new Date(article.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={article.id} style={{
                      background: V.card, border: `1px solid rgba(234,179,8,0.2)`,
                      borderRadius: 10, padding: '16px 20px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 4 }}>
                            {article.title}
                          </div>
                          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                              <span style={{ color: V.muted, fontWeight: 600 }}>Author</span>{' '}
                              {company?.name || 'Unknown Company'}
                            </span>
                            <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                              <span style={{ color: V.muted, fontWeight: 600 }}>Submitted</span>{' '}
                              {postedDate}
                            </span>
                            {article.vertical && (
                              <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                                {article.vertical}
                              </span>
                            )}
                            {article.read_time_min && (
                              <span style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                                {article.read_time_min} min read
                              </span>
                            )}
                          </div>
                          {article.excerpt && (
                            <div style={{
                              fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {article.excerpt}
                            </div>
                          )}
                          {!article.excerpt && article.body && (
                            <div style={{
                              fontSize: 13, color: V.muted, fontFamily: V.space, lineHeight: 1.5,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                            }}>
                              {article.body}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                          <button onClick={() => handleArticleAction(article.id, 'approve')} style={{
                            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                            color: '#86EFAC', borderRadius: 6, padding: '6px 14px', fontSize: 12,
                            fontWeight: 700, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                            Approve
                          </button>
                          <button onClick={() => handleArticleAction(article.id, 'reject')} style={{
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#FCA5A5', borderRadius: 6, padding: '6px 14px', fontSize: 12,
                            fontWeight: 700, fontFamily: V.space, cursor: 'pointer', whiteSpace: 'nowrap',
                          }}>
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AdminSection>
        )}

        {/* Add Company */}
        {!loading && activeTab === 'add' && (
          <AdminSection title="Add Company" V={V}>
            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '28px 24px', maxWidth: 600 }}>
              <style>{`input,textarea,select { box-sizing: border-box; } input::placeholder,textarea::placeholder { color: ${V.dim}; } input:focus,textarea:focus,select:focus { outline: none; border-color: ${V.accentBrd} !important; }`}</style>
              <form onSubmit={handleAddCompany} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Company Name *', key: 'name', type: 'text', placeholder: 'e.g. Acme Semiconductors' },
                  { label: 'Website', key: 'website', type: 'url', placeholder: 'https://example.com' },
                  { label: 'City', key: 'city', type: 'text', placeholder: 'e.g. Chandler' },
                  { label: 'Email', key: 'email', type: 'email', placeholder: 'info@example.com' },
                  { label: 'Phone', key: 'phone', type: 'text', placeholder: '(480) 555-0000' },
                  { label: 'Employee Count', key: 'employee_count', type: 'text', placeholder: 'e.g. 50-200' },
                  { label: 'Year Founded', key: 'year_founded', type: 'number', placeholder: '2015' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>{label}</label>
                    <input
                      type={type} placeholder={placeholder} value={addCompanyForm[key]}
                      onChange={e => setAddCompanyForm(f => ({ ...f, [key]: e.target.value }))}
                      required={key === 'name'}
                      style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}
                    />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Description</label>
                  <textarea
                    placeholder="1-2 sentences describing what the company does..."
                    value={addCompanyForm.description}
                    onChange={e => setAddCompanyForm(f => ({ ...f, description: e.target.value }))}
                    rows={3}
                    style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space, resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Vertical</label>
                    <select value={addCompanyForm.vertical} onChange={e => setAddCompanyForm(f => ({ ...f, vertical: e.target.value }))}
                      style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}>
                      <option value="semiconductor">Semiconductor</option>
                      <option value="space">Space / Aerospace</option>
                      <option value="biotech">Biotech</option>
                      <option value="defense">Defense</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 5 }}>Membership Tier</label>
                    <select value={addCompanyForm.membership_tier} onChange={e => setAddCompanyForm(f => ({ ...f, membership_tier: e.target.value }))}
                      style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 7, padding: '9px 12px', fontSize: 13, fontFamily: V.space }}>
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="featured-cb" checked={addCompanyForm.featured} onChange={e => setAddCompanyForm(f => ({ ...f, featured: e.target.checked }))} style={{ accentColor: V.accent, width: 16, height: 16 }} />
                  <label htmlFor="featured-cb" style={{ fontSize: 13, fontFamily: V.space, color: V.muted, cursor: 'pointer' }}>Mark as featured (shows first in directory)</label>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 4 }}>
                  <button type="submit" style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>
                    Add Company
                  </button>
                  {addCompanyStatus && (
                    <span style={{ fontSize: 13, fontFamily: V.space, color: addCompanyStatus.startsWith('Error') ? '#EF4444' : V.accent }}>
                      {addCompanyStatus}
                    </span>
                  )}
                </div>
              </form>
            </div>
          </AdminSection>
        )}

        {/* Organizations */}
        {!loading && activeTab === 'orgs' && (
          <AdminSection
            title="Organizations"
            V={V}
            action={
              <button onClick={() => setShowAddOrg(s => !s)} style={{
                background: showAddOrg ? V.accentDim : 'transparent',
                border: `1px solid ${showAddOrg ? V.accentBrd : V.border}`,
                color: showAddOrg ? V.accent : V.muted,
                borderRadius: 6, padding: '6px 14px', fontSize: 12,
                fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
              }}>
                {showAddOrg ? 'Cancel' : '+ New Organization'}
              </button>
            }
          >
            {showAddOrg && (
              <div style={{ background: V.card, border: `1px solid ${V.accentBrd}`, borderRadius: 10, padding: '20px 20px', marginBottom: 20, maxWidth: 500 }}>
                <style>{`input,textarea,select { box-sizing: border-box; }`}</style>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 14 }}>New Organization</div>
                <form onSubmit={handleAddOrg} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'Name *', key: 'name', placeholder: 'e.g. AZ Biotech Alliance' },
                    { label: 'Website', key: 'website', placeholder: 'https://example.org' },
                    { label: 'Description', key: 'description', placeholder: 'What this org does...' },
                  ].map(({ label, key, placeholder }) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 4 }}>{label}</label>
                      <input
                        type="text" placeholder={placeholder} value={addOrgForm[key]}
                        onChange={e => setAddOrgForm(f => ({ ...f, [key]: e.target.value }))}
                        required={key === 'name'}
                        style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: V.space }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, fontFamily: V.space, color: V.muted, marginBottom: 4 }}>Vertical</label>
                    <select value={addOrgForm.vertical} onChange={e => setAddOrgForm(f => ({ ...f, vertical: e.target.value }))}
                      style={{ width: '100%', background: V.card2, border: `1px solid ${V.border}`, color: V.text, borderRadius: 6, padding: '8px 11px', fontSize: 13, fontFamily: V.space }}>
                      <option value="semiconductor">Semiconductor</option>
                      <option value="space">Space / Aerospace</option>
                      <option value="biotech">Biotech</option>
                      <option value="defense">Defense</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button type="submit" style={{ background: V.accent, border: 'none', color: '#fff', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 700, fontFamily: V.space, cursor: 'pointer' }}>
                      Create Organization
                    </button>
                    {addOrgStatus && <span style={{ fontSize: 13, fontFamily: V.space, color: addOrgStatus.startsWith('Error') ? '#EF4444' : V.accent }}>{addOrgStatus}</span>}
                  </div>
                </form>
              </div>
            )}
            <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 12, padding: '8px 16px', background: V.card2 }}>
                {['Organization', 'Vertical', 'Members'].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, fontFamily: V.mono, color: V.dim, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{h}</div>
                ))}
              </div>
              {orgs.map(org => {
                const tiers = Array.isArray(org.membership_tiers) ? org.membership_tiers : [];
                const memberCount = companies.filter(c => c.organization_id === org.id).length;
                return (
                  <div key={org.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 100px 100px',
                    gap: 12, padding: '12px 16px', alignItems: 'center',
                    borderBottom: `1px solid ${V.border}`,
                  }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: V.space, color: V.text }}>{org.name}</div>
                      <div style={{ fontSize: 11, color: V.dim, fontFamily: V.mono }}>
                        {memberCount} member{memberCount !== 1 ? 's' : ''}
                        {org.website && <> · <a href={org.website} target="_blank" rel="noreferrer" style={{ color: '#3B82F6', textDecoration: 'none' }}>site</a></>}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: V.muted, fontFamily: V.mono, textTransform: 'capitalize' }}>{org.vertical}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.mono, color: V.accent }}>{memberCount}</div>
                  </div>
                );
              })}
              {orgs.length === 0 && (
                <div style={{ padding: '24px 16px', color: V.dim, fontSize: 13, fontFamily: V.space }}>No organizations yet.</div>
              )}
            </div>
          </AdminSection>
        )}

        {/* Listings */}
        {!loading && activeTab === 'listings' && (
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
        )}

        {/* Analytics */}
        {!loading && activeTab === 'analytics' && (
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
                      analyticsData.topCompanies.map(({ id, count }) => {
                        const co = companyMap[id];
                        return (
                          <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${V.border}` }}>
                            <span style={{ fontSize: 13, color: V.text, fontFamily: V.space, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              {co?.name || id.slice(0, 8) + '...'}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: V.mono, color: V.accent, flexShrink: 0, marginLeft: 8 }}>
                              {count}
                            </span>
                          </div>
                        );
                      })
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
        )}

        {/* Messages */}
        {!loading && activeTab === 'messages' && (
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
        )}

        {/* Quick Actions */}
        {!loading && activeTab === 'actions' && (
          <AdminSection title="Quick Actions" V={V}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {pendingCompanies.length > 0 && (
                <div style={{ background: V.card, border: `1px solid rgba(234,179,8,0.25)`, borderRadius: 10, padding: '18px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
                    Approve Pending ({pendingCompanies.length})
                  </div>
                  <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
                    Approve all companies waiting for review.
                  </div>
                  <button onClick={handleApproveAll} style={{
                    width: '100%', background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.4)', color: '#86EFAC',
                    borderRadius: 7, padding: '9px 0', fontSize: 13,
                    fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                  }}>
                    Approve All
                  </button>
                </div>
              )}

              <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
                  Export Companies CSV
                </div>
                <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
                  Download all company data + certifications as CSV.
                </div>
                <button onClick={handleExportCSV} style={{
                  width: '100%', background: V.accent,
                  border: 'none', color: '#fff',
                  borderRadius: 7, padding: '9px 0', fontSize: 13,
                  fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                }}>
                  {exportStatus || 'Export CSV'}
                </button>
              </div>

              {selectedTenantId && (
                <div style={{ background: V.card, border: `1px solid rgba(59,130,246,0.25)`, borderRadius: 10, padding: '18px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
                    Import Companies CSV
                  </div>
                  <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
                    Bulk-import companies from a CSV file with preview.
                  </div>
                  <button onClick={() => setActiveTab('companies')} style={{
                    width: '100%', background: 'rgba(59,130,246,0.12)',
                    border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD',
                    borderRadius: 7, padding: '9px 0', fontSize: 13,
                    fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                  }}>
                    Go to Companies
                  </button>
                </div>
              )}

              <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
                  Add Organization
                </div>
                <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
                  Create a new industry vertical org (biotech, defense, etc.)
                </div>
                <button onClick={() => setActiveTab('orgs')} style={{
                  width: '100%', background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.35)', color: '#93C5FD',
                  borderRadius: 7, padding: '9px 0', fontSize: 13,
                  fontWeight: 700, fontFamily: V.space, cursor: 'pointer',
                }}>
                  Go to Organizations
                </button>
              </div>

              <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
                  Refresh Data
                </div>
                <div style={{ fontSize: 12, color: V.muted, fontFamily: V.space, marginBottom: 14 }}>
                  Reload all data from Supabase.
                </div>
                <button onClick={fetchData} style={{
                  width: '100%', background: 'transparent',
                  border: `1px solid ${V.border}`, color: V.text,
                  borderRadius: 7, padding: '9px 0', fontSize: 13,
                  fontWeight: 600, fontFamily: V.space, cursor: 'pointer',
                }}>
                  Refresh
                </button>
              </div>
            </div>
          </AdminSection>
        )}
      </div>

      <ScoutPanel V={V} tenantId={selectedTenantId} />
    </div>
  );
}

export default function SourcingAdmin() {
  return (
    <SourcingThemeProvider>
      <SourcingAdminInner />
    </SourcingThemeProvider>
  );
}
