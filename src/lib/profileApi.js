/**
 * profileApi.js — the data seam for the person and company profile screens.
 *
 * The screens never import supabase. They call these two functions and get back
 * either a profile object or null. That keeps the primitives presentational and
 * makes the whole screen renderable from fixtures.
 *
 * Two paths:
 *   slug === '_preview'  -> the transcribed reference fixture. Always resolves.
 *   anything else        -> a real read.
 *
 * THE REAL READ CAN LEGITIMATELY RETURN NULL. There is no `directory_people`
 * table in production yet, and `directory_companies` rows carry only a subset
 * of what these screens show. Null is the honest answer, and every caller
 * treats it as not-found — never as a crash and never as an empty shell
 * pretending to be a profile.
 *
 * Every returned object carries `source`: 'fixture' | 'live'. Screens use it to
 * say plainly that they are showing reference data.
 */

import { supabase } from './supabase.js'
import { PERSON_FIXTURE, COMPANY_FIXTURE, PREVIEW_SLUG } from './profileFixtures.js'

function asArray(v) {
  if (Array.isArray(v)) return v.filter(Boolean)
  if (typeof v === 'string' && v.trim()) {
    return v.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

/** A live row only ever fills part of the screen. Missing sections stay empty
 *  arrays so the cards render their honest empty state, not stale fixture text. */
function companyFromRow(row) {
  const categories = asArray(row.categories || row.category || row.vertical)
  return {
    slug: row.slug,
    kind: 'company',
    source: 'live',
    name: row.name || row.slug,
    verified: row.status === 'active' && Boolean(row.verified),
    verifiedLabel: 'Verified Organization',
    categories,
    location: [row.city, row.state, row.country].filter(Boolean).join(', '),
    website: row.website || '',
    email: row.contact_email || row.email || '',
    linkedin: row.linkedin_url || '',
    logoUrl: row.logo_url || null,
    description: row.description || row.summary || '',
    tags: asArray(row.tags),
    tabs: COMPANY_FIXTURE.tabs.map((t) => (t.id === 'people' ? { id: t.id, label: t.label } : t)),
    connect: {
      heading: `CONNECT WITH ${(row.name || '').toUpperCase()}`.trim(),
      status: '',
      body: '',
      primaryCta: 'CONNECT',
      secondaryCta: 'FOLLOW',
    },
    atAGlance: {
      heading: 'AT A GLANCE',
      rows: [
        row.founded_year && { id: 'founded', icon: 'check-circle', key: 'Founded', value: String(row.founded_year) },
        row.employee_count && { id: 'employees', icon: 'users', key: 'Employees', value: String(row.employee_count) },
        row.company_type && { id: 'org-type', icon: 'building', key: 'Organization Type', value: row.company_type },
        row.naics_code && { id: 'naics', icon: 'file', key: 'NAICS Code', value: String(row.naics_code) },
        (row.city || row.state) && { id: 'hq', icon: 'location', key: 'Headquarters', value: [row.city, row.state, row.country].filter(Boolean).join(', ') },
      ].filter(Boolean),
      footerLink: '',
    },
    capabilities: { heading: 'CAPABILITIES', total: 0, shown: [], footerLink: '' },
    missions: { heading: 'SPACE MISSIONS', rows: [], footerLink: '' },
    whatWeDo: { heading: 'WHAT WE DO', body: row.description || '', link: '' },
    whoWeWorkWith: { heading: 'WHO WE WORK WITH', counts: [], footerLink: '' },
    lookingFor: { heading: 'LOOKING FOR', left: { heading: '', items: [] }, right: { heading: '', items: [] }, footerLink: '' },
    locations: { heading: 'LOCATIONS', items: [], footerLink: '', highlight: asArray(row.state), markers: [] },
    activity: { heading: 'ACTIVITY HIGHLIGHTS', stats: [], footerLink: '' },
    footer: COMPANY_FIXTURE.footer,
  }
}

export async function fetchPersonProfile(slug) {
  if (!slug) return null
  if (slug === PREVIEW_SLUG) return { ...PERSON_FIXTURE, source: 'fixture' }
  if (!supabase) return null

  // There is no person table in production yet. This is the seam it will land
  // on; until then the query fails and the caller shows not-found.
  try {
    const { data, error } = await supabase
      .from('directory_people')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error || !data) return null
    return {
      slug: data.slug,
      kind: 'person',
      source: 'live',
      name: data.full_name || data.name || data.slug,
      verified: Boolean(data.verified),
      verifiedLabel: 'Verified',
      role: data.title || '',
      organization: data.organization || '',
      location: [data.city, data.state, data.country].filter(Boolean).join(', '),
      email: data.email || '',
      linkedin: data.linkedin_url || '',
      photoUrl: data.photo_url || null,
      bio: data.bio || '',
      tags: asArray(data.tags),
      tabs: PERSON_FIXTURE.tabs,
      availability: { heading: 'AVAILABILITY', status: data.availability || '', body: '', primaryCta: 'CONNECT' },
      about: { heading: 'ABOUT ME', body: data.bio || '', link: '' },
      capabilities: { heading: 'CAPABILITIES', total: 0, shown: [], footerLink: '' },
      missions: { heading: 'SPACE MISSIONS', rows: [] },
      lookingFor: { heading: "WHAT I'M LOOKING FOR", left: { heading: "I'M SEEKING", items: [] }, right: { heading: 'I CAN PROVIDE', items: [] } },
      affiliations: { heading: 'AFFILIATIONS', items: [], footerLink: '' },
      locationCard: { heading: 'LOCATION', city: data.city || '', note: '', highlight: asArray(data.state), markers: [] },
      activity: { heading: 'ACTIVITY HIGHLIGHTS', stats: [] },
    }
  } catch (err) {
    console.warn('fetchPersonProfile: no person source yet', err)
    return null
  }
}

export async function fetchCompanyProfile(slug) {
  if (!slug) return null
  if (slug === PREVIEW_SLUG) return { ...COMPANY_FIXTURE, source: 'fixture' }
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('directory_companies')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle()
    if (error || !data) return null
    return companyFromRow(data)
  } catch (err) {
    console.warn('fetchCompanyProfile: company read failed', err)
    return null
  }
}

export { PREVIEW_SLUG }
