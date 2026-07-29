import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, CardHeader, CardBody, CardFooter, Button, ButtonRow, EmptyState, Icon,
  CompletenessMeter,
} from '../../components/osv3/index.js'
import {
  loadPersonForEdit, loadMissionTags, getViewerContext, canEditPerson,
  savePersonProfile, savePersonCapabilities, savePersonNeeds,
  savePersonAffiliations, savePersonExperience, saveMissionScores,
} from '../../lib/profileWrite.js'
import { computePersonCompleteness } from '../../lib/profileCompleteness.js'
import '../../styles/osv3-profile.css'

/**
 * /profile/edit?person=<slug> — the person profile, editable by the person.
 *
 * ===========================================================================
 * WHY THE FORM PRIMITIVES LIVE IN THIS FILE
 * ===========================================================================
 * They are exported from here and imported by ProfileEditCompany.jsx, which is
 * not where shared components belong. Three agents are editing this checkout in
 * parallel and the file list for this work is exactly four files, so a fifth
 * shared module was not mine to create. When the checkout is quiet, lift
 * everything between the two RULE banners into
 * src/components/osv3/Form.jsx and re-point both imports. Nothing else uses them.
 *
 * ===========================================================================
 * NO INLINE STYLES, AND SOME CLASSES DO NOT EXIST YET  <- READ THIS FIRST
 * ===========================================================================
 * src/styles/osv3-profile.css is owned by another agent and has NO form rules
 * in it — no input, no label, no fieldset, nothing. The markup below therefore
 * names the classes the stylesheet needs, and until they land these controls
 * render at browser defaults: functional and legible, but unstyled.
 *
 * That is deliberate. An inline style would look finished and be invisible to
 * design_spacing_check.py, which is the exact failure the no-inline-styles rule
 * exists to stop. This is the whole list — it is the CSS contract for both edit
 * screens, and nothing outside it is used:
 *
 *   .osv3p-form              the form column        gap: var(--p-6)
 *   .osv3p-formgroup         one titled group       gap: var(--p-3)
 *   .osv3p-formgroup-title   its heading            --t-label, uppercase, ink-secondary
 *   .osv3p-fieldgrid         2 columns              gap: var(--p-4); 1 col under 640px
 *   .osv3p-fieldgrid--thirds 3 columns              same gap
 *   .osv3p-field             label + control + msg  gap: var(--p-1)
 *   .osv3p-field--wide       spans the whole grid   grid-column: 1 / -1
 *   .osv3p-field--invalid    the error state hook
 *   .osv3p-field-label       --t-label, uppercase
 *   .osv3p-field-hint        --t-meta, ink-secondary
 *   .osv3p-field-error       --t-meta, --v3-accent
 *   .osv3p-input             --t-body, --p-hair border, --p-radius-sm,
 *                            padding: var(--p-2); width 100%
 *   .osv3p-textarea          same, plus resize: vertical
 *   .osv3p-select            same as input
 *   .osv3p-input--invalid    border: 1px solid var(--v3-accent)
 *   .osv3p-check             checkbox row           gap: var(--p-2), align center
 *   .osv3p-check-box         the input
 *   .osv3p-check-label       --t-body
 *   .osv3p-repeater          list column            gap: var(--p-3)
 *   .osv3p-repeater-row      one item + its remove  --p-hair, --p-radius-sm,
 *                            padding: var(--p-3), gap: var(--p-3)
 *   .osv3p-repeater-fields   the fields inside it   gap: var(--p-2)
 *   .osv3p-repeater-remove   quiet text button      --t-label, uppercase
 *   .osv3p-repeater-empty    --t-meta, ink-secondary
 *   .osv3p-savebar           button + message       gap: var(--p-3), align center
 *   .osv3p-savebar-msg       --t-meta
 *   .osv3p-savebar-msg--ok   --t-meta, positive ink
 *   .osv3p-savebar-msg--err  --t-meta, --v3-accent
 *
 * Every value above is already on the 8-step spacing scale and the 7-size type
 * ladder declared at the top of osv3-profile.css, so adding them does not put a
 * ninth size or an off-grid gap into the sheet.
 *
 * ===========================================================================
 * ONE SAVE PER TABLE
 * ===========================================================================
 * Each card owns one table and one Save. Capabilities save without touching the
 * bio; a failed affiliation save cannot take the rest of the profile with it;
 * and every confirmation names what was actually written. A single page-wide
 * Save across six tables would have to report "partly saved", which is not a
 * state anyone can act on.
 */

/* ═══════════════════════════ RULE: SHARED FORM PRIMITIVES — START ═════════ */

/** One labelled control. `error` is rendered right here, under the input it
 *  belongs to — a field-level problem never becomes a page-level banner. */
export function Field({ id, label, hint, error, children, wide }) {
  const cls = ['osv3p-field']
  if (wide) cls.push('osv3p-field--wide')
  if (error) cls.push('osv3p-field--invalid')
  return (
    <div className={cls.join(' ')}>
      <label className="osv3p-field-label" htmlFor={id}>{label}</label>
      {children}
      {hint && !error ? <p className="osv3p-field-hint">{hint}</p> : null}
      {error ? <p className="osv3p-field-error" role="alert">{error}</p> : null}
    </div>
  )
}

export function TextInput({ id, value, onChange, type = 'text', placeholder, invalid, maxLength, autoComplete }) {
  return (
    <input
      id={id}
      className={invalid ? 'osv3p-input osv3p-input--invalid' : 'osv3p-input'}
      type={type}
      value={value === null || value === undefined ? '' : value}
      placeholder={placeholder}
      maxLength={maxLength}
      autoComplete={autoComplete}
      aria-invalid={invalid ? 'true' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function TextArea({ id, value, onChange, rows = 4, placeholder, invalid, maxLength }) {
  return (
    <textarea
      id={id}
      className={invalid ? 'osv3p-textarea osv3p-input--invalid' : 'osv3p-textarea'}
      rows={rows}
      value={value === null || value === undefined ? '' : value}
      placeholder={placeholder}
      maxLength={maxLength}
      aria-invalid={invalid ? 'true' : undefined}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export function SelectInput({ id, value, onChange, options, invalid }) {
  return (
    <select
      id={id}
      className={invalid ? 'osv3p-select osv3p-input--invalid' : 'osv3p-select'}
      value={value === null || value === undefined ? '' : value}
      aria-invalid={invalid ? 'true' : undefined}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function CheckField({ id, label, checked, onChange }) {
  return (
    <div className="osv3p-check">
      <input
        id={id}
        className="osv3p-check-box"
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="osv3p-check-label" htmlFor={id}>{label}</label>
    </div>
  )
}

export function FieldGrid({ children, thirds }) {
  return <div className={thirds ? 'osv3p-fieldgrid osv3p-fieldgrid--thirds' : 'osv3p-fieldgrid'}>{children}</div>
}

export function FormGroup({ title, children }) {
  return (
    <div className="osv3p-formgroup">
      {title ? <h3 className="osv3p-formgroup-title">{title}</h3> : null}
      {children}
    </div>
  )
}

let keySeed = 0
const nextKey = () => { keySeed += 1; return keySeed }

/**
 * A list you can add to, reorder-free, and remove from.
 *
 * `rowErrors` is keyed by the row's index in `items`, which is why the write
 * seam reports rowIndex against the array the screen holds rather than against
 * its own filtered copy.
 */
export function Repeater({ items, onChange, blank, renderRow, addLabel, emptyText, rowErrors }) {
  const patch = (index, changes) => {
    onChange(items.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }
  const remove = (index) => onChange(items.filter((_, i) => i !== index))
  // A new row gets a stable local key so removing the row above it does not
  // remount the one you are typing in and eat the keystroke.
  const add = () => onChange([...items, { ...blank(), _key: `new-${nextKey()}` }])

  return (
    <div className="osv3p-repeater">
      {items.length === 0 ? <p className="osv3p-repeater-empty">{emptyText}</p> : null}
      {items.map((row, i) => (
        <div className="osv3p-repeater-row" key={row.id || row._key || `new-${i}`}>
          <div className="osv3p-repeater-fields">
            {renderRow(row, i, (changes) => patch(i, changes))}
            {rowErrors && rowErrors[i]
              ? <p className="osv3p-field-error" role="alert">{rowErrors[i]}</p>
              : null}
          </div>
          <button
            type="button"
            className="osv3p-repeater-remove"
            onClick={() => remove(i)}
            aria-label="Remove this item"
          >
            <Icon name="cross" />
            Remove
          </button>
        </div>
      ))}
      <ButtonRow>
        <Button variant="quiet" icon="plus" onClick={add}>{addLabel}</Button>
      </ButtonRow>
    </div>
  )
}

/** A text[] column: one input per value, add and remove. */
export function TagListField({ label, hint, values, onChange, addLabel }) {
  return (
    <FormGroup title={label}>
      {hint ? <p className="osv3p-field-hint">{hint}</p> : null}
      <Repeater
        items={values.map((v, i) => ({ value: v, _key: `tag-${i}` }))}
        onChange={(rows) => onChange(rows.map((r) => r.value))}
        blank={() => ({ value: '' })}
        addLabel={addLabel}
        emptyText="Nothing added yet."
        renderRow={(row, i, set) => (
          <Field id={`tag-${label}-${i}`} label={`Item ${i + 1}`}>
            <TextInput id={`tag-${label}-${i}`} value={row.value} onChange={(v) => set({ value: v })} />
          </Field>
        )}
      />
    </FormGroup>
  )
}

/**
 * The save control and everything it has to say.
 *
 * Three states are visible and distinct: idle, SAVING (the button is disabled
 * and says so), and the outcome — a named confirmation or the real error text.
 * There is no toast. A field-level problem is already sitting under its field;
 * this line carries only what is true of the whole save.
 */
export function SaveBar({ onSave, state, label = 'Save changes', disabled }) {
  const saving = state.status === 'saving'
  const off = saving || disabled
  // osv3-profile.css has no :disabled rule on .osv3p-btn, so a disabled solid
  // button still looks pressable. Dropping to the `quiet` variant while it is
  // off makes the state visible using a class that already exists, rather than
  // adding a rule to a stylesheet this work does not own.
  return (
    <div className="osv3p-savebar">
      <Button variant={off ? 'quiet' : 'solid'} icon="check-circle" onClick={onSave} disabled={off}>
        {saving ? 'Saving…' : label}
      </Button>
      {state.status === 'ok' ? (
        <p className="osv3p-savebar-msg osv3p-savebar-msg--ok" role="status">{state.message}</p>
      ) : null}
      {state.status === 'error' ? (
        <p className="osv3p-savebar-msg osv3p-savebar-msg--err" role="alert">{state.message}</p>
      ) : null}
      {saving ? <p className="osv3p-savebar-msg" role="status">Saving to your profile…</p> : null}
    </div>
  )
}

const IDLE = { status: 'idle', message: '', fieldErrors: {}, rowErrors: {} }

/**
 * One save, its state, and the errors it produced.
 *
 * `run` never throws and never reports success it did not observe: the write
 * seam returns `{ data, error }` and only a null error with data becomes 'ok'.
 */
export function useSaver() {
  const [state, setState] = useState(IDLE)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const run = useCallback(async (fn, successMessage) => {
    setState({ status: 'saving', message: '', fieldErrors: {}, rowErrors: {} })
    let result
    try {
      result = await fn()
    } catch (err) {
      result = { data: null, error: { code: 'THREW', message: err?.message || String(err) } }
    }
    if (!alive.current) return result
    if (result && result.error) {
      setState({
        status: 'error',
        message: result.error.message || 'That did not save.',
        fieldErrors: result.error.fieldErrors
          || (result.error.field ? { [result.error.field]: result.error.message } : {}),
        rowErrors: result.error.rowErrors
          || (result.error.rowIndex !== undefined ? { [result.error.rowIndex]: result.error.message } : {}),
      })
      return result
    }
    setState({ status: 'ok', message: successMessage, fieldErrors: {}, rowErrors: {} })
    return result
  }, [])

  const reset = useCallback(() => setState(IDLE), [])
  return [state, run, reset]
}

/* ═══════════════════════════ RULE: SHARED FORM PRIMITIVES — END ═══════════ */

const emptyForm = {
  full_name: '', slug: '', avatar_url: '', job_title: '', org_name: '',
  city: '', state: '', state_code: '', country: '',
  email: '', linkedin_url: '', website: '',
  bio_short: '', bio_long: '',
  focus_areas: [],
  availability_status: '', availability_note: '', accepts_connections: true,
  status: 'draft', published_at: null,
}

const VISIBILITY = [
  { value: 'draft', label: 'Draft — only you can see it' },
  { value: 'active', label: 'Published — anyone can find it' },
  { value: 'inactive', label: 'Hidden — taken down for now' },
]

const idsOf = (rows) => rows.map((r) => r.id).filter(Boolean)

/**
 * /profile/edit?person=_preview — the empty form, with saving off.
 *
 * The same convention profileApi.js already uses for /people/_preview, and for
 * the same reason it gives there: a screen that can only be reviewed by someone
 * holding a live member session cannot be reviewed. This renders the DAY-ONE
 * state — every field blank, which is what a member actually meets — and nothing
 * on it is invented. Every Save is disabled and says so, so it cannot be
 * mistaken for a form that quietly throws keystrokes away.
 */
export const PREVIEW_SLUG = '_preview'

/** The person record as the completeness meter expects to be handed it. */
function toCompletenessShape(form, capabilities, needs, affiliations, missionScores) {
  return {
    kind: 'person',
    name: form.full_name,
    role: form.job_title,
    organization: form.org_name,
    photoUrl: form.avatar_url,
    location: [form.city, form.state].filter(Boolean).join(', '),
    email: form.email,
    linkedin: form.linkedin_url,
    bio: form.bio_long || form.bio_short,
    tags: form.focus_areas,
    capabilities: { shown: capabilities.filter((c) => c.name) },
    missions: { rows: missionScores },
    lookingFor: {
      left: { items: needs.filter((n) => n.kind === 'seeking' && n.label) },
      right: { items: needs.filter((n) => n.kind === 'providing' && n.label) },
    },
    affiliations: { items: affiliations.filter((a) => a.org_name) },
  }
}

export default function ProfileEditPerson({ slug, section }) {
  const [phase, setPhase] = useState('loading')   // loading | denied | notfound | signedout | ready | error
  const [loadError, setLoadError] = useState('')
  const [person, setPerson] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const [capabilities, setCapabilities] = useState([])
  const [seeking, setSeeking] = useState([])
  const [providing, setProviding] = useState([])
  const [affiliations, setAffiliations] = useState([])
  const [experience, setExperience] = useState([])
  const [missionTags, setMissionTags] = useState([])
  const [missionScores, setMissionScores] = useState([])
  const [scoreDraft, setScoreDraft] = useState({})

  // The ids the record HAD when it was loaded. syncList deletes what is no
  // longer in the list, so this has to be the loaded set and not the live one.
  const loaded = useRef({ caps: [], needs: [], affil: [], exp: [] })

  const [detailsState, saveDetails] = useSaver()
  const [capsState, saveCaps] = useSaver()
  const [needsState, saveNeeds] = useSaver()
  const [affilState, saveAffil] = useSaver()
  const [expState, saveExp] = useSaver()
  const [missionState, saveMissions] = useSaver()

  useEffect(() => { document.title = 'Edit profile | SpaceOS' }, [])

  const preview = slug === PREVIEW_SLUG

  useEffect(() => {
    let cancelled = false
    setPhase('loading')
    ;(async () => {
      if (slug === PREVIEW_SLUG) {
        const tags = await loadMissionTags()
        if (cancelled) return
        setPerson({ id: null, slug: PREVIEW_SLUG })
        setForm(emptyForm)
        setMissionTags(tags.data || [])
        setPhase('ready')
        return
      }

      const { data: viewer, error: viewerError } = await getViewerContext()
      if (cancelled) return
      if (viewerError) { setLoadError(viewerError.message); setPhase('error'); return }
      if (!viewer.signedIn) { setPhase('signedout'); return }

      const { data, error } = await loadPersonForEdit(slug)
      if (cancelled) return
      if (error) {
        if (error.code === 'NOT_FOUND') { setPhase('notfound'); return }
        setLoadError(error.message); setPhase('error'); return
      }
      if (!canEditPerson(viewer, data.person)) { setPhase('denied'); return }

      const tags = await loadMissionTags()
      if (cancelled) return

      setPerson(data.person)
      setForm({
        ...emptyForm,
        ...Object.fromEntries(
          Object.keys(emptyForm).map((k) => [k, data.person[k] === null || data.person[k] === undefined ? emptyForm[k] : data.person[k]]),
        ),
        focus_areas: Array.isArray(data.person.focus_areas) ? data.person.focus_areas : [],
      })
      setCapabilities(data.capabilities)
      setSeeking(data.needs.filter((n) => n.kind === 'seeking'))
      setProviding(data.needs.filter((n) => n.kind === 'providing'))
      setAffiliations(data.affiliations)
      setExperience(data.experience)
      setMissionScores(data.missionScores)
      setMissionTags(tags.data || [])
      setScoreDraft(Object.fromEntries(data.missionScores.map((s) => [s.tag_id, String(s.score)])))
      loaded.current = {
        caps: idsOf(data.capabilities),
        needs: idsOf(data.needs),
        affil: idsOf(data.affiliations),
        exp: idsOf(data.experience),
      }
      setPhase('ready')
    })()
    return () => { cancelled = true }
  }, [slug])

  // Deep link from the profile's own "Edit" / "+ Add" affordances.
  useEffect(() => {
    if (phase !== 'ready' || !section) return
    const el = document.getElementById(`edit-${section}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase, section])

  const set = (changes) => setForm((f) => ({ ...f, ...changes }))

  // The meter moves as you type. profileCompleteness.js stays the single
  // definition of what "complete" means — this only shapes the live form into
  // the object it expects.
  const completeness = useMemo(
    () => computePersonCompleteness(
      toCompletenessShape(form, capabilities, [...seeking, ...providing], affiliations, missionScores),
    ),
    [form, capabilities, seeking, providing, affiliations, missionScores],
  )

  if (phase === 'loading') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <p className="osv3p-prose">Loading your profile…</p>
      </div>
    )
  }

  if (phase === 'signedout') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="users"
          title="Sign in to edit a profile"
          body="Editing is only open to the person a profile belongs to, and to the organization's approved members."
        />
        <ButtonRow><Button variant="primary" icon="send" href="/login">Sign in</Button></ButtonRow>
      </div>
    )
  }

  if (phase === 'notfound') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="users"
          title="No profile at this address"
          body="There is no profile record here, or it is not one your account can open."
        />
      </div>
    )
  }

  if (phase === 'denied') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="shield"
          title="This profile is not yours to edit"
          body="A profile is edited by the person it belongs to. If this is your organization's record and you should have access, ask an organization admin to approve your membership."
        />
        <ButtonRow>
          <Button variant="quiet" icon="users" href={`/people/${slug}`}>Back to the profile</Button>
        </ButtonRow>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState icon="cross" title="This profile could not be opened" body={loadError} />
      </div>
    )
  }

  const fe = detailsState.fieldErrors

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Edit profile</h1>
          <p className="osv3p-pagehead-sub">
            Everything here is what other members see at your public address. Each section saves on its own.
          </p>
        </div>
        <Button variant="quiet" icon="eye" href={`/people/${person.slug}`}>View public profile</Button>
      </header>

      {preview ? (
        <EmptyState
          icon="eye"
          title="Preview — nothing here saves"
          body="This is the edit screen exactly as a member meets it on day one: every field empty, every section still to fill in. It is rendered without a profile record behind it so the screen can be reviewed, so every Save below is switched off."
        />
      ) : null}

      <Card>
        <CardBody>
          <CompletenessMeter
            percent={completeness.percent}
            missing={completeness.missing}
            label="PROFILE COMPLETENESS"
          />
        </CardBody>
      </Card>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-details">
        <Card>
          <CardHeader title="YOUR DETAILS" />
          <CardBody>
            <div className="osv3p-form">
              <FormGroup title="Identity">
                <FieldGrid>
                  <Field id="f-name" label="Full name" error={fe.full_name}>
                    <TextInput id="f-name" value={form.full_name} invalid={Boolean(fe.full_name)}
                      onChange={(v) => set({ full_name: v })} autoComplete="name" />
                  </Field>
                  <Field id="f-slug" label="Public address" error={fe.slug}
                    hint={`Your profile lives at /people/${form.slug || 'your-name'}. Changing it breaks any link already shared.`}>
                    <TextInput id="f-slug" value={form.slug} invalid={Boolean(fe.slug)}
                      onChange={(v) => set({ slug: v })} />
                  </Field>
                  <Field id="f-title" label="Job title" error={fe.job_title}>
                    <TextInput id="f-title" value={form.job_title} onChange={(v) => set({ job_title: v })} />
                  </Field>
                  <Field id="f-org" label="Organization" error={fe.org_name}>
                    <TextInput id="f-org" value={form.org_name} onChange={(v) => set({ org_name: v })} />
                  </Field>
                  <Field id="f-photo" label="Photo link" error={fe.avatar_url} wide
                    hint="A link to a photo of you. Leave it blank and your initials are shown instead.">
                    <TextInput id="f-photo" value={form.avatar_url} invalid={Boolean(fe.avatar_url)}
                      onChange={(v) => set({ avatar_url: v })} />
                  </Field>
                </FieldGrid>
              </FormGroup>

              <FormGroup title="Where you are">
                <FieldGrid thirds>
                  <Field id="f-city" label="City">
                    <TextInput id="f-city" value={form.city} onChange={(v) => set({ city: v })} />
                  </Field>
                  <Field id="f-state" label="State or region">
                    <TextInput id="f-state" value={form.state} onChange={(v) => set({ state: v })} />
                  </Field>
                  <Field id="f-statecode" label="State code" error={fe.state_code}
                    hint="Two letters, like AZ. This is what highlights you on the map.">
                    <TextInput id="f-statecode" value={form.state_code} maxLength={2}
                      invalid={Boolean(fe.state_code)} onChange={(v) => set({ state_code: v })} />
                  </Field>
                  <Field id="f-country" label="Country">
                    <TextInput id="f-country" value={form.country} onChange={(v) => set({ country: v })} />
                  </Field>
                </FieldGrid>
              </FormGroup>

              <FormGroup title="How people reach you">
                <FieldGrid>
                  <Field id="f-email" label="Email" error={fe.email}>
                    <TextInput id="f-email" type="email" value={form.email} invalid={Boolean(fe.email)}
                      onChange={(v) => set({ email: v })} autoComplete="email" />
                  </Field>
                  <Field id="f-linkedin" label="LinkedIn" error={fe.linkedin_url}>
                    <TextInput id="f-linkedin" value={form.linkedin_url} invalid={Boolean(fe.linkedin_url)}
                      onChange={(v) => set({ linkedin_url: v })} />
                  </Field>
                  <Field id="f-website" label="Website" error={fe.website} wide>
                    <TextInput id="f-website" value={form.website} invalid={Boolean(fe.website)}
                      onChange={(v) => set({ website: v })} />
                  </Field>
                </FieldGrid>
              </FormGroup>

              <FormGroup title="About you">
                <Field id="f-bioshort" label="Short bio"
                  hint="The line that sits under your name. One or two sentences.">
                  <TextArea id="f-bioshort" rows={3} value={form.bio_short}
                    onChange={(v) => set({ bio_short: v })} />
                </Field>
                <Field id="f-biolong" label="Full bio"
                  hint="The ABOUT ME card. What you do, and why it matters.">
                  <TextArea id="f-biolong" rows={7} value={form.bio_long}
                    onChange={(v) => set({ bio_long: v })} />
                </Field>
              </FormGroup>

              <TagListField
                label="Focus tags"
                hint="The short chips under your bio. These are what members filter the directory by."
                values={form.focus_areas}
                onChange={(v) => set({ focus_areas: v })}
                addLabel="Add a tag"
              />

              <FormGroup title="Availability">
                <FieldGrid>
                  <Field id="f-avstatus" label="Status"
                    hint='Short, like "Open to advisory roles". Leave it blank and the panel is not shown.'>
                    <TextInput id="f-avstatus" value={form.availability_status}
                      onChange={(v) => set({ availability_status: v })} />
                  </Field>
                  <Field id="f-avnote" label="Note" wide>
                    <TextArea id="f-avnote" rows={3} value={form.availability_note}
                      onChange={(v) => set({ availability_note: v })} />
                  </Field>
                </FieldGrid>
                <CheckField id="f-accepts" label="Let members send me connection requests"
                  checked={form.accepts_connections}
                  onChange={(v) => set({ accepts_connections: v })} />
              </FormGroup>

              <FormGroup title="Visibility">
                <Field id="f-status" label="Who can see this profile"
                  hint="A draft profile is not in the directory and its public address shows nothing.">
                  <SelectInput id="f-status" value={form.status} options={VISIBILITY}
                    onChange={(v) => set({ status: v })} />
                </Field>
              </FormGroup>
            </div>
          </CardBody>
          <CardFooter>
            <SaveBar
              state={detailsState}
              disabled={preview}
              label="Save details"
              onSave={() => saveDetails(
                async () => {
                  const res = await savePersonProfile(person.id, form)
                  if (res.data) setPerson((p) => ({ ...p, ...res.data }))
                  return res
                },
                'Your details are saved and live on your profile.',
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
              The work you actually do. This is what the directory matches you against, so it earns
              more of your time than anything else on this page.
            </p>
            <Repeater
              items={capabilities}
              onChange={setCapabilities}
              blank={() => ({ name: '' })}
              addLabel="Add a capability"
              emptyText="No capabilities listed yet."
              rowErrors={capsState.rowErrors}
              renderRow={(row, i, patch) => (
                <Field id={`cap-${i}`} label={`Capability ${i + 1}`}>
                  <TextInput id={`cap-${i}`} value={row.name} onChange={(v) => patch({ name: v })} />
                </Field>
              )}
            />
          </CardBody>
          <CardFooter>
            <SaveBar
              state={capsState}
              disabled={preview}
              label="Save capabilities"
              onSave={() => saveCaps(
                async () => {
                  const res = await savePersonCapabilities(person.id, capabilities, loaded.current.caps)
                  if (!res.error) {
                    const fresh = await loadPersonForEdit(person.slug)
                    if (fresh.data) {
                      setCapabilities(fresh.data.capabilities)
                      loaded.current.caps = idsOf(fresh.data.capabilities)
                    }
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
          <CardHeader title="WHAT I'M LOOKING FOR" />
          <CardBody>
            <div className="osv3p-form">
              <FormGroup title="I'm seeking">
                <Repeater
                  items={seeking}
                  onChange={setSeeking}
                  blank={() => ({ kind: 'seeking', label: '', detail: '' })}
                  addLabel="Add something you are seeking"
                  emptyText="Nothing listed yet."
                  renderRow={(row, i, patch) => (
                    <FieldGrid>
                      <Field id={`seek-${i}`} label="What you need">
                        <TextInput id={`seek-${i}`} value={row.label} onChange={(v) => patch({ label: v })} />
                      </Field>
                      <Field id={`seek-d-${i}`} label="Detail (optional)">
                        <TextInput id={`seek-d-${i}`} value={row.detail} onChange={(v) => patch({ detail: v })} />
                      </Field>
                    </FieldGrid>
                  )}
                />
              </FormGroup>
              <FormGroup title="I can provide">
                <Repeater
                  items={providing}
                  onChange={setProviding}
                  blank={() => ({ kind: 'providing', label: '', detail: '' })}
                  addLabel="Add something you can offer"
                  emptyText="Nothing listed yet."
                  renderRow={(row, i, patch) => (
                    <FieldGrid>
                      <Field id={`prov-${i}`} label="What you offer">
                        <TextInput id={`prov-${i}`} value={row.label} onChange={(v) => patch({ label: v })} />
                      </Field>
                      <Field id={`prov-d-${i}`} label="Detail (optional)">
                        <TextInput id={`prov-d-${i}`} value={row.detail} onChange={(v) => patch({ detail: v })} />
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
              disabled={preview}
              label="Save what you are looking for"
              onSave={() => saveNeeds(
                async () => {
                  const res = await savePersonNeeds(person.id, seeking, providing, loaded.current.needs)
                  if (!res.error) {
                    const fresh = await loadPersonForEdit(person.slug)
                    if (fresh.data) {
                      setSeeking(fresh.data.needs.filter((n) => n.kind === 'seeking'))
                      setProviding(fresh.data.needs.filter((n) => n.kind === 'providing'))
                      loaded.current.needs = idsOf(fresh.data.needs)
                    }
                  }
                  return res
                },
                'Saved. This is the card that connects you to other members.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-affiliations">
        <Card>
          <CardHeader title="AFFILIATIONS" count={affiliations.filter((a) => a.org_name).length || null} />
          <CardBody>
            <Repeater
              items={affiliations}
              onChange={setAffiliations}
              blank={() => ({ org_name: '', role: '', org_logo_url: '', is_current: true })}
              addLabel="Add an affiliation"
              emptyText="No affiliations yet."
              rowErrors={affilState.rowErrors}
              renderRow={(row, i, patch) => (
                <>
                  <FieldGrid>
                    <Field id={`aff-org-${i}`} label="Organization">
                      <TextInput id={`aff-org-${i}`} value={row.org_name} onChange={(v) => patch({ org_name: v })} />
                    </Field>
                    <Field id={`aff-role-${i}`} label="Your role there">
                      <TextInput id={`aff-role-${i}`} value={row.role} onChange={(v) => patch({ role: v })} />
                    </Field>
                    <Field id={`aff-logo-${i}`} label="Logo link (optional)" wide>
                      <TextInput id={`aff-logo-${i}`} value={row.org_logo_url} onChange={(v) => patch({ org_logo_url: v })} />
                    </Field>
                  </FieldGrid>
                  <CheckField id={`aff-cur-${i}`} label="Current" checked={row.is_current}
                    onChange={(v) => patch({ is_current: v })} />
                </>
              )}
            />
          </CardBody>
          <CardFooter>
            <SaveBar
              state={affilState}
              disabled={preview}
              label="Save affiliations"
              onSave={() => saveAffil(
                async () => {
                  const res = await savePersonAffiliations(person.id, affiliations, loaded.current.affil)
                  if (!res.error) {
                    const fresh = await loadPersonForEdit(person.slug)
                    if (fresh.data) {
                      setAffiliations(fresh.data.affiliations)
                      loaded.current.affil = idsOf(fresh.data.affiliations)
                    }
                  }
                  return res
                },
                'Your affiliations are saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      <div id="edit-experience">
        <Card>
          <CardHeader title="EXPERIENCE" count={experience.filter((e) => e.org_name).length || null} />
          <CardBody>
            <Repeater
              items={experience}
              onChange={setExperience}
              blank={() => ({ org_name: '', title: '', description: '', location: '', start_date: '', end_date: '', is_current: false })}
              addLabel="Add a role"
              emptyText="No roles listed yet."
              rowErrors={expState.rowErrors}
              renderRow={(row, i, patch) => (
                <>
                  <FieldGrid>
                    <Field id={`exp-org-${i}`} label="Organization">
                      <TextInput id={`exp-org-${i}`} value={row.org_name} onChange={(v) => patch({ org_name: v })} />
                    </Field>
                    <Field id={`exp-title-${i}`} label="Title">
                      <TextInput id={`exp-title-${i}`} value={row.title} onChange={(v) => patch({ title: v })} />
                    </Field>
                    <Field id={`exp-loc-${i}`} label="Location">
                      <TextInput id={`exp-loc-${i}`} value={row.location} onChange={(v) => patch({ location: v })} />
                    </Field>
                    <Field id={`exp-start-${i}`} label="Start">
                      <TextInput id={`exp-start-${i}`} type="date" value={row.start_date || ''}
                        onChange={(v) => patch({ start_date: v })} />
                    </Field>
                    <Field id={`exp-end-${i}`} label="End"
                      hint={row.is_current ? 'Leave blank while this is your current role.' : undefined}>
                      <TextInput id={`exp-end-${i}`} type="date" value={row.end_date || ''}
                        onChange={(v) => patch({ end_date: v })} />
                    </Field>
                  </FieldGrid>
                  <Field id={`exp-desc-${i}`} label="What you did there">
                    <TextArea id={`exp-desc-${i}`} rows={3} value={row.description}
                      onChange={(v) => patch({ description: v })} />
                  </Field>
                  <CheckField id={`exp-cur-${i}`} label="This is my current role" checked={row.is_current}
                    onChange={(v) => patch({ is_current: v })} />
                </>
              )}
            />
          </CardBody>
          <CardFooter>
            <SaveBar
              state={expState}
              disabled={preview}
              label="Save experience"
              onSave={() => saveExp(
                async () => {
                  const res = await savePersonExperience(person.id, experience, loaded.current.exp)
                  if (!res.error) {
                    const fresh = await loadPersonForEdit(person.slug)
                    if (fresh.data) {
                      setExperience(fresh.data.experience)
                      loaded.current.exp = idsOf(fresh.data.experience)
                    }
                  }
                  return res
                },
                'Your experience is saved.',
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
                  How much of your work sits against each mission, 0 to 100. Leave one blank and it is
                  not shown at all — an unanswered mission is better than a made-up number.
                </p>
                <FieldGrid>
                  {missionTags.map((tag) => (
                    <Field key={tag.id} id={`mission-${tag.id}`} label={tag.name}
                      error={missionState.fieldErrors[tag.id]}>
                      <TextInput
                        id={`mission-${tag.id}`}
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
              disabled={preview || missionTags.length === 0}
              label="Save mission alignment"
              onSave={() => saveMissions(
                async () => {
                  const res = await saveMissionScores('person', person.id, scoreDraft, missionScores)
                  if (!res.error) {
                    const fresh = await loadPersonForEdit(person.slug)
                    if (fresh.data) {
                      setMissionScores(fresh.data.missionScores)
                      setScoreDraft(Object.fromEntries(fresh.data.missionScores.map((s) => [s.tag_id, String(s.score)])))
                    }
                  }
                  return res
                },
                'Your mission alignment is saved.',
              )}
            />
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
