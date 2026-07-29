import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, CardHeader, CardBody, CardFooter, Button, ButtonRow, EmptyState,
  CompletenessMeter,
} from '../../components/osv3/index.js'
import {
  loadCompanyForEdit, loadMissionTags, getViewerContext,
  canEditCompanyProfile, canEditCompanyCore,
  saveCompanyGlance, saveCompanyCounts, saveCompanyDescription,
  saveCompanyCapabilities, saveCompanyNeeds, saveCompanyLocations,
  saveMissionScores, COUNT_COLUMNS,
} from '../../lib/profileWrite.js'
import { computeCompanyCompleteness } from '../../lib/profileCompleteness.js'
import {
  Field, TextInput, TextArea, CheckField, FieldGrid, FormGroup,
  Repeater, TagListField, SaveBar, useSaver,
} from './ProfileEditPerson.jsx'
import '../../styles/osv3-profile.css'

/**
 * /profile/edit?company=<slug> — the organization record, editable by its
 * approved members.
 *
 * The form primitives are imported from ProfileEditPerson.jsx. That is not
 * where they belong; the note at the top of that file explains why they are
 * there and what to do about it.
 *
 * ===========================================================================
 * TWO DIFFERENT EDIT RIGHTS ON ONE SCREEN
 * ===========================================================================
 * Almost everything here writes tables migration 032 created, where the policy
 * is "approved member of this company, or admin". But the organization's
 * DESCRIPTION lives on directory_companies, whose only UPDATE policy
 * (migrations/017) requires a TENANT ADMIN. So the description card is rendered
 * only for tenant admins, and everyone else is told who to ask instead of being
 * handed a Save button the database will refuse.
 *
 * That asymmetry is a fact about the current schema, not a design choice. It
 * goes away when 028 grants approved members UPDATE on the safe columns.
 *
 * ===========================================================================
 * THE ENRICHMENT ROW USUALLY DOES NOT EXIST YET
 * ===========================================================================
 * 165 of the 166 organizations have no directory_company_profile row. Every
 * save here is an UPSERT on company_id, so the first save is what creates it,
 * and each card sends only its own columns — the counts card cannot blank the
 * at-a-glance card.
 */

const emptyGlance = {
  linkedin_url: '', org_type: '', naics_code: '', headquarters_label: '',
  categories: [], focus_areas: [],
}

const emptyCounts = Object.fromEntries(COUNT_COLUMNS.map((k) => [k, '0']))

const COUNT_LABELS = {
  suppliers_count: 'Suppliers',
  partners_count: 'Partners',
  customers_count: 'Customers',
  universities_count: 'Universities',
  gov_programs_count: 'Government programs',
  investors_count: 'Investors',
}

const idsOf = (rows) => rows.map((r) => r.id).filter(Boolean)

function toCompletenessShape(company, glance, counts, capabilities, needs, locations, missionScores) {
  return {
    kind: 'company',
    name: company.name,
    logoUrl: company.logo_url,
    categories: glance.categories,
    location: [company.city, company.state].filter(Boolean).join(', '),
    website: company.website,
    email: company.email,
    linkedin: glance.linkedin_url,
    description: company.description,
    tags: glance.focus_areas,
    atAGlance: { rows: [glance.org_type, glance.naics_code, glance.headquarters_label].filter(Boolean) },
    capabilities: { shown: capabilities.filter((c) => c.name) },
    missions: { rows: missionScores },
    whoWeWorkWith: { counts: COUNT_COLUMNS.filter((k) => Number(counts[k]) > 0) },
    lookingFor: { left: { items: needs.filter((n) => n.kind === 'seeking' && n.label) } },
    locations: { items: locations.filter((l) => l.label) },
  }
}

export default function ProfileEditCompany({ slug, section }) {
  const [phase, setPhase] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [company, setCompany] = useState(null)
  const [canEditCore, setCanEditCore] = useState(false)

  const [description, setDescription] = useState('')
  const [glance, setGlance] = useState(emptyGlance)
  const [counts, setCounts] = useState(emptyCounts)
  const [capabilities, setCapabilities] = useState([])
  const [seeking, setSeeking] = useState([])
  const [providing, setProviding] = useState([])
  const [locations, setLocations] = useState([])
  const [missionTags, setMissionTags] = useState([])
  const [missionScores, setMissionScores] = useState([])
  const [scoreDraft, setScoreDraft] = useState({})

  const loaded = useRef({ caps: [], needs: [], loc: [] })

  const [descState, saveDesc] = useSaver()
  const [glanceState, saveGlanceRow] = useSaver()
  const [countsState, saveCountsRow] = useSaver()
  const [capsState, saveCaps] = useSaver()
  const [needsState, saveNeeds] = useSaver()
  const [locState, saveLoc] = useSaver()
  const [missionState, saveMissions] = useSaver()

  useEffect(() => { document.title = 'Edit organization | SpaceOS' }, [])

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    ;(async () => {
      const { data: viewer, error: viewerError } = await getViewerContext()
      if (cancelled) return
      if (viewerError) { setLoadError(viewerError.message); setPhase('error'); return }
      if (!viewer.signedIn) { setPhase('signedout'); return }

      const { data, error } = await loadCompanyForEdit(slug)
      if (cancelled) return
      if (error) {
        if (error.code === 'NOT_FOUND') { setPhase('notfound'); return }
        setLoadError(error.message); setPhase('error'); return
      }
      if (!canEditCompanyProfile(viewer, data.company)) { setPhase('denied'); return }

      const tags = await loadMissionTags()
      if (cancelled) return

      setCompany(data.company)
      setCanEditCore(canEditCompanyCore(viewer, data.company))
      setDescription(data.company.description || '')

      const p = data.profile
      setGlance({
        linkedin_url: p?.linkedin_url || '',
        org_type: p?.org_type || '',
        naics_code: p?.naics_code || '',
        headquarters_label: p?.headquarters_label || '',
        categories: Array.isArray(p?.categories) ? p.categories : [],
        focus_areas: Array.isArray(p?.focus_areas) ? p.focus_areas : [],
      })
      setCounts(Object.fromEntries(
        COUNT_COLUMNS.map((k) => [k, String(p && p[k] !== null && p[k] !== undefined ? p[k] : 0)]),
      ))
      setCapabilities(data.capabilities)
      setSeeking(data.needs.filter((n) => n.kind === 'seeking'))
      setProviding(data.needs.filter((n) => n.kind === 'providing'))
      setLocations(data.locations)
      setMissionScores(data.missionScores)
      setMissionTags(tags.data || [])
      setScoreDraft(Object.fromEntries(data.missionScores.map((s) => [s.tag_id, String(s.score)])))
      loaded.current = {
        caps: idsOf(data.capabilities),
        needs: idsOf(data.needs),
        loc: idsOf(data.locations),
      }
      setPhase('ready')
    })()
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (phase !== 'ready' || !section) return
    const el = document.getElementById(`edit-${section}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase, section])

  const completeness = useMemo(() => {
    if (!company) return { percent: 0, missing: [] }
    return computeCompanyCompleteness(toCompletenessShape(
      { ...company, description },
      glance, counts, capabilities, [...seeking, ...providing], locations, missionScores,
    ))
  }, [company, description, glance, counts, capabilities, seeking, providing, locations, missionScores])

  /** Reload one list after it saves, so ids from freshly inserted rows are the
   *  ones the next save edits rather than inserting duplicates. */
  const reload = async (apply) => {
    const fresh = await loadCompanyForEdit(slug)
    if (fresh.data) apply(fresh.data)
  }

  if (phase === 'loading') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <p className="osv3p-prose">Loading this organization…</p>
      </div>
    )
  }

  if (phase === 'signedout') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="building"
          title="Sign in to edit an organization"
          body="An organization record is edited by its approved members."
        />
        <ButtonRow><Button variant="primary" icon="send" href="/login">Sign in</Button></ButtonRow>
      </div>
    )
  }

  if (phase === 'notfound') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="building"
          title="No organization at this address"
          body="There is no organization record here, or it is not one your account can open."
        />
      </div>
    )
  }

  if (phase === 'denied') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="shield"
          title="This organization is not yours to edit"
          body="Organization records are edited by approved members. If you work here, ask one of your organization's admins to approve your membership and this page opens."
        />
        <ButtonRow>
          <Button variant="quiet" icon="building" href={`/company/${slug}`}>Back to the organization</Button>
        </ButtonRow>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState icon="cross" title="This organization could not be opened" body={loadError} />
      </div>
    )
  }

  const gfe = glanceState.fieldErrors
  const cfe = countsState.fieldErrors

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Edit {company.name}</h1>
          <p className="osv3p-pagehead-sub">
            What members see on your organization page. Each section saves on its own.
          </p>
        </div>
        <Button variant="quiet" icon="eye" href={`/company/${company.slug}`}>View public page</Button>
      </header>

      <Card>
        <CardBody>
          <CompletenessMeter
            percent={completeness.percent}
            missing={completeness.missing}
            label="PAGE COMPLETENESS"
          />
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-description">
        <Card>
          <CardHeader title="WHAT WE DO" />
          <CardBody>
            {canEditCore ? (
              <Field id="c-desc" label="Description" error={descState.fieldErrors.description}
                hint="The paragraph at the top of your page, and the first thing anyone reads.">
                <TextArea id="c-desc" rows={8} value={description} onChange={setDescription}
                  invalid={Boolean(descState.fieldErrors.description)} />
              </Field>
            ) : (
              <>
                <p className="osv3p-prose">{description || 'No description has been written yet.'}</p>
                <p className="osv3p-field-hint">
                  Only an organization admin can change this. Everything else on this page is yours to edit.
                </p>
              </>
            )}
          </CardBody>
          {canEditCore ? (
            <CardFooter>
              <SaveBar
                state={descState}
                label="Save description"
                onSave={() => saveDesc(
                  () => saveCompanyDescription(company.id, description),
                  'The description is saved and live on your page.',
                )}
              />
            </CardFooter>
          ) : null}
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-glance">
        <Card>
          <CardHeader title="AT A GLANCE" />
          <CardBody>
            <div className="osv3p-form">
              <FieldGrid>
                <Field id="c-orgtype" label="Organization type"
                  hint='Like "Private Company" or "Research Institution".'>
                  <TextInput id="c-orgtype" value={glance.org_type}
                    onChange={(v) => setGlance((g) => ({ ...g, org_type: v }))} />
                </Field>
                <Field id="c-naics" label="NAICS code" hint="One or several, separated by commas.">
                  <TextInput id="c-naics" value={glance.naics_code}
                    onChange={(v) => setGlance((g) => ({ ...g, naics_code: v }))} />
                </Field>
                <Field id="c-hq" label="Headquarters" hint='As you would print it: "Long Beach, CA, USA".'>
                  <TextInput id="c-hq" value={glance.headquarters_label}
                    onChange={(v) => setGlance((g) => ({ ...g, headquarters_label: v }))} />
                </Field>
                <Field id="c-linkedin" label="LinkedIn" error={gfe.linkedin_url}>
                  <TextInput id="c-linkedin" value={glance.linkedin_url} invalid={Boolean(gfe.linkedin_url)}
                    onChange={(v) => setGlance((g) => ({ ...g, linkedin_url: v }))} />
                </Field>
              </FieldGrid>

              <TagListField
                label="Categories"
                hint="The line under your name. What kind of organization this is."
                values={glance.categories}
                onChange={(v) => setGlance((g) => ({ ...g, categories: v }))}
                addLabel="Add a category"
              />

              <TagListField
                label="Focus tags"
                hint="The chips members filter the directory by."
                values={glance.focus_areas}
                onChange={(v) => setGlance((g) => ({ ...g, focus_areas: v }))}
                addLabel="Add a tag"
              />
            </div>
          </CardBody>
          <CardFooter>
            <SaveBar
              state={glanceState}
              label="Save details"
              onSave={() => saveGlanceRow(
                () => saveCompanyGlance(company.id, glance),
                'Saved. These are live on your page.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-counts">
        <Card>
          <CardHeader title="WHO WE WORK WITH" />
          <CardBody>
            <p className="osv3p-field-hint">
              These are counts you keep yourself — nothing in the directory calculates them. Leave them
              all at zero and the card is not shown at all, which is better than printing six zeros.
            </p>
            <FieldGrid thirds>
              {COUNT_COLUMNS.map((key) => (
                <Field key={key} id={`c-${key}`} label={COUNT_LABELS[key]} error={cfe[key]}>
                  <TextInput id={`c-${key}`} type="number" value={counts[key]}
                    invalid={Boolean(cfe[key])}
                    onChange={(v) => setCounts((c) => ({ ...c, [key]: v }))} />
                </Field>
              ))}
            </FieldGrid>
          </CardBody>
          <CardFooter>
            <SaveBar
              state={countsState}
              label="Save counts"
              onSave={() => saveCountsRow(
                () => saveCompanyCounts(company.id, counts),
                'Saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-capabilities">
        <Card>
          <CardHeader title="CAPABILITIES" count={capabilities.filter((c) => c.name).length || null} />
          <CardBody>
            <p className="osv3p-field-hint">
              What your organization actually does. This is what members search on.
            </p>
            <Repeater
              items={capabilities}
              onChange={setCapabilities}
              blank={() => ({ name: '', subtitle: '' })}
              addLabel="Add a capability"
              emptyText="No capabilities listed yet."
              rowErrors={capsState.rowErrors}
              renderRow={(row, i, patch) => (
                <FieldGrid>
                  <Field id={`ccap-${i}`} label="Capability">
                    <TextInput id={`ccap-${i}`} value={row.name} onChange={(v) => patch({ name: v })} />
                  </Field>
                  <Field id={`ccap-s-${i}`} label="One-line description">
                    <TextInput id={`ccap-s-${i}`} value={row.subtitle} onChange={(v) => patch({ subtitle: v })} />
                  </Field>
                </FieldGrid>
              )}
            />
          </CardBody>
          <CardFooter>
            <SaveBar
              state={capsState}
              label="Save capabilities"
              onSave={() => saveCaps(
                async () => {
                  const res = await saveCompanyCapabilities(company.id, capabilities, loaded.current.caps)
                  if (!res.error) {
                    await reload((d) => { setCapabilities(d.capabilities); loaded.current.caps = idsOf(d.capabilities) })
                  }
                  return res
                },
                'Your capabilities are saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-needs">
        <Card>
          <CardHeader title="LOOKING FOR" />
          <CardBody>
            <div className="osv3p-form">
              <FormGroup title="We are seeking">
                <Repeater
                  items={seeking}
                  onChange={setSeeking}
                  blank={() => ({ kind: 'seeking', label: '', detail: '' })}
                  addLabel="Add something you are seeking"
                  emptyText="Nothing listed yet."
                  renderRow={(row, i, patch) => (
                    <FieldGrid>
                      <Field id={`cseek-${i}`} label="What you need">
                        <TextInput id={`cseek-${i}`} value={row.label} onChange={(v) => patch({ label: v })} />
                      </Field>
                      <Field id={`cseek-d-${i}`} label="Detail (optional)">
                        <TextInput id={`cseek-d-${i}`} value={row.detail} onChange={(v) => patch({ detail: v })} />
                      </Field>
                    </FieldGrid>
                  )}
                />
              </FormGroup>
              <FormGroup title="We can provide">
                <Repeater
                  items={providing}
                  onChange={setProviding}
                  blank={() => ({ kind: 'providing', label: '', detail: '' })}
                  addLabel="Add something you can offer"
                  emptyText="Nothing listed yet."
                  renderRow={(row, i, patch) => (
                    <FieldGrid>
                      <Field id={`cprov-${i}`} label="What you offer">
                        <TextInput id={`cprov-${i}`} value={row.label} onChange={(v) => patch({ label: v })} />
                      </Field>
                      <Field id={`cprov-d-${i}`} label="Detail (optional)">
                        <TextInput id={`cprov-d-${i}`} value={row.detail} onChange={(v) => patch({ detail: v })} />
                      </Field>
                    </FieldGrid>
                  )}
                />
              </FormGroup>
            </div>
          </CardBody>
          <CardFooter>
            <SaveBar
              state={needsState}
              label="Save what you are looking for"
              onSave={() => saveNeeds(
                async () => {
                  const res = await saveCompanyNeeds(company.id, seeking, providing, loaded.current.needs)
                  if (!res.error) {
                    await reload((d) => {
                      setSeeking(d.needs.filter((n) => n.kind === 'seeking'))
                      setProviding(d.needs.filter((n) => n.kind === 'providing'))
                      loaded.current.needs = idsOf(d.needs)
                    })
                  }
                  return res
                },
                'Saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-locations">
        <Card>
          <CardHeader title="LOCATIONS" count={locations.filter((l) => l.label).length || null} />
          <CardBody>
            <p className="osv3p-field-hint">
              The state code is what paints your organization on the US map. Leave it blank for a site
              outside the US and it is listed beside the map instead.
            </p>
            <Repeater
              items={locations}
              onChange={setLocations}
              blank={() => ({ label: '', place: '', city: '', state_code: '', country_code: '', is_headquarters: false })}
              addLabel="Add a location"
              emptyText="No locations yet."
              rowErrors={locState.rowErrors}
              renderRow={(row, i, patch) => (
                <>
                  <FieldGrid>
                    <Field id={`loc-l-${i}`} label="Name" hint='Like "Launch Complex 1" or "Head office".'>
                      <TextInput id={`loc-l-${i}`} value={row.label} onChange={(v) => patch({ label: v })} />
                    </Field>
                    <Field id={`loc-p-${i}`} label="Place" hint='As printed: "Mahia, New Zealand".'>
                      <TextInput id={`loc-p-${i}`} value={row.place} onChange={(v) => patch({ place: v })} />
                    </Field>
                  </FieldGrid>
                  <FieldGrid thirds>
                    <Field id={`loc-c-${i}`} label="City">
                      <TextInput id={`loc-c-${i}`} value={row.city} onChange={(v) => patch({ city: v })} />
                    </Field>
                    <Field id={`loc-s-${i}`} label="State code">
                      <TextInput id={`loc-s-${i}`} value={row.state_code} maxLength={2}
                        onChange={(v) => patch({ state_code: v })} />
                    </Field>
                    <Field id={`loc-cc-${i}`} label="Country code">
                      <TextInput id={`loc-cc-${i}`} value={row.country_code} maxLength={3}
                        onChange={(v) => patch({ country_code: v })} />
                    </Field>
                  </FieldGrid>
                  <CheckField id={`loc-hq-${i}`} label="This is the headquarters"
                    checked={row.is_headquarters} onChange={(v) => patch({ is_headquarters: v })} />
                </>
              )}
            />
          </CardBody>
          <CardFooter>
            <SaveBar
              state={locState}
              label="Save locations"
              onSave={() => saveLoc(
                async () => {
                  const res = await saveCompanyLocations(company.id, locations, loaded.current.loc)
                  if (!res.error) {
                    await reload((d) => { setLocations(d.locations); loaded.current.loc = idsOf(d.locations) })
                  }
                  return res
                },
                'Your locations are saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-missions">
        <Card>
          <CardHeader title="SPACE MISSIONS" />
          <CardBody>
            {missionTags.length === 0 ? (
              <p className="osv3p-empty-body">The six space missions are not loaded, so alignment cannot be set here yet.</p>
            ) : (
              <>
                <p className="osv3p-field-hint">
                  How much of this organization's work sits against each mission, 0 to 100. A mission
                  left blank is not shown.
                </p>
                <FieldGrid>
                  {missionTags.map((tag) => (
                    <Field key={tag.id} id={`cmission-${tag.id}`} label={tag.name}
                      error={missionState.fieldErrors[tag.id]}>
                      <TextInput
                        id={`cmission-${tag.id}`}
                        type="number"
                        value={scoreDraft[tag.id] === undefined ? '' : scoreDraft[tag.id]}
                        invalid={Boolean(missionState.fieldErrors[tag.id])}
                        onChange={(v) => setScoreDraft((d) => ({ ...d, [tag.id]: v }))}
                      />
                    </Field>
                  ))}
                </FieldGrid>
              </>
            )}
          </CardBody>
          <CardFooter>
            <SaveBar
              state={missionState}
              disabled={missionTags.length === 0}
              label="Save mission alignment"
              onSave={() => saveMissions(
                async () => {
                  const res = await saveMissionScores('company', company.id, scoreDraft, missionScores)
                  if (!res.error) {
                    await reload((d) => {
                      setMissionScores(d.missionScores)
                      setScoreDraft(Object.fromEntries(d.missionScores.map((s) => [s.tag_id, String(s.score)])))
                    })
                  }
                  return res
                },
                'Mission alignment is saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
