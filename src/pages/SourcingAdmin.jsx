import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Link, useNavigate, useLocation, useParams } from 'react-router-dom';
const SourcingCreate = lazy(() => import('./SourcingCreate.jsx'));
const SourcingSettings = lazy(() => import('./SourcingSettings.jsx'));
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';
import { SourcingThemeProvider, useSourcingTheme, getTokens } from './SourcingTheme.jsx';
import '../space-rising-theme-v2.css';

// Admin sub-components
import ScoutPanel from './admin/ScoutPanel.jsx';
import StatsSection from './admin/StatsSection.jsx';
import CompaniesSection from './admin/CompaniesSection.jsx';
import MembersSection from './admin/MembersSection.jsx';
import PendingContentSection from './admin/PendingContentSection.jsx';
import AddCompanySection from './admin/AddCompanySection.jsx';
import OrganizationsSection from './admin/OrganizationsSection.jsx';
import ListingsSection from './admin/ListingsSection.jsx';
import ReportsSection from './admin/ReportsSection.jsx';
import AnalyticsSection from './admin/AnalyticsSection.jsx';
import MessagesSection from './admin/MessagesSection.jsx';
import ActionsSection from './admin/ActionsSection.jsx';
import DealBankSection from './admin/DealBankSection.jsx';

// Auth is handled via Supabase Auth (email + password)

// Admin client — uses service role key if available (bypasses RLS), falls back to anon
// VITE_SOURCING_ADMIN_KEY should be set to service role key in Vercel env vars
const _adminKey = (import.meta.env.VITE_SOURCING_ADMIN_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const _sbUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const adminSupabase = (_sbUrl && _adminKey)
  ? createClient(_sbUrl, _adminKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sd-admin-noauth',
      },
    })
  : supabase;

// ─── Inner Component ──────────────────────────────────────────────────────────
function SourcingAdminInner() {
  const { dark } = useSourcingTheme();
  const V = getTokens(dark);
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  // Detect admin sub-routes
  const isNew = location.pathname === '/admin/new';
  const isSettings = location.pathname.startsWith('/admin/settings/');

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
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Tenant switcher state
  const [tenants, setTenants] = useState([]);
  const [selectedTenantId, setSelectedTenantId] = useState(null); // null = global mode
  const selectedTenant = tenants.find(t => t.id === selectedTenantId) || null;
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

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
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: emailInput.trim(), password: pwInput });
      if (error) {
        setPwError(error.message || 'Login failed.');
      } else {
        setAuthed(true);
      }
    } catch (err) {
      setPwError(err.message || 'Connection error. Please try again.');
    } finally {
      setAuthLoading(false);
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
          redirect_to: window.location.origin + '/admin',
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

  // Fetch tenants list, scoped to the current user's admin memberships if not global admin
  useEffect(() => {
    async function loadTenants() {
      if (!adminSupabase) return;
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
          // Use adminSupabase (service role) to bypass RLS — the user ID still comes from
          // their verified session, so scoping is correct.
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

  const handleMemberUpgrade = async (member) => {
    if (!member?.company_id) {
      return;
    }
    try {
      const resp = await fetch('/api/sourcing/upgrade-membership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: member.company_id, tier_name: 'basic', seat_count: 1 }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'Upgrade failed.');
      await fetchData();
    } catch (err) {
      console.error('Member upgrade error:', err);
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

  const pendingCompanies = companies.filter(c => c.status === 'pending');

  // ─── Password reset callback (user landed from reset email) ─────────────
  if (showNewPw) {
    return (
      <div className="srsv2-shell" data-tenant="space-rising-v2">
        <div className="srsv2-veil" />
        <div className="srsv2-topbar">
          <Link to="/srw-v2" className="srsv2-wordmark">SPACE RISING</Link>
          <div className="srsv2-progress" />
          <Link to="/srw-v2" className="srsv2-close" aria-label="Close">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </Link>
        </div>
        <div className="srsv2-body">
          <div className="srsv2-step">
            <div className="srsv2-eyebrow">RESET PASSWORD</div>
            <h1 className="srsv2-title">Choose a new password<span className="srsv2-period">.</span></h1>
            <div className="srsv2-sub">Minimum 6 characters.</div>
            <form onSubmit={handleSetNewPassword}>
              <label className="srsv2-field">
                <span className="srsv2-label">New Password</span>
                <input
                  className="srsv2-input"
                  type="password"
                  placeholder="••••••••"
                  value={newPwInput}
                  onChange={e => setNewPwInput(e.target.value)}
                  autoFocus
                  required
                />
              </label>
              {newPwError && <div className="srsv2-error">{newPwError}</div>}
              <div className="srsv2-actions">
                <button
                  type="submit"
                  className="srsv2-cta srsv2-cta-solid"
                  disabled={newPwLoading}
                >
                  {newPwLoading ? 'Saving…' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ─── Login gate ───────────────────────────────────────────────────────────
  if (!authed) {
    if (authLoading) {
      return <div style={{ minHeight: '100dvh', background: '#0B0B0D' }} />;
    }
    return (
      <div className="srsv2-shell" data-tenant="space-rising-v2">
        <div className="srsv2-veil" />
        <div className="srsv2-topbar">
          <Link to="/srw-v2" className="srsv2-wordmark">SPACE RISING</Link>
          <div className="srsv2-progress" />
          <Link to="/srw-v2" className="srsv2-close" aria-label="Close">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </Link>
        </div>
        <div className="srsv2-body">
          {showForgotPw ? (
            forgotStatus === 'sent' ? (
              <div className="srsv2-step srsv2-step-success">
                <div className="srsv2-eyebrow">SENT</div>
                <h1 className="srsv2-title">Check your inbox<span className="srsv2-period">.</span></h1>
                <div className="srsv2-sub">We sent a reset link to {forgotEmail || 'your email'}.</div>
                <div className="srsv2-cta-row">
                  <button
                    type="button"
                    className="srsv2-cta srsv2-cta-solid"
                    onClick={() => { setShowForgotPw(false); setForgotStatus(''); setForgotEmail(''); }}
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <div className="srsv2-step">
                <div className="srsv2-eyebrow">RESET PASSWORD</div>
                <h1 className="srsv2-title">Reset your password<span className="srsv2-period">.</span></h1>
                <div className="srsv2-sub">We'll send a reset link to your email.</div>
                <form onSubmit={handleForgotPassword}>
                  <label className="srsv2-field">
                    <span className="srsv2-label">Email</span>
                    <input
                      className="srsv2-input"
                      type="email"
                      placeholder="admin@example.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      autoFocus
                      required
                    />
                  </label>
                  {forgotStatus.startsWith('error:') && (
                    <div className="srsv2-error">{forgotStatus.slice(6)}</div>
                  )}
                  <div className="srsv2-actions">
                    <button
                      type="submit"
                      className="srsv2-cta srsv2-cta-solid"
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                    </button>
                  </div>
                  <div style={{ marginTop: 16, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPw(false); setForgotStatus(''); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(232,228,218,0.55)',
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                        fontSize: 11,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              </div>
            )
          ) : (
            <div className="srsv2-step">
              <div className="srsv2-eyebrow">ADMIN</div>
              <h1 className="srsv2-title">Admin access<span className="srsv2-period">.</span></h1>
              <div className="srsv2-sub">Sign in to manage the directory.</div>
              <form onSubmit={handleLogin}>
                <label className="srsv2-field">
                  <span className="srsv2-label">Email</span>
                  <input
                    className="srsv2-input"
                    type="email"
                    placeholder="admin@example.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <label className="srsv2-field">
                  <span className="srsv2-label">Password</span>
                  <input
                    className="srsv2-input"
                    type="password"
                    placeholder="••••••••"
                    value={pwInput}
                    onChange={e => setPwInput(e.target.value)}
                    required
                  />
                </label>

                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForgotPw(true); setPwError(''); setForgotEmail(emailInput); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(232,228,218,0.55)',
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      fontSize: 11,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Forgot your password?
                  </button>
                </div>

                {pwError && <div className="srsv2-error">{pwError}</div>}

                <div className="srsv2-actions">
                  <button
                    type="submit"
                    className="srsv2-cta srsv2-cta-solid"
                    disabled={authLoading}
                  >
                    {authLoading ? 'Signing in…' : 'Sign In'}
                  </button>
                </div>
              </form>

              <div style={{
                marginTop: 32,
                textAlign: 'center',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                fontSize: 11,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(232,228,218,0.45)',
              }}>
                <Link
                  to="/srw-v2"
                  style={{ color: '#E8A23A', textDecoration: 'none' }}
                >
                  ← Back to Directory
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
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
  const TABS = [
    { key: 'stats',      label: 'Stats' },
    { key: 'companies',  label: `Companies${pendingCompanies.length > 0 ? ` (${pendingCompanies.length} pending)` : ''}` },
    { key: 'members',    label: `Pending Reviews${pendingMembers.length > 0 ? ` (${pendingMembers.length})` : ''}` },
    { key: 'articles',   label: `Pending Content${pendingContent.length > 0 ? ` (${pendingContent.length})` : ''}` },
    { key: 'deal-bank',  label: 'Deal Bank' },
    { key: 'add',        label: '+ Add Company' },
    { key: 'orgs',       label: 'Organizations' },
    { key: 'listings',   label: 'Listings' },
    { key: 'reports',    label: 'Reports' },
    { key: 'analytics',  label: 'Analytics' },
    { key: 'messages',   label: `Messages${newContactCount > 0 ? ` (${newContactCount})` : ''}` },
    { key: 'actions',    label: 'Quick Actions' },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--tx)' }}>
      <style>{`* { box-sizing: border-box; } a { color: inherit; }`}</style>

      {/* Top bar */}
      <div style={{
        borderBottom: `1px solid ${V.border}`, background: V.navBg,
        padding: '8px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/srw-v2" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: '#E8A23A', letterSpacing: '0.16em', textTransform: 'uppercase' }}>SPACE RISING</span>
          </Link>
          <span style={{ color: V.dim, fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, color: V.text, fontFamily: V.space, fontWeight: 600 }}>Admin</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Tenant switcher: global admins see all tenants + "All Directories";
              scoped admins only see their authorized tenants, no global option */}
          {tenants.length > 0 && (isGlobalAdmin || tenants.length > 1) && (
            <select
              value={selectedTenantId || ''}
              onChange={e => setSelectedTenantId(e.target.value || null)}
              style={{
                background: V.card2, border: `1px solid ${selectedTenantId ? V.accentBrd : V.border}`,
                color: selectedTenantId ? V.accent : V.muted,
                borderRadius: 6, padding: '5px 8px', fontSize: 11,
                fontFamily: V.space, cursor: 'pointer', outline: 'none',
                maxWidth: 160,
              }}
            >
              {isGlobalAdmin && <option value="">All Directories</option>}
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {/* My Portal link -- per selected directory */}
          {selectedTenant && (
            <Link
              to={`/${selectedTenant.slug}/portal`}
              style={{
                background: 'var(--cyan-dim)', border: '1px solid var(--cyan-brd)',
                color: 'var(--cyan)', borderRadius: 6, padding: '4px 10px',
                fontSize: 11, fontWeight: 600, textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              My Portal
            </Link>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent', border: `1px solid ${V.border}`,
              color: V.muted, borderRadius: 6, padding: '4px 10px',
              fontSize: 11, fontFamily: V.space, cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab bar -- dropdown like SourcingNav */}
      <div style={{ borderBottom: `1px solid ${V.border}`, background: V.navBg, position: 'relative' }}>
        <div
          style={{ padding: '0 12px', height: 40, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          onClick={() => setAdminMenuOpen && setAdminMenuOpen(!adminMenuOpen)}
        >
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: V.space, color: V.accent }}>
            {TABS.find(t => t.key === activeTab)?.label || 'Menu'}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={V.muted} strokeWidth="2.5" style={{ marginLeft: 6, transform: adminMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
        {adminMenuOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: V.navBg, border: `1px solid ${V.border}`,
            borderTop: 'none', zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          }}>
            {TABS.map(tab => {
              const isActive = tab.key === activeTab;
              const isPending = (tab.key === 'companies' && pendingCompanies.length > 0) || (tab.key === 'members' && pendingMembers.length > 0) || (tab.key === 'articles' && pendingContent.length > 0) || (tab.key === 'deal-bank');
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setAdminMenuOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    background: isActive ? `${V.accent}10` : 'transparent',
                    border: 'none', borderLeft: isActive ? `3px solid ${V.accent}` : '3px solid transparent',
                    padding: '12px 16px', fontSize: 14,
                    fontWeight: isActive ? 700 : 400,
                    fontFamily: V.space,
                    color: isActive ? V.accent : isPending ? '#FDBA74' : V.text,
                    cursor: 'pointer',
                  }}
                >{tab.label}</button>
              );
            })}
          </div>
        )}
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
          />
        )}

        {/* Pending Member Reviews */}
        {!loading && activeTab === 'members' && (
          <MembersSection
            pendingMembers={pendingMembers}
            memberCompanyMap={memberCompanyMap}
            handleMemberAction={handleMemberAction}
            handleMemberUpgrade={handleMemberUpgrade}
            V={V}
            adminSupabase={adminSupabase}
            fetchData={fetchData}
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

        {/* Deal Bank */}
        {!loading && activeTab === 'deal-bank' && (
          <DealBankSection
            adminSupabase={adminSupabase}
            selectedTenantId={selectedTenantId}
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
            handleListingToggle={handleListingToggle}
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
