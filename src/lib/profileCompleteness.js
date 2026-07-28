/**
 * profileCompleteness.js — one number (0-100) plus the named gaps.
 *
 * The number on its own is useless: "your profile is 60% complete" tells nobody
 * what to do next. So every call returns `missing`, the labelled list of fields
 * that are empty, in the order they appear on the screen. That list is what the
 * meter renders, and it is what an edit screen should link to.
 *
 * Fields are WEIGHTED because they are not equally load-bearing: a profile with
 * no name and no bio is not "the same 2 fields short" as one missing a LinkedIn
 * URL and a tag. Weights are integers so the arithmetic stays exact.
 */

const PERSON_FIELDS = [
  { field: 'name', label: 'Name', weight: 3, get: (p) => p.name },
  { field: 'role', label: 'Title', weight: 2, get: (p) => p.role },
  { field: 'organization', label: 'Organization', weight: 2, get: (p) => p.organization },
  { field: 'photoUrl', label: 'Photo', weight: 2, get: (p) => p.photoUrl },
  { field: 'location', label: 'Location', weight: 2, get: (p) => p.location },
  { field: 'email', label: 'Email', weight: 1, get: (p) => p.email },
  { field: 'linkedin', label: 'LinkedIn', weight: 1, get: (p) => p.linkedin },
  { field: 'bio', label: 'Bio', weight: 3, get: (p) => p.bio },
  { field: 'tags', label: 'Focus tags', weight: 2, get: (p) => p.tags },
  { field: 'capabilities', label: 'Capabilities', weight: 3, get: (p) => p.capabilities && p.capabilities.shown },
  { field: 'missions', label: 'Mission alignment', weight: 3, get: (p) => p.missions && p.missions.rows },
  { field: 'seeking', label: 'What you are seeking', weight: 2, get: (p) => p.lookingFor && p.lookingFor.left && p.lookingFor.left.items },
  { field: 'providing', label: 'What you provide', weight: 2, get: (p) => p.lookingFor && p.lookingFor.right && p.lookingFor.right.items },
  { field: 'affiliations', label: 'Affiliations', weight: 2, get: (p) => p.affiliations && p.affiliations.items },
]

const COMPANY_FIELDS = [
  { field: 'name', label: 'Name', weight: 3, get: (c) => c.name },
  { field: 'logoUrl', label: 'Logo', weight: 2, get: (c) => c.logoUrl },
  { field: 'categories', label: 'Categories', weight: 2, get: (c) => c.categories },
  { field: 'location', label: 'Location', weight: 2, get: (c) => c.location },
  { field: 'website', label: 'Website', weight: 2, get: (c) => c.website },
  { field: 'email', label: 'Contact email', weight: 1, get: (c) => c.email },
  { field: 'linkedin', label: 'LinkedIn', weight: 1, get: (c) => c.linkedin },
  { field: 'description', label: 'Description', weight: 3, get: (c) => c.description },
  { field: 'tags', label: 'Focus tags', weight: 2, get: (c) => c.tags },
  { field: 'atAGlance', label: 'Company facts', weight: 2, get: (c) => c.atAGlance && c.atAGlance.rows },
  { field: 'capabilities', label: 'Capabilities', weight: 3, get: (c) => c.capabilities && c.capabilities.shown },
  { field: 'missions', label: 'Mission alignment', weight: 3, get: (c) => c.missions && c.missions.rows },
  { field: 'whoWeWorkWith', label: 'Who you work with', weight: 2, get: (c) => c.whoWeWorkWith && c.whoWeWorkWith.counts },
  { field: 'needs', label: 'What you are looking for', weight: 2, get: (c) => c.lookingFor && c.lookingFor.left && c.lookingFor.left.items },
  { field: 'locations', label: 'Locations', weight: 2, get: (c) => c.locations && c.locations.items },
]

function filled(v) {
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return true
  return Boolean(v)
}

function score(profile, fields) {
  if (!profile) {
    return { percent: 0, missing: fields.map((f) => ({ field: f.field, label: f.label })), total: 0, earned: 0 }
  }
  let total = 0
  let earned = 0
  const missing = []
  for (const f of fields) {
    total += f.weight
    if (filled(f.get(profile))) earned += f.weight
    else missing.push({ field: f.field, label: f.label })
  }
  return {
    percent: total ? Math.round((earned / total) * 100) : 0,
    missing,
    total,
    earned,
  }
}

/** Person or company, dispatched on profile.kind. */
export function computeProfileCompleteness(profile) {
  const fields = profile && profile.kind === 'company' ? COMPANY_FIELDS : PERSON_FIELDS
  return score(profile, fields)
}

export function computePersonCompleteness(profile) {
  return score(profile, PERSON_FIELDS)
}

export function computeCompanyCompleteness(profile) {
  return score(profile, COMPANY_FIELDS)
}

export { PERSON_FIELDS, COMPANY_FIELDS }
export default computeProfileCompleteness
