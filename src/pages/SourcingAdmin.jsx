import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
const SourcingCreate = lazy(() => import('./SourcingCreate.jsx'));
const SourcingSettings = lazy(() => import('./SourcingSettings.jsx'));
import { supabase } from '../lib/supabase.js';
import { createAdminApiClient } from '../lib/adminApi.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

// Admin sub-components
import StatsSection from './admin/StatsSection.jsx';
import CompaniesSection from './admin/CompaniesSection.jsx';
import MembersSection from './admin/MembersSection.jsx';
import PendingContentSection from './admin/PendingContentSection.jsx';
import AddCompanySection from './admin/AddCompanySection.jsx';
import OrganizationsSection from './admin/OrganizationsSection.jsx';
import ListingsSection from './admin/ListingsSection.jsx';
import SettingsSection from './admin/SettingsSection.jsx';
import AuditSection from './admin/AuditSection.jsx';
import { logAudit } from './admin/audit.js';
import ReportsSection from './admin/ReportsSection.jsx';
import AnalyticsSection from './admin/AnalyticsSection.jsx';
import MessagesSection from './admin/MessagesSection.jsx';
import ActionsSection from './admin/ActionsSection.jsx';
import DealBankSection from './admin/DealBankSection.jsx';
import TicketsSection from './admin/TicketsSection.jsx';
import TagsSection from './admin/TagsSection.jsx';
import SiteContentSection from './admin/SiteContentSection.jsx';
import AdminShellV3 from './admin/AdminShellV3.jsx';
import AddContentModal from './admin/AddContentModal.jsx';

// Auth is handled via Supabase Auth (email + password)

// Admin data client.
//
// This used to be a second Supabase client built in the BROWSER from a VITE_-prefixed
// env var holding the service_role key. Vite inlines VITE_* at build time, so that key
// shipped inside the /admin chunk to every visitor who loaded it, and was then handed
// as a prop to ~14 section components that wrote directly to tables.
//
// It is now a shim with the identical `.from(table)...` surface that routes every
// call through POST /api/sourcing/admin, where the caller's own Supabase JWT is
// verified server-side and checked against a table/operation/column allowlist. The
// service key never leaves the serverless function. Section components are unchanged.
const adminSupabase = createAdminApiClient();

// ─── Inner Component ──────────────────────────────────────────────────────────
function SourcingAdminInner() {
  useSourcingTheme(); // keep theme context mounted; admin uses the V2 token set below
  // V3 design system — navy sidebar, white content, single rust accent, ink text, Roboto.
  // Tokens mirror osv3-tokens.css; this V object threads through all 16 section components.
  const V = {
    bg:        '#FEFDFD',
    card:      '#FFFFFF',
    card2:     '#F8FAFB',
    cardHov:   '#F1F5F9',
    accent:    '#CE4421',
    accentHov: '#B33A1A',
    accentDim: 'rgba(206,68,33,0.08)',
    accentBrd: 'rgba(206,68,33,0.25)',
    blue:      '#1B3A8F',
    text:      '#010B13',
    heading:   '#010B13',
    muted:     '#6B7280',
    dim:       '#9CA3AF',
    border:    '#D7DEE2',
    borderHov: 'rgba(206,68,33,0.25)',
    green:     '#15803D',
    violet:    '#7C3AED',
    amber:     '#B45309',
    rose:      '#DC2626',
    navBg:     '#FEFDFD',
    font:      "'Roboto', system-ui, sans-serif",
    syne:      "'Roboto', system-ui, sans-serif",
    space:     "'Roboto', system-ui, sans-serif",
    mono:      'var(--v3-font-family-base)',
  };
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Detect admin sub-routes
  const isNew = location.pathname === '/admin/new';
  const isSettings = location.pathname.startsWith('/admin/settings/');

  // The OS pages' "Add …" buttons link to these paths; each opens this panel on
  // the matching section. The ?category= some links carry is ignored — the
  // Listings section shows every category.
  const PATH_TAB = {
    '/admin/reports': 'reports',
    '/admin/listings': 'listings',
    '/admin/organizations': 'companies',
  };

  const [authed, setAuthed] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(PATH_TAB[location.pathname] || 'stats');
  const [showAddContent, setShowAddContent] = useState(false);

  // Tenant switcher state
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(null); // null = global mode
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || null;
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
  // isGlobalAdmin starts false, so anything gated on it must know the difference
  // between "resolved: not a global admin" and "not resolved yet" — otherwise a real
  // global admin is briefly told they lack access.
  const [adminScopeResolved, setAdminScopeResolved] = useState(false);

  const [stats, setStats] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [listings, setListings] = useState([]);
  const [companyMap, setCompanyMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({});
  const [exportStatus, setExportStatus] = useState('');
  const [pendingMembers, setPendingMembers] = useState([]);
  const [memberCompanyMap, setMemberCompanyMap] = useState({});
  const [pendingContent, setPendingContent] = useState([]);
  const [pendingContentCompanyMap, setPendingContentCompanyMap] = useState({});

  // Directory Reports state
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Analytics + Messages state
  const [analyticsData, setAnalyticsData] = useState(null);
  const [contacts, setContacts] = useState([]);

  // CSV Import
  const [importPreview, setImportPreview] = useState(null); // { headers, rows }
  const [importStatus, setImportStatus] = useState('');
  const importFileRef = useRef(null);

  // Check existing Supabase session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthed(true);
      setCurrentUserEmail(session?.user?.email || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setCurrentUserEmail(session?.user?.email || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthed(false);
  };

  // Fetch tenants list, scoped to the current user's admin memberships if not global admin
  useEffect(() => {
    async function loadTenants() {
      if (!adminSupabase) { setAdminScopeResolved(true); return; }
      try {
        const [tenantsRes, sessionRes] = await Promise.all([
          adminSupabase.from('directory_tenants').select('*').eq('status', 'active').order('name'),
          supabase.auth.getSession(),
        ]);
        const allTenants = tenantsRes.data || [];
        const user = sessionRes.data?.session?.user;
        const globalAdmin = user?.app_metadata?.role === 'admin';
        setIsGlobalAdmin(globalAdmin);

        if (globalAdmin) {
          setTenants(allTenants);
        } else {
          // Non-global admin: show only tenants where they have an admin member record.
          // The server applies the same scoping again on every request, so this filter
          // is a UI convenience, not the security boundary.
          const { data: memberRows } = await adminSupabase
            .from('directory_members')
            .select('tenant_id')
            .eq('auth_user_id', user?.id)
            .eq('role', 'admin')
            .eq('status', 'approved');

          const adminTenantIdSet = new Set((memberRows || []).map(m => m.tenant_id));
          const scopedTenants = allTenants.filter(t => adminTenantIdSet.has(t.id));
          setTenants(scopedTenants);
          // Auto-select if only one allowed tenant
          if (scopedTenants.length === 1) {
            setSelectedTenantId(scopedTenants[0].id);
          }
        }
      } catch { /* ignore */ }
      finally { setAdminScopeResolved(true); }
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

      // Fetch all pending content (articles, jobs, events, marketplace)
      let articlesQ = adminSupabase.from('directory_listings').select('*').eq('status', 'pending').order('created_at', { ascending: false });
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
      setPendingContent(allPendingArticles);

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
      setPendingContentCompanyMap(acMap);

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

  const fetchReports = useCallback(async () => {
    if (!adminSupabase) return;
    setReportsLoading(true);
    try {
      let q = adminSupabase.from('directory_reports').select('*').order('created_at', { ascending: false });
      if (selectedTenantId) q = q.eq('tenant_id', selectedTenantId);
      const { data } = await q;
      setReports(data || []);
    } catch (err) {
      console.error('Reports fetch error:', err);
    } finally {
      setReportsLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (authed) fetchReports();
  }, [authed, fetchReports]);

  const handleContactStatusUpdate = async (id, status) => {
    if (!adminSupabase) return;
    await adminSupabase.from('directory_contacts').update({ status }).eq('id', id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const handleCompanyAction = async (id, action, payload) => {
    if (!adminSupabase) return;
    setRefreshing(prev => ({ ...prev, [id]: true }));
    logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: `company.${action}`, entity_type: 'company', entity_id: id, detail: payload ? { fields: Object.keys(payload) } : {} });
    try {
      if (action === 'delete') {
        const { error } = await adminSupabase.from('directory_companies').delete().eq('id', id);
        if (error) throw error;
        await fetchData();
        return;
      }
      if (action === 'update') {
        if (!payload || typeof payload !== 'object') return;
        const { error } = await adminSupabase.from('directory_companies').update(payload).eq('id', id);
        if (error) throw error;
        await fetchData();
        return;
      }
      const updates = {
        approve:    { status: 'active' },
        reject:     { status: 'inactive' },
        deactivate: { status: 'inactive' },
        feature:    { featured: true },
        unfeature:  { featured: false },
      };
      if (!updates[action]) return;
      await adminSupabase.from('directory_companies').update(updates[action]).eq('id', id);
      await fetchData();
    } catch (err) {
      console.error('Company action error:', err);
      alert(`Action failed: ${err.message || err}`);
    } finally {
      setRefreshing(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleMoveAllToSpace = async () => {
    if (!adminSupabase || !selectedTenantId) return null;
    try {
      const { data, error } = await adminSupabase
        .from('directory_companies')
        .update({ vertical: 'space' })
        .neq('vertical', 'space')
        .eq('tenant_id', selectedTenantId)
        .select('id');
      if (error) throw error;
      await fetchData();
      return data ? data.length : 0;
    } catch (err) {
      console.error('Move-all-to-space error:', err);
      alert(`Reclassify failed: ${err.message || err}`);
      return null;
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
      const member = pendingMembers.find(m => m.id === memberId);

      // The admin API client resolves with { data, error } and NEVER throws, so a bare
      // `await` here reads as success for a write the server refused. The approval email
      // used to go out on that path: the person was told they were approved while their
      // record still said pending. `.select('id')` makes the server return the rows it
      // actually changed, so "no error but nothing matched" is caught too.
      const { data: updatedRows, error: statusErr } = await adminSupabase
        .from('directory_members')
        .update({ status: newStatus })
        .eq('id', memberId)
        .select('id');

      if (statusErr) {
        console.error('Member action error:', statusErr);
        alert(`Could not ${action} this member: ${statusErr.message}\n\nNothing was changed and no email was sent.`);
        return;
      }
      if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
        console.error('Member action error: update matched no rows', { memberId, newStatus });
        alert(`Could not ${action} this member: the record was not found or is outside your access.\n\nNothing was changed and no email was sent.`);
        return;
      }

      // Only reached once the status write is confirmed, so the audit row records
      // something that happened.
      logAudit(adminSupabase, { tenant_id: selectedTenantId, actor_email: currentUserEmail, action: `member.${action}`, entity_type: 'member', entity_id: memberId, detail: { email: member?.email } });

      // If approving, also activate their company. A failure here does not undo the
      // approval, so it is reported rather than thrown — but it is reported, not eaten.
      let companyWarning = '';
      if (action === 'approve' && member?.company_id) {
        const { error: companyErr } = await adminSupabase
          .from('directory_companies')
          .update({ status: 'active' })
          .eq('id', member.company_id);
        if (companyErr) {
          console.error('Member action: company activation failed', companyErr);
          companyWarning = `\n\nThe member was approved, but their company listing could not be set to active: ${companyErr.message}`;
        }
      }

      // Send approve / decline email via Resend. Reached only after the status write is
      // confirmed above, so the email can no longer contradict the record.
      if (member?.email) {
        fetch('/api/sourcing/member-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: member.email, full_name: member.full_name,
            status: newStatus, directory_name: selectedTenant?.name,
            base_url: window.location.origin,
          }),
        })
          .then(resp => {
            // The record is already correct; the notification is best-effort. It is
            // logged rather than silently dropped so a dead mail path is visible.
            if (!resp.ok) console.error(`member-email failed (HTTP ${resp.status}) for ${member.email}`);
          })
          .catch(err => console.error('member-email request failed:', err));
      }

      if (companyWarning) alert(`Member ${newStatus}.${companyWarning}`);

      await fetchData();
    } catch (err) {
      console.error('Member action error:', err);
      alert(`Member ${action} failed: ${err.message || err}`);
    }
  };

  const handleArticleAction = async (articleId, action) => {
    if (!adminSupabase) return;
    try {
      const newStatus = action === 'approve' ? 'active' : 'rejected';
      const { error } = await adminSupabase.from('directory_listings').update({ status: newStatus }).eq('id', articleId);
      if (error) throw error;
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

      // membership_tier is billing state and is stripped from every admin write by
      // PROTECTED_COLUMNS. Drop it here, at the point the file is read, so the preview
      // cannot display tier values that the import will not apply.
      const ignoredTier = parsed.headers.includes('membership_tier');
      const headers = parsed.headers.filter(h => h !== 'membership_tier');
      const rows = ignoredTier
        ? parsed.rows.map(({ membership_tier, ...rest }) => rest)
        : parsed.rows;

      setImportPreview({ headers, rows, ignoredTier });
      setImportStatus(ignoredTier
        ? 'Heads up: the membership_tier column will be ignored — tier is billing state, set by checkout.'
        : '');
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    if (!adminSupabase || !importPreview || !selectedTenantId) return;
    const { rows, ignoredTier } = importPreview;
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
    if (ignoredTier) {
      summary += ' Note: the membership_tier column was ignored — tier is billing state, set by checkout, and every imported company starts on the free tier.';
    }
    setImportStatus(summary);
    setImportPreview(null);
    if (importFileRef.current) importFileRef.current.value = '';
    await fetchData();
  };

  const pendingCompanies = companies.filter(c => c.status === 'pending');

  // ─── Auth guard — login + reset now handled by /login route ─────────────
  if (authLoading) {
    return <div style={{ minHeight: '100dvh', background: '#000C20' }} />;
  }
  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  // ─── Admin Sub-routes (behind the gate) ──────────────────────────────────
  if (isNew) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />}>
        <SourcingCreate />
      </Suspense>
    );
  }

  if (isSettings) {
    return (
      <Suspense fallback={<div style={{ minHeight: '100dvh', background: 'var(--bg)' }} />}>
        <SourcingSettings />
      </Suspense>
    );
  }

  // ─── Admin Dashboard ──────────────────────────────────────────────────────
  const newContactCount = contacts.filter(c => c.status === 'new').length;

  // The deal_bank_* tables are globalOnly in api/sourcing/lib/tablePolicy.js: pending
  // deal submissions, deck URLs, revenue figures and investor contact emails are
  // platform data, not any one directory's. A tenant admin who opens this tab gets 403
  // on every read, and DealBankSection swallows the error into `.data || []`, so the
  // screen shows three empty lists and buttons that do nothing. That is the exact
  // "reports success for something that did not happen" shape, so the section is not
  // rendered for them at all — they get a plain statement instead.
  const canSeeDealBank = isGlobalAdmin;

  // DEAD CODE — nothing renders this. The navigation the admin actually clicks is
  // ADMIN_NAV inside src/pages/admin/AdminShellV3.jsx, which now hides globalOnly items
  // (Deal Bank) from tenant admins once `adminScopeResolved` is true. TABS is left here
  // untouched rather than deleted because removing it is not this round's job, but no
  // gate belongs in it: a gate here protects nothing.
  // eslint-disable-next-line no-unused-vars
  const TABS = [
    { key: 'stats',      label: 'Stats' },
    { key: 'companies',  label: `Companies${pendingCompanies.length > 0 ? ` (${pendingCompanies.length} pending)` : ''}` },
    { key: 'members',    label: `Pending Reviews${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}` },
    { key: 'articles',   label: `Pending Content${pendingContent.length > 0 ? ` (${pendingContent.length})` : ''}` },
    ...(canSeeDealBank ? [{ key: 'deal-bank', label: 'Deal Bank' }] : []),
    { key: 'tickets',    label: 'Tickets' },
    { key: 'tags',       label: 'Tags' },
    { key: 'add',        label: '+ Add Company' },
    { key: 'orgs',       label: 'Organizations' },
    { key: 'listings',   label: 'Listings' },
    { key: 'reports',    label: 'Reports' },
    { key: 'analytics',  label: 'Analytics' },
    { key: 'messages',   label: `Messages${newContactCount > 0 ? ` (${newContactCount})` : ''}` },
    { key: 'actions',    label: 'Quick Actions' },
    { key: 'site-content', label: 'Site Content' },
    { key: 'settings',   label: 'Settings' },
    { key: 'audit',      label: 'Audit' },
  ];

  return (
    <>
      <style>{`* { box-sizing: border-box; } a { color: inherit; }`}</style>
      <AdminShellV3
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        tenants={tenants}
        selectedTenantId={selectedTenantId}
        setSelectedTenantId={setSelectedTenantId}
        isGlobalAdmin={isGlobalAdmin}
        adminScopeResolved={adminScopeResolved}
        selectedTenant={selectedTenant}
        currentUserEmail={currentUserEmail}
        pendingCompanyCount={pendingCompanies.length}
        pendingMemberCount={pendingMembers.length}
        pendingContentCount={pendingContent.length}
        newMessageCount={newContactCount}
        onAddContent={() => setShowAddContent(true)}
      >
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
          <StatsSection stats={stats} V={V} />
        )}

        {/* Companies */}
        {!loading && activeTab === 'companies' && (
          <CompaniesSection
            companies={companies}
            pendingCompanies={pendingCompanies}
            importPreview={importPreview}
            setImportPreview={setImportPreview}
            importStatus={importStatus}
            setImportStatus={setImportStatus}
            importFileRef={importFileRef}
            refreshing={refreshing}
            handleImportFile={handleImportFile}
            handleImportConfirm={handleImportConfirm}
            handleCompanyAction={handleCompanyAction}
            handleApproveAll={handleApproveAll}
            V={V}
            selectedTenantId={selectedTenantId}
            adminSupabase={adminSupabase}
          />
        )}

        {/* Pending Member Reviews */}
        {!loading && activeTab === 'members' && (
          <MembersSection
            pendingMembers={pendingMembers}
            memberCompanyMap={memberCompanyMap}
            handleMemberAction={handleMemberAction}
            V={V}
            adminSupabase={adminSupabase}
            fetchData={fetchData}
            selectedTenantId={selectedTenantId}
            currentUserEmail={currentUserEmail}
          />
        )}

        {/* Pending Content */}
        {!loading && activeTab === 'articles' && (
          <PendingContentSection
            pendingContent={pendingContent}
            pendingContentCompanyMap={pendingContentCompanyMap}
            handleArticleAction={handleArticleAction}
            V={V}
          />
        )}

        {/* Deal Bank — platform-level data, global admins only */}
        {!loading && activeTab === 'deal-bank' && canSeeDealBank && (
          <DealBankSection
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            currentUserEmail={currentUserEmail}
            V={V}
          />
        )}
        {!loading && activeTab === 'deal-bank' && !canSeeDealBank && !adminScopeResolved && (
          <div style={{ padding: '40px 0', color: V.muted, fontFamily: V.space, fontSize: 13 }}>Loading...</div>
        )}
        {!loading && activeTab === 'deal-bank' && !canSeeDealBank && adminScopeResolved && (
          <div style={{ background: V.card, border: `1px solid ${V.border}`, borderRadius: 10, padding: '28px 24px', maxWidth: 620 }}>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: V.syne, color: V.heading, marginBottom: 8 }}>
              Deal Bank is managed platform-wide
            </div>
            <div style={{ fontSize: 13, fontFamily: V.space, color: V.muted, lineHeight: 1.6 }}>
              Deal submissions, investor records and completed rounds belong to the platform rather than
              to any one directory, so they are not part of a directory admin's access. Nothing here is
              hidden by mistake and nothing you do on this screen would be saved. Contact a platform
              administrator if you need something from the Deal Bank.
            </div>
          </div>
        )}

        {/* Tickets */}
        {!loading && activeTab === 'tickets' && (
          <TicketsSection
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            currentUserEmail={currentUserEmail}
            V={V}
          />
        )}

        {/* Tags */}
        {!loading && activeTab === 'tags' && (
          <TagsSection
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            currentUserEmail={currentUserEmail}
            V={V}
          />
        )}

        {/* Add Company */}
        {!loading && activeTab === 'add' && (
          <AddCompanySection
            orgs={orgs}
            V={V}
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            selectedTenant={selectedTenant}
            fetchData={fetchData}
          />
        )}

        {/* Organizations */}
        {!loading && activeTab === 'orgs' && (
          <OrganizationsSection
            orgs={orgs}
            companies={companies}
            V={V}
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            fetchData={fetchData}
          />
        )}

        {/* Listings */}
        {!loading && activeTab === 'listings' && (
          <ListingsSection
            listings={listings}
            companyMap={companyMap}
            companies={companies}
            handleListingToggle={handleListingToggle}
            adminSupabase={adminSupabase}
            fetchData={fetchData}
            selectedTenantId={selectedTenantId}
            V={V}
          />
        )}

        {/* Directory Reports */}
        {!loading && activeTab === 'reports' && (
          <ReportsSection
            reports={reports}
            setReports={setReports}
            reportsLoading={reportsLoading}
            V={V}
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            fetchReports={fetchReports}
          />
        )}

        {/* Analytics */}
        {!loading && activeTab === 'analytics' && (
          <AnalyticsSection
            analyticsData={analyticsData}
            contacts={contacts}
            companyMap={companyMap}
            selectedTenantId={selectedTenantId}
            V={V}
          />
        )}

        {/* Messages */}
        {!loading && activeTab === 'messages' && (
          <MessagesSection
            contacts={contacts}
            companyMap={companyMap}
            handleContactStatusUpdate={handleContactStatusUpdate}
            selectedTenantId={selectedTenantId}
            V={V}
          />
        )}

        {/* Quick Actions */}
        {!loading && activeTab === 'actions' && (
          <ActionsSection
            pendingCompanies={pendingCompanies}
            exportStatus={exportStatus}
            handleApproveAll={handleApproveAll}
            handleExportCSV={handleExportCSV}
            handleMoveAllToSpace={handleMoveAllToSpace}
            setActiveTab={setActiveTab}
            fetchData={fetchData}
            selectedTenantId={selectedTenantId}
            V={V}
          />
        )}

        {!loading && activeTab === 'settings' && (
          <SettingsSection
            tenant={selectedTenant}
            adminSupabase={adminSupabase}
            setTenants={setTenants}
            V={V}
          />
        )}

        {!loading && activeTab === 'audit' && (
          <AuditSection
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            V={V}
          />
        )}

        {!loading && activeTab === 'site-content' && (
          <SiteContentSection
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
            V={V}
          />
        )}
      </AdminShellV3>
      {showAddContent && (
        <AddContentModal
          setActiveTab={(tab) => { setActiveTab(tab); setShowAddContent(false); }}
          onClose={() => setShowAddContent(false)}
        />
      )}
    </>
  );
}

export default function SourcingAdmin() {
  return (
    <SourcingThemeProvider>
      <SourcingAdminInner />
    </SourcingThemeProvider>
  );
}
