import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Bar,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Icon,
  IconList,
  LogoTile,
  Pill,
} from '../../components/osv3/index.js'
import { supabase } from '../../lib/supabase.js'
import { formatCount, formatRelative } from '../../lib/adminStats.js'
import { getCategoryForCompany } from '../../lib/directoryCategories.js'
import { cityPoint, locationLabel, normalizeCity, normalizeState } from '../../lib/azCityCoords.js'
import EcoBubbleMap from './EcoBubbleMap.jsx'
import EcoTypeDonut, { EcoTypeLegend } from './EcoTypeDonut.jsx'
import '../../styles/osv3-profile.css'
import './osv3-eco-map.css'

/**
 * Ecosystem Map — where the Arizona space ecosystem is, who is in it, and what
 * they can do, in one screen a member can filter.
 *
 * DATA. Four reads, all tenant-scoped to 'space-rising', all counted at load:
 *   directory_companies        165 organizations (name, slug, city, state, vertical, created_at)
 *   directory_people            72 people in this tenant (73rd row belongs to another tenant)
 *   directory_certifications   345 rows — the de-facto capabilities table
 *   directory_company_profile    0 rows — where org_type lives, and why the type
 *                                filter and the type donut have nothing to show yet
 *
 * Nothing on this screen is hardcoded from the reference art. The reference
 * prints 623 organizations, 2,843 people, 1,732 capabilities and city counts for
 * Kingman and Sierra Vista; the real figures are 165, 72, 345 and neither of
 * those two cities has a single organization in it. Where the data exists it is
 * counted; where it does not, the section says what is missing and who fills it.
 *
 * A real zero is a NUMBER. A missing mechanism is an ASK.
 */

const TENANT_DB_LOOKUP_SLUG = 'space-rising'
// The rail is a scroll pane on desktop, so it can hold 60 without costing the
// page anything. On a phone the same list flows with the document, so the cap
// is what stops a member scrolling past 60 cards to reach the panels.
const RESULT_CAP = 60
const RESULT_CAP_NARROW = 12
// Eight, not the reference's five: with all four panels on one baseline, five
// rows left a visible void under the two ranked lists. There are 30 real
// certifications and 35 real locations to draw from, so this is real data
// filling real space rather than a card padded out with nothing.
const TOP_N = 8

const ENTITIES = [
  { id: 'organizations', label: 'Organizations' },
  { id: 'people', label: 'People' },
]

const SORTS = [
  { id: 'relevance', label: 'Relevance' },
  { id: 'name', label: 'Name (A–Z)' },
  { id: 'recent', label: 'Recently added' },
]

function byCountThenName(a, b) {
  if (b.count !== a.count) return b.count - a.count
  return a.label.localeCompare(b.label)
}

/** Tally a list into [{ id, label, count }] sorted biggest first. */
function tally(rows, keyOf, labelOf = (k) => k) {
  const map = new Map()
  for (const row of rows) {
    const k = keyOf(row)
    if (!k) continue
    const hit = map.get(k)
    if (hit) hit.count += 1
    else map.set(k, { id: k, label: labelOf(k, row), count: 1 })
  }
  return Array.from(map.values()).sort(byCountThenName)
}

export default function OSEcosystemMap() {
  const navigate = useNavigate()

  const [data, setData] = useState(null) // null = still reading
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  const [entity, setEntity] = useState('organizations')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [capFilter, setCapFilter] = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [sort, setSort] = useState('relevance')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => { document.title = 'Ecosystem Map | SpaceOS' }, [])

  // The map's frame has to match the box it is drawn in, and the box is a
  // different shape on a phone. matchMedia rather than a resize listener: one
  // event on the breakpoint, not one per pixel of a drag.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(max-width: 760px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    if (mq.addEventListener) {
      mq.addEventListener('change', apply)
      return () => mq.removeEventListener('change', apply)
    }
    mq.addListener(apply)
    return () => mq.removeListener(apply)
  }, [])

  const load = useCallback(async () => {
    if (!supabase) {
      setLoadError('This build has no database connection configured, so nothing on this screen can be counted.')
      setData({ companies: [], people: [], certs: [], profiles: [] })
      return
    }
    setData(null)
    setLoadError(null)
    try {
      const { data: tenant } = await supabase
        .from('directory_tenants')
        .select('id')
        .eq('slug', TENANT_DB_LOOKUP_SLUG)
        .single()
      const tenantId = tenant?.id || null

      const scoped = (table, columns) => {
        let qb = supabase.from(table).select(columns)
        if (tenantId) qb = qb.eq('tenant_id', tenantId)
        return qb
      }

      const [companiesRes, peopleRes, certsRes, profilesRes] = await Promise.all([
        scoped('directory_companies', 'id,name,slug,city,state,vertical,logo_url,featured,status,created_at')
          .order('created_at', { ascending: false })
          .limit(1000),
        scoped('directory_people', 'id,slug,full_name,avatar_url,job_title,org_name,city,state,state_code,bio_short,status,created_at')
          .order('created_at', { ascending: false })
          .limit(1000),
        // Ten certification rows carry no tenant_id, so this one is joined by
        // company instead of filtered by tenant — filtering would silently drop
        // them and undercount the capabilities of the companies that hold them.
        supabase.from('directory_certifications').select('company_id,cert_name').limit(2000),
        supabase.from('directory_company_profile').select('company_id,org_type').limit(1000),
      ])

      const firstError = companiesRes.error || peopleRes.error || certsRes.error
      if (firstError) {
        setLoadError(firstError.message)
        setData({ companies: [], people: [], certs: [], profiles: [] })
        return
      }

      setData({
        companies: companiesRes.data || [],
        people: peopleRes.data || [],
        certs: certsRes.data || [],
        // The profile table is allowed to fail without taking the screen down —
        // it is empty today and only feeds two sections.
        profiles: profilesRes.error ? [] : (profilesRes.data || []),
      })
    } catch (err) {
      setLoadError(err?.message || 'Could not read the ecosystem.')
      setData({ companies: [], people: [], certs: [], profiles: [] })
    }
  }, [])

  useEffect(() => {
    let live = true
    ;(async () => { if (live) await load() })()
    return () => { live = false }
  }, [load, attempt])

  const loading = data === null

  /* ---------------------------------------------------------------- derive */

  const companies = data?.companies || []
  const people = data?.people || []

  /** company_id -> [cert names], and the reverse index the filter reads. */
  const certsByCompany = useMemo(() => {
    const map = new Map()
    for (const c of data?.certs || []) {
      if (!c.company_id || !c.cert_name) continue
      const list = map.get(c.company_id)
      if (list) list.push(c.cert_name)
      else map.set(c.company_id, [c.cert_name])
    }
    return map
  }, [data])

  const typeByCompany = useMemo(() => {
    const map = new Map()
    for (const p of data?.profiles || []) {
      const t = (p.org_type || '').trim()
      if (p.company_id && t) map.set(p.company_id, t)
    }
    return map
  }, [data])

  /** One shape for both entities so the list, filters and panels share code. */
  const orgRecords = useMemo(() => companies.map((c) => {
    const city = normalizeCity(c.city)
    const state = normalizeState(c.state)
    return {
      id: c.id,
      kind: 'organization',
      name: c.name || 'Unnamed organization',
      slug: c.slug,
      href: c.slug ? `/${c.slug}` : null,
      city,
      state,
      location: locationLabel(c.city, c.state),
      vertical: c.vertical || '',
      category: getCategoryForCompany(c.name) || '',
      orgType: typeByCompany.get(c.id) || '',
      caps: certsByCompany.get(c.id) || [],
      logoUrl: c.logo_url || '',
      featured: Boolean(c.featured),
      // What "relevance" ranks on when there is nothing typed to be relevant
      // TO: for an organization, how much it has actually published.
      rank: (certsByCompany.get(c.id) || []).length,
      createdAt: c.created_at,
    }
  }), [companies, certsByCompany, typeByCompany])

  // directory_people carries BOTH `state` ("Arizona") and `state_code` ("AZ").
  // The code column wins: the long form is what put one member in Arkansas.
  const peopleRecords = useMemo(() => people.map((p) => {
    const st = p.state_code || p.state
    return {
    id: p.id,
    kind: 'person',
    name: p.full_name || 'Unnamed member',
    slug: p.slug,
    href: p.slug ? `/people/${p.slug}` : null,
    city: normalizeCity(p.city),
    state: normalizeState(st),
    location: locationLabel(p.city, st),
    vertical: p.job_title || '',
    category: '',
    orgType: '',
    caps: [],
    org: p.org_name || '',
    avatarUrl: p.avatar_url || '',
    featured: false,
    // A person has no certifications, so relevance ranks on how much of their
    // profile is actually filled in. Without this, Relevance and Name (A–Z)
    // would be the same list and the control would be a lie.
    rank: [p.job_title, p.org_name, p.city, p.avatar_url, p.bio_short]
      .filter((v) => v && String(v).trim()).length,
    createdAt: p.created_at,
    }
  }), [people])

  const activeRecords = entity === 'people' ? peopleRecords : orgRecords

  /* --------------------------------------------------------- filter options */

  const capOptions = useMemo(
    () => tally(data?.certs || [], (c) => c.cert_name),
    [data],
  )

  const locOptions = useMemo(
    () => tally(orgRecords.concat(peopleRecords), (r) => r.location),
    [orgRecords, peopleRecords],
  )

  const typeOptions = useMemo(
    () => tally(orgRecords, (r) => r.orgType),
    [orgRecords],
  )

  const capsFilterable = entity === 'organizations'
  const typesFilterable = entity === 'organizations' && typeOptions.length > 0

  /* ------------------------------------------------------------- filtering */

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    const rows = activeRecords.filter((r) => {
      if (locFilter && r.location !== locFilter) return false
      if (capsFilterable && capFilter && !r.caps.includes(capFilter)) return false
      if (typesFilterable && typeFilter && r.orgType !== typeFilter) return false
      if (!q) return true
      const hay = [r.name, r.location, r.vertical, r.category, r.org || '', r.caps.join(' ')]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })

    /**
     * Relevance, stated so it can be argued with: a name that starts with what
     * you typed beats a name that merely contains it, which beats a match found
     * somewhere else on the record. With no search term there is no query to be
     * relevant to, so it falls back to the house order — featured first, then
     * the records that have published the most (capabilities for an
     * organization, filled-in fields for a person), then A–Z.
     */
    const score = (r) => {
      if (!q) return 0
      const name = r.name.toLowerCase()
      if (name.startsWith(q)) return 4
      if (name.includes(q)) return 3
      if ((r.location + ' ' + r.vertical + ' ' + r.category).toLowerCase().includes(q)) return 2
      return 1
    }

    const sorted = rows.slice()
    if (sort === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'recent') {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    } else {
      sorted.sort((a, b) => {
        const d = score(b) - score(a)
        if (d) return d
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        if (b.rank !== a.rank) return b.rank - a.rank
        return a.name.localeCompare(b.name)
      })
    }
    return sorted
  }, [activeRecords, locFilter, capFilter, typeFilter, capsFilterable, typesFilterable, q, sort])

  const filtersOn = Boolean(q || locFilter || capFilter || typeFilter)
  const clearAll = () => {
    setQuery('')
    setLocFilter('')
    setCapFilter('')
    setTypeFilter('')
  }

  /* ------------------------------------------------------------ the bubbles */

  const bubbles = useMemo(() => {
    const map = new Map()
    for (const r of filtered) {
      if (r.state !== 'AZ' || !r.city) continue
      const pt = cityPoint(r.city, r.state)
      if (!pt) continue
      const key = r.location
      const hit = map.get(key)
      if (hit) hit.count += 1
      else map.set(key, { id: key, label: r.city, count: 1, x: pt[0], y: pt[1] })
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [filtered])

  const placed = bubbles.reduce((a, b) => a + b.count, 0)
  const offMap = filtered.length - placed
  const maxCount = bubbles.length ? bubbles[0].count : 0

  /* ------------------------------------------------------- header + panels */

  const totalLocations = locOptions.length

  const headerCounts = [
    { id: 'orgs', icon: 'building', label: 'Organizations', value: formatCount(orgRecords.length) },
    { id: 'people', icon: 'users', label: 'People', value: formatCount(peopleRecords.length) },
    { id: 'caps', icon: 'shield-check', label: 'Capabilities', value: formatCount((data?.certs || []).length) },
    { id: 'locs', icon: 'location', label: 'Locations', value: formatCount(totalLocations) },
  ]

  const typeSegments = useMemo(() => {
    const t = tally(filtered.filter((r) => r.kind === 'organization'), (r) => r.orgType)
    return t.slice(0, 8).map((s) => ({ id: s.id, label: s.label, value: s.count }))
  }, [filtered])

  const allCapsInView = useMemo(() => {
    const counts = new Map()
    for (const r of filtered) {
      for (const c of r.caps) counts.set(c, (counts.get(c) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ id: label, label, count }))
      .sort(byCountThenName)
  }, [filtered])
  const topCaps = allCapsInView.slice(0, TOP_N)
  const moreCaps = Math.max(0, allCapsInView.length - topCaps.length)

  const allLocationsInView = useMemo(() => tally(filtered, (r) => r.location), [filtered])
  const topLocations = allLocationsInView.slice(0, TOP_N)
  const moreLocations = Math.max(0, allLocationsInView.length - topLocations.length)

  const recent = useMemo(() => filtered
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      title: r.name,
      sub: [r.location, r.kind === 'person' ? r.org : r.category].filter(Boolean).join(' · ') || undefined,
      time: r.createdAt ? formatRelative(r.createdAt) : undefined,
      logo: r.kind === 'organization',
      logoUrl: r.logoUrl,
      icon: 'user-plus',
    })), [filtered])

  const uncategorized = useMemo(
    () => orgRecords.filter((r) => !r.category).length,
    [orgRecords],
  )
  const orgsInView = useMemo(
    () => filtered.filter((r) => r.kind === 'organization').length,
    [filtered],
  )
  const typedInView = typeSegments.reduce((a, s) => a + s.value, 0)
  const noCity = useMemo(
    () => orgRecords.filter((r) => !r.city).length,
    [orgRecords],
  )

  const capMax = topCaps.length ? topCaps[0].count : 1
  const shown = narrow ? RESULT_CAP_NARROW : RESULT_CAP
  const nounSingular = entity === 'people' ? 'Person' : 'Organization'
  const nounPlural = entity === 'people' ? 'People' : 'Organizations'

  /* ------------------------------------------------------------------ view */

  if (loading) {
    return (
      <div className="osv3p-screen osv3p-screen--profile osv3-ecomap">
        <Head />
        <EmptyState
          icon="clock"
          title="Counting the ecosystem"
          body="Reading organizations, people, capabilities and locations straight from the database. Nothing is shown until every figure has been counted, so no number on this screen is ever a stale one."
        />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="osv3p-screen osv3p-screen--profile osv3-ecomap">
        <Head />
        <EmptyState
          icon="signal"
          title="This build cannot read the ecosystem"
          body={loadError}
          action={<Button variant="quiet" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
        />
      </div>
    )
  }

  return (
    <div className="osv3p-screen osv3p-screen--profile osv3-ecomap">
      <header className="osv3p-pagehead osv3-ecomap-head">
        <div className="osv3-ecomap-headline">
          <h1 className="osv3p-pagehead-title">Ecosystem Map</h1>
          <p className="osv3p-pagehead-sub">Explore people, organizations, and capabilities across Arizona.</p>
        </div>

        <div className="osv3-ecomap-counts">
          {headerCounts.map((c) => (
            <div className="osv3-ecomap-count" key={c.id}>
              <span className="osv3-ecomap-count-icon"><Icon name={c.icon} /></span>
              <div>
                <div className="osv3-ecomap-count-value">{c.value}</div>
                <div className="osv3-ecomap-count-label">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        <Button variant="quiet" icon="eye" onClick={() => setAboutOpen((v) => !v)}>
          {aboutOpen ? 'Hide map notes' : 'About the map'}
        </Button>
      </header>

      {aboutOpen ? (
        <Card className="osv3-ecomap-about">
          <CardBody>
            <h2 className="osv3-ecomap-about-title">How to read this map</h2>
            <p className="osv3p-prose">
              Every bubble is one Arizona city, and the number inside it is how many organizations
              are registered there. The bubble is sized by that number, so the Valley reads bigger
              than the corners of the state — which is what the ecosystem actually looks like.
            </p>
            <p className="osv3p-prose">
              We hold a city and a state for each organization, not a street address, so this is a
              map of cities rather than of buildings. Where two cities sit almost on top of each
              other their bubbles are nudged apart to stay readable, and a hairline points back to
              the true spot. Nothing is merged: Tempe, Mesa and Chandler each keep their own count.
            </p>
            <p className="osv3p-prose">
              Right now {formatCount(placed)} of the {formatCount(filtered.length)}{' '}
              {filtered.length === 1 ? nounSingular.toLowerCase() : nounPlural.toLowerCase()} in view sit on the map.
              {offMap > 0 ? ` The other ${formatCount(offMap)} are outside Arizona or have no city recorded, so they appear in the list but not on the map.` : ''}
              {noCity > 0 ? ` ${formatCount(noCity)} organization${noCity === 1 ? ' has' : 's have'} no city on file at all — that is fixed on the organization's own profile.` : ''}
            </p>
          </CardBody>
        </Card>
      ) : null}

      <div className="osv3-ecomap-body">
        {/* ------------------------------------------------------ left column */}
        <div className="osv3-ecomap-left">
          <div className="osv3-ecomap-filterbar">
            <div className="osv3-ecomap-filterhead">
              <div className="osv3-ecomap-searchwrap">
                <label className="osv3p-visually-hidden" htmlFor="ecomap-q">Search the ecosystem</label>
                <input
                  id="ecomap-q"
                  className="osv3p-input osv3-ecomap-search"
                  type="search"
                  value={query}
                  placeholder={entity === 'people' ? 'Search people…' : 'Search organizations…'}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className="osv3p-seg" role="group" aria-label="Show organizations or people">
                {ENTITIES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={entity === s.id ? 'osv3p-seg-btn osv3p-seg-btn--on' : 'osv3p-seg-btn'}
                    aria-pressed={entity === s.id}
                    onClick={() => {
                      setEntity(s.id)
                      setCapFilter('')
                      setTypeFilter('')
                    }}
                  >
                    {s.label}
                    <span className="osv3p-seg-count">
                      {formatCount(s.id === 'people' ? peopleRecords.length : orgRecords.length)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Only rendered where it does something: below 760px the filter
                  row is collapsed by default so the map is not pushed off the
                  first screen of a phone. */}
              <button
                type="button"
                className="osv3-ecomap-filtertoggle"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <Icon name="layers" />
                {filtersOpen ? 'Hide filters' : 'Filters'}
              </button>
            </div>

            <div className={filtersOpen ? 'osv3-ecomap-selects osv3-ecomap-selects--open' : 'osv3-ecomap-selects'}>
              <div className="osv3-ecomap-field">
                <label className="osv3p-field-label" htmlFor="ecomap-type">Organization type</label>
                <select
                  id="ecomap-type"
                  className="osv3p-select"
                  value={typeFilter}
                  disabled={!typesFilterable}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  {typesFilterable
                    ? <option value="">All types</option>
                    : <option value="">{entity === 'people' ? 'Not held for people' : 'Not recorded yet'}</option>}
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.label} ({t.count})</option>
                  ))}
                </select>
              </div>

              <div className="osv3-ecomap-field">
                <label className="osv3p-field-label" htmlFor="ecomap-cap">Capability</label>
                <select
                  id="ecomap-cap"
                  className="osv3p-select"
                  value={capFilter}
                  disabled={!capsFilterable}
                  onChange={(e) => setCapFilter(e.target.value)}
                >
                  {capsFilterable
                    ? <option value="">All capabilities</option>
                    : <option value="">Held on organizations</option>}
                  {capsFilterable && capOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.label} ({c.count})</option>
                  ))}
                </select>
              </div>

              <div className="osv3-ecomap-field">
                <label className="osv3p-field-label" htmlFor="ecomap-loc">Location</label>
                <select
                  id="ecomap-loc"
                  className="osv3p-select"
                  value={locFilter}
                  onChange={(e) => setLocFilter(e.target.value)}
                >
                  <option value="">All locations</option>
                  {locOptions.map((l) => (
                    <option key={l.id} value={l.id}>{l.label} ({l.count})</option>
                  ))}
                </select>
              </div>

              <div className="osv3-ecomap-field osv3-ecomap-field--clear">
                <button
                  type="button"
                  className="osv3-ecomap-clear"
                  onClick={clearAll}
                  disabled={!filtersOn}
                >
                  Clear all
                </button>
              </div>
            </div>
          </div>

          <Card className="osv3-ecomap-mapcard">
            <CardBody>
              <div className="osv3-ecomap-mapbox">
                {bubbles.length ? (
                  <EcoBubbleMap
                    bubbles={bubbles}
                    maxCount={maxCount}
                    aspect={narrow ? 1.05 : 1.18}
                    textScale={narrow ? 1.45 : 1}
                    selected={locFilter}
                    onSelect={(id) => setLocFilter(id)}
                    ariaLabel={`${nounPlural} by Arizona city`}
                  />
                ) : (
                  <div className="osv3-ecomap-mapempty">
                    <EmptyState
                      icon="location"
                      title="Nothing to place in Arizona"
                      body={filtered.length
                        ? 'Every result in this view is outside Arizona or has no city recorded, so there is nothing to draw. Clear a filter to bring the state back.'
                        : 'No records match these filters, so the map has nothing to show.'}
                      action={filtersOn
                        ? <Button variant="quiet" onClick={clearAll}>Clear all filters</Button>
                        : null}
                    />
                  </div>
                )}
                {bubbles.length ? (
                  <div className="osv3-ecomap-key">
                    <div className="osv3-ecomap-key-title">Organizations per city</div>
                    <p className="osv3-ecomap-key-body">
                      Bubble size is the count. Tap one to filter the list.
                    </p>
                    <p className="osv3-ecomap-key-body">
                      {formatCount(placed)} of {formatCount(filtered.length)} placed
                      {offMap > 0 ? ` · ${formatCount(offMap)} outside Arizona or without a city` : ''}
                    </p>
                  </div>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ----------------------------------------------------- right column */}
        <div className="osv3-ecomap-right">
          <div className="osv3-ecomap-resulthead">
            <h2 className="osv3-ecomap-resulttitle">
              {formatCount(filtered.length)} {filtered.length === 1 ? nounSingular : nounPlural}
            </h2>
            <div className="osv3-ecomap-sort">
              <label className="osv3p-visually-hidden" htmlFor="ecomap-sort">Sort by</label>
              <select
                id="ecomap-sort"
                className="osv3p-select osv3-ecomap-sortselect"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>Sort: {s.label}</option>)}
              </select>
            </div>
          </div>

          <p className="osv3-ecomap-resultnote">
            {filtersOn ? 'Matching your filters' : `Every ${nounSingular.toLowerCase()} in the Space Rising ecosystem`}
            {locFilter ? ` · ${locFilter}` : ''}
          </p>

          <div className="osv3-ecomap-results">
            {filtered.length === 0 ? (
              <EmptyState
                icon="search"
                title="Nothing matches"
                body="No record in the ecosystem matches every filter at once. Widen one of them and the list comes back."
                action={<Button variant="quiet" onClick={clearAll}>Clear all filters</Button>}
              />
            ) : (
              <ul className="osv3-ecomap-cards">
                {filtered.slice(0, shown).map((r) => (
                  <li key={r.id}>
                    <a
                      className="osv3-ecomap-card"
                      href={r.href || undefined}
                      onClick={(e) => {
                        if (!r.href) return
                        e.preventDefault()
                        navigate(r.href)
                      }}
                      aria-disabled={r.href ? undefined : 'true'}
                    >
                      {/* An organization gets the square monogram tile, a
                          person gets the round avatar. Both fall back to
                          initials, which is the common case: 164 of 165
                          organizations have no logo on file. */}
                      {r.kind === 'person'
                        ? <Avatar src={r.avatarUrl} name={r.name} size="md" />
                        : <LogoTile src={r.logoUrl} name={r.name} size="md" />}
                      <div className="osv3-ecomap-card-text">
                        <div className="osv3-ecomap-card-name">{r.name}</div>
                        {r.category || r.vertical ? (
                          <div className="osv3-ecomap-card-meta">
                            {[r.category, r.vertical].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                        {r.kind === 'person' && r.org ? (
                          <div className="osv3-ecomap-card-meta">{r.org}</div>
                        ) : null}
                        {r.location ? (
                          <div className="osv3-ecomap-card-place">
                            <Icon name="location" />
                            {r.location}
                          </div>
                        ) : null}
                        {r.caps.length ? (
                          <div className="osv3p-pill-row osv3-ecomap-card-pills">
                            {r.caps.slice(0, 3).map((c) => <Pill key={c}>{c}</Pill>)}
                            {r.caps.length > 3 ? <Pill>+{r.caps.length - 3}</Pill> : null}
                          </div>
                        ) : null}
                      </div>
                      <span className="osv3-ecomap-card-go"><Icon name="arrow-right" /></span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {filtered.length > shown ? (
            <p className="osv3-ecomap-resultnote">
              Showing the first {shown} of {formatCount(filtered.length)}. Narrow the filters, or open the full directory.
            </p>
          ) : null}

          <Button variant="secondary" block onClick={() => navigate('/directory')}>
            {`View all organizations (${formatCount(orgRecords.length)})`}
          </Button>
        </div>
      </div>

      {/* --------------------------------------------------------- bottom row */}
      <div className="osv3-ecomap-panels">
        <Card>
          <CardHeader title="Organizations by type" />
          <CardBody>
            {typeSegments.length ? (
              <>
                <p className="osv3-ecomap-panelnote">
                  {formatCount(typedInView)} of {formatCount(orgsInView)} organization
                  {orgsInView === 1 ? '' : 's'} in this view have a type on file.
                </p>
                <div className="osv3-ecomap-donutrow">
                  <EcoTypeDonut segments={typeSegments} total={typedInView} totalLabel="Typed" />
                  <EcoTypeLegend segments={typeSegments} />
                </div>
              </>
            ) : (
              <EmptyState
                icon="building"
                title={entity === 'people' ? 'Type is held on organizations' : 'No organization here has a type yet'}
                body={entity === 'people'
                  ? 'Organization type describes a company, not a person. Switch the list back to Organizations to see the split.'
                  : 'Type is the “Organization type” field on an organization’s own profile. Nothing matching these filters has filled it in, so there is nothing to divide up. The moment one does, this chart draws itself.'}
                action={entity === 'people'
                  ? null
                  : <Button variant="quiet" onClick={() => navigate('/add-profile')}>Add or claim a profile</Button>}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top capabilities" count={capOptions.length} />
          <CardBody>
            <p className="osv3-ecomap-panelnote">
              Certifications on file, ranked. There is no capability taxonomy in the platform yet, so
              these are the certifications themselves rather than categories of them.
            </p>
            {topCaps.length ? (
              <ul className="osv3-ecomap-rank">
                {topCaps.map((c) => (
                  <li className="osv3-ecomap-rankrow" key={c.id}>
                    <button
                      type="button"
                      className="osv3-ecomap-ranklabel"
                      onClick={() => { setEntity('organizations'); setCapFilter(c.label) }}
                    >
                      {c.label}
                    </button>
                    <Bar pct={Math.round((c.count / capMax) * 100)} label={c.label} />
                    <span className="osv3-ecomap-rankvalue">{formatCount(c.count)}</span>
                  </li>
                ))}
                {moreCaps > 0 ? (
                  <li className="osv3-ecomap-rankmore">
                    {formatCount(moreCaps)} more certification{moreCaps === 1 ? '' : 's'} held by
                    fewer organizations than these.
                  </li>
                ) : null}
              </ul>
            ) : (
              <EmptyState
                icon="shield-check"
                title="No capabilities in this view"
                body="None of the records matching these filters has a certification on file."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top locations" count={topLocations.length ? locOptions.length : 0} />
          <CardBody>
            <p className="osv3-ecomap-panelnote">
              Counted from the city and state on each record. Pick one to filter everything above.
            </p>
            {topLocations.length ? (
              <ul className="osv3-ecomap-rank osv3-ecomap-rank--plain">
                {topLocations.map((l) => (
                  <li className="osv3-ecomap-rankrow" key={l.id}>
                    <button
                      type="button"
                      className={locFilter === l.id
                        ? 'osv3-ecomap-ranklabel osv3-ecomap-ranklabel--on'
                        : 'osv3-ecomap-ranklabel'}
                      onClick={() => setLocFilter(locFilter === l.id ? '' : l.id)}
                    >
                      {l.label}
                    </button>
                    <span className="osv3-ecomap-rankvalue">{formatCount(l.count)}</span>
                  </li>
                ))}
                {moreLocations > 0 ? (
                  <li className="osv3-ecomap-rankmore">
                    {formatCount(moreLocations)} more {moreLocations === 1 ? 'town or city' : 'towns and cities'} with
                    fewer than {formatCount(topLocations[topLocations.length - 1].count + 1)} each. Use the location
                    filter to reach them.
                  </li>
                ) : null}
              </ul>
            ) : (
              <EmptyState
                icon="location"
                title="No location on any match"
                body="Nothing in this view has a city and state recorded."
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recently added" />
          <CardBody>
            <p className="osv3-ecomap-panelnote">
              The newest {nounPlural.toLowerCase()} in this view, by the date they joined.
            </p>
            {recent.length ? (
              <IconList items={recent} />
            ) : (
              <EmptyState
                icon="clock"
                title="Nothing new here"
                body="No record in this view has a join date on it."
              />
            )}
          </CardBody>
        </Card>
      </div>

      <p className="osv3-ecomap-footlink">
        Want to add your organization?{' '}
        <a href="/add-profile" onClick={(e) => { e.preventDefault(); navigate('/add-profile') }}>
          Add your profile
        </a>
      </p>

      {uncategorized > 0 ? (
        <p className="osv3-ecomap-foot">
          {formatCount(uncategorized)} organization{uncategorized === 1 ? '' : 's'} joined after the
          six strategic priorities were last mapped, so {uncategorized === 1 ? 'it carries' : 'they carry'}{' '}
          no priority tag yet.
        </p>
      ) : null}
    </div>
  )
}

function Head() {
  return (
    <header className="osv3p-pagehead osv3-ecomap-head">
      <div className="osv3-ecomap-headline">
        <h1 className="osv3p-pagehead-title">Ecosystem Map</h1>
        <p className="osv3p-pagehead-sub">Explore people, organizations, and capabilities across Arizona.</p>
      </div>
    </header>
  )
}
