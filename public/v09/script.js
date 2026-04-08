// ─── Supabase Init ────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://mcngatprgluexjjcqpkp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_fXZg2ZQNzLWSdSEpfRezbw_mMTfqI1e';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── State ────────────────────────────────────────────────────────────────────
let allCompanies = [];
let allCerts = {};
let allEvents = [];
let currentVertical = 'all';
let currentEvType = 'all';
let currentEvVertical = 'all';
let upcomingOnly = true;
let activeTab = 'home';
let pendingBrowseVertical = null;

// ─── Color helpers ────────────────────────────────────────────────────────────
const LOGO_PALETTES = [
  { bg:'#0D1428', fg:'#60A5FA' },
  { bg:'#1E1145', fg:'#A78BFA' },
  { bg:'#0d2818', fg:'#34D399' },
  { bg:'#2D0A0A', fg:'#FB7185' },
  { bg:'#062028', fg:'#38BDF8' },
  { bg:'#2D1B06', fg:'#FBBF24' },
  { bg:'#1a0d28', fg:'#C084FC' },
  { bg:'#2D1506', fg:'#FB923C' },
];
function logoPalette(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return LOGO_PALETTES[h % LOGO_PALETTES.length];
}

// ─── Navigation ───────────────────────────────────────────────────────────────
function switchTab(tab) {
  ['home','browse','events'].forEach(t => {
    document.getElementById('s-' + t).classList.toggle('active', t === tab);
    document.getElementById('nb-' + t).classList.toggle('on', t === tab);
  });
  activeTab = tab;

  if (tab === 'browse' && pendingBrowseVertical !== null) {
    applyBrowseVertical(pendingBrowseVertical);
    pendingBrowseVertical = null;
  }
}

function goToBrowse(vertical) {
  pendingBrowseVertical = vertical;
  switchTab('browse');
}

function applyBrowseVertical(vertical) {
  currentVertical = vertical;
  document.querySelectorAll('#co-chips .chip').forEach(c => {
    const cv = c.getAttribute('data-v') || c.textContent.trim().toLowerCase().replace(/ &amp; /, ' & ').replace(/[^a-z ]/g,'').trim();
    const matches = vertical === 'all' ? cv === 'all' : cv.includes(vertical);
    c.classList.toggle('on', matches);
    c.classList.toggle('off', !matches);
  });
  renderCompanies();
}

// ─── Vertical filter ──────────────────────────────────────────────────────────
function setVertical(v, btn) {
  currentVertical = v;
  document.querySelectorAll('#co-chips .chip').forEach(c => { c.classList.remove('on'); });
  btn.classList.add('on');
  renderCompanies();
}

// ─── Event vertical filter ────────────────────────────────────────────────────
function setEvVertical(v, btn) {
  currentEvVertical = v;
  document.querySelectorAll('#ev-chips .chip').forEach(c => { c.classList.remove('on'); });
  btn.classList.add('on');
  renderEvents();
}

// ─── Event type filter ────────────────────────────────────────────────────────
function setEvType(et, btn) {
  currentEvType = et;
  document.querySelectorAll('#ev-type-chips .chip').forEach(c => { c.classList.remove('on'); });
  btn.classList.add('on');
  renderEvents();
}

// ─── Upcoming toggle ──────────────────────────────────────────────────────────
function toggleUpcoming() {
  upcomingOnly = !upcomingOnly;
  document.getElementById('ev-toggle').classList.toggle('on', upcomingOnly);
  renderEvents();
}

// ─── Company search ───────────────────────────────────────────────────────────
function filterCompanies() { renderCompanies(); }

// ─── Render Companies ─────────────────────────────────────────────────────────
function renderCompanies() {
  const q = document.getElementById('co-search').value.toLowerCase().trim();
  let filtered = allCompanies;

  if (currentVertical !== 'all') {
    filtered = filtered.filter(c => c.vertical === currentVertical);
  }
  if (q) {
    filtered = filtered.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      (c.location || '').toLowerCase().includes(q)
    );
  }

  document.getElementById('co-count').textContent = filtered.length + ' companies';

  if (filtered.length === 0) {
    document.getElementById('co-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></div>
        <div class="empty-title">No companies found</div>
        <div class="empty-sub">Try a different search or filter</div>
      </div>`;
    return;
  }

  document.getElementById('co-list').innerHTML = filtered.map(c => {
    const pal = logoPalette(c.name);
    const certs = (allCerts[c.id] || []).slice(0, 2);
    return `
      <div class="co-card">
        <div class="co-logo" style="background:${pal.bg};color:${pal.fg}">${c.name.charAt(0).toUpperCase()}</div>
        <div class="co-body">
          <div class="co-name">${escHtml(c.name)}</div>
          <div class="co-loc">${escHtml(c.location || c.city || '')}</div>
          <div class="co-badges">
            ${c.featured ? '<span class="co-badge feat">Featured</span>' : ''}
            ${certs.map(cert => `<span class="co-badge cert">${escHtml(cert.cert_name)}</span>`).join('')}
          </div>
        </div>
        <div class="co-arrow"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>`;
  }).join('');
}

// ─── Render Events ────────────────────────────────────────────────────────────
function renderEvents() {
  const now = new Date();
  const q = (document.getElementById('ev-search')?.value || '').toLowerCase().trim();
  let filtered = allEvents;

  if (upcomingOnly) {
    filtered = filtered.filter(e => !e.event_date || new Date(e.event_date) >= now);
  }
  if (currentEvVertical !== 'all') {
    filtered = filtered.filter(e => e.vertical === currentEvVertical);
  }
  if (currentEvType !== 'all') {
    filtered = filtered.filter(e => e.event_type === currentEvType);
  }
  if (q) {
    filtered = filtered.filter(e =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.organizer || '').toLowerCase().includes(q) ||
      (e.event_location || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
    );
  }

  document.getElementById('ev-count').textContent = filtered.length + ' event' + (filtered.length !== 1 ? 's' : '');

  if (filtered.length === 0) {
    document.getElementById('ev-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div>
        <div class="empty-title">No events found</div>
        <div class="empty-sub">${upcomingOnly ? 'Try turning off "Upcoming only"' : 'Check back soon'}</div>
      </div>`;
    return;
  }

  document.getElementById('ev-list').innerHTML = filtered.map(e => {
    const d = e.event_date ? new Date(e.event_date) : null;
    const isUpcoming = d && d >= now;
    const month = d ? d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() : 'TBD';
    const day = d ? d.getDate() : '?';
    const etClass = e.event_type || 'default';
    const vertClass = e.vertical ? (e.vertical === 'space' ? 'space' : e.vertical === 'semiconductor' ? 'semiconductor' : '') : '';
    const vertLabel = e.vertical === 'space' ? 'Space & Aerospace' : e.vertical === 'semiconductor' ? 'Semiconductor' : '';
    return `
      <div class="ev-card">
        <div class="ev-date-pill${isUpcoming ? ' upcoming' : ''}">
          <div class="ev-date-month">${month}</div>
          <div class="ev-date-day">${day}</div>
        </div>
        <div class="ev-body">
          <div class="ev-meta">
            ${e.event_type ? `<span class="ev-type ${etClass}">${escHtml(e.event_type)}</span>` : ''}
            ${vertClass ? `<span class="ev-vertical ${vertClass}">${escHtml(vertLabel)}</span>` : ''}
          </div>
          <div class="ev-title">${escHtml(e.title)}</div>
          ${e.organizer ? `<div class="ev-organizer">${escHtml(e.organizer)}</div>` : ''}
          ${e.event_location ? `<div class="ev-location"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> ${escHtml(e.event_location)}</div>` : ''}
          ${e.virtual_url ? `<div class="ev-virtual"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17,2 12,7 7,2"/></svg> Virtual</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ─── Render Chooser Cards ─────────────────────────────────────────────────────
function renderChooserCards(tenants) {
  const totalCount = tenants.reduce((s, t) => s + (t.company_count || 0), 0);
  document.getElementById('tenant-count').textContent = tenants.length + ' director' + (tenants.length !== 1 ? 'ies' : 'y');

  const cards = tenants.map(t => {
    const isSpace = t.slug === 'space-rising' || (t.name && t.name.toLowerCase().includes('space'));
    const isSemi = t.slug === 's3c' || (t.name && t.name.toLowerCase().includes('semiconductor')) || (t.name && t.name.toLowerCase().includes('s3c'));
    const cls = isSpace ? 'space' : isSemi ? 'semi' : 'all';
    const tag = isSpace ? 'Space &amp; Aerospace' : isSemi ? 'Semiconductor' : 'Industry Directory';
    const desc = t.hero_text || t.description || 'Verified suppliers and certified companies';
    const count = t.company_count || 0;
    const vert = isSpace ? 'space' : isSemi ? 'semiconductor' : 'all';
    return `
      <div class="dir-card ${cls}" onclick="goToBrowse('${vert}')">
        <div class="dir-card-body">
          <div class="dir-card-tag">${tag}</div>
          <div class="dir-card-name">${escHtml(t.name)}</div>
          <div class="dir-card-desc">${escHtml(desc.substring(0, 80))}${desc.length > 80 ? '...' : ''}</div>
          <div class="dir-card-foot">
            <div class="dir-card-count">
              <div class="dir-card-count-num">${count}</div>
              <div class="dir-card-count-label">companies</div>
            </div>
            <div class="dir-card-arrow">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </div>
        </div>
      </div>`;
  });

  document.getElementById('dir-cards').innerHTML = cards.join('');
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Data Fetching ────────────────────────────────────────────────────────────
async function fetchTenants() {
  try {
    // Try the API endpoint first (avoids exposing credentials)
    try {
      const res = await fetch('/api/sourcing/tenants');
      if (res.ok) {
        const data = await res.json();
        renderChooserCards(Array.isArray(data) ? data : []);
        return;
      }
    } catch { /* fallthrough */ }

    // Direct Supabase query
    const { data: tenants, error } = await sb
      .from('directory_tenants')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (error) throw error;

    // Enrich with company counts
    const enriched = await Promise.all((tenants || []).map(async t => {
      const { count } = await sb
        .from('directory_companies')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', t.id);
      return { ...t, company_count: count || 0 };
    }));

    renderChooserCards(enriched);
  } catch (err) {
    console.error('Tenants fetch error:', err);
    // Fallback static cards
    renderChooserCards([
      { name:'Space Rising', slug:'space-rising', description:'Arizona space & aerospace suppliers', company_count:0 },
      { name:'S3C Arizona', slug:'s3c', description:'Arizona semiconductor supply chain', company_count:0 },
    ]);
  }
}

async function fetchCompanies() {
  try {
    const { data: companies, error } = await sb
      .from('directory_companies')
      .select('*')
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .order('membership_tier', { ascending: true })
      .order('name', { ascending: true })
      .limit(200);

    if (error) throw error;
    allCompanies = companies || [];

    // Fetch certifications
    if (allCompanies.length > 0) {
      const ids = allCompanies.map(c => c.id);
      const { data: certsData } = await sb
        .from('directory_certifications')
        .select('company_id, cert_name')
        .in('company_id', ids);

      allCerts = {};
      (certsData || []).forEach(cert => {
        if (!allCerts[cert.company_id]) allCerts[cert.company_id] = [];
        allCerts[cert.company_id].push(cert);
      });
    }

    renderCompanies();
  } catch (err) {
    console.error('Companies fetch error:', err);
    document.getElementById('co-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <div class="empty-title">Could not load companies</div>
        <div class="empty-sub">Check your connection and try again</div>
      </div>`;
  }
}

async function fetchEvents() {
  try {
    const { data: events, error } = await sb
      .from('directory_listings')
      .select('*')
      .eq('category', 'event')
      .eq('status', 'active')
      .order('event_date', { ascending: true })
      .limit(100);

    if (error) throw error;
    allEvents = events || [];

    renderEvents();
  } catch (err) {
    console.error('Events fetch error:', err);
    document.getElementById('ev-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
        <div class="empty-title">Could not load events</div>
        <div class="empty-sub">Check your connection and try again</div>
      </div>`;
  }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
fetchTenants();
fetchCompanies();
fetchEvents();
