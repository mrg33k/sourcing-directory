import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Card, CardHeader, CardBody, CheckList, EmptyState, Button, ButtonRow,
} from '../../components/osv3/index.js'
import { PERSON_FIELDS } from '../../lib/profileCompleteness.js'
import { getViewerContext } from '../../lib/profileWrite.js'
import ProfileEditPerson from './ProfileEditPerson.jsx'
import ProfileEditCompany from './ProfileEditCompany.jsx'
import '../../styles/osv3-profile.css'

/**
 * /profile/edit — the one route that owns editing, and the switch that decides
 * WHAT is being edited.
 *
 *   /profile/edit                          your own person profile
 *   /profile/edit?person=<slug>            that person profile (if it is yours)
 *   /profile/edit?company=<slug>           that organization (if you are an
 *                                          approved member)
 *   /profile/edit?...&section=capabilities scroll to one card — this is where
 *                                          the profile screens' "Edit" and
 *                                          "+ Add" affordances land
 *
 * WHY EVERYTHING IS A QUERY PARAM AND NOT A ROUTE: src/main.jsx registers
 * exactly one edit route and is frozen while three agents build in this
 * checkout. When it next opens, /profile/edit/:kind/:slug is the nicer shape
 * and only this file and editHref() in profileWrite.js need to change — the
 * screens themselves already take `slug` and `section` as props.
 *
 * This file does NO permission work of its own. Each screen resolves the viewer
 * and decides for itself, because the answer differs per record and a shell
 * that guessed would either hide an editable record or show an uneditable one.
 * The one thing resolved here is "which record", and for the bare /profile/edit
 * that means looking up the signed-in user's own person row.
 */

export default function OSProfileEdit() {
  const [params] = useSearchParams()
  const section = params.get('section') || ''

  const personParam = params.get('person')
  const companyParam = params.get('company')
  const kind = params.get('kind')
  const slugParam = params.get('slug')

  // ?kind=company&slug=x is accepted as well as ?company=x, so a link written
  // either way lands somewhere real.
  const companySlug = companyParam || (kind === 'company' ? slugParam : null)
  const personSlug = personParam || (kind === 'person' ? slugParam : null)

  const [own, setOwn] = useState({ status: 'idle', slug: null })

  useEffect(() => { document.title = 'Edit profile | SpaceOS' }, [])

  // Only the bare /profile/edit needs to ask "who am I".
  useEffect(() => {
    if (companySlug || personSlug) return undefined
    let cancelled = false
    setOwn({ status: 'loading', slug: null })
    getViewerContext().then(({ data, error }) => {
      if (cancelled) return
      if (error || !data) { setOwn({ status: 'error', slug: null }); return }
      if (!data.signedIn) { setOwn({ status: 'signedout', slug: null }); return }
      if (!data.personSlug) { setOwn({ status: 'norecord', slug: null }); return }
      setOwn({ status: 'ready', slug: data.personSlug })
    })
    return () => { cancelled = true }
  }, [companySlug, personSlug])

  if (companySlug) return <ProfileEditCompany slug={companySlug} section={section} />
  if (personSlug) return <ProfileEditPerson slug={personSlug} section={section} />

  if (own.status === 'ready') return <ProfileEditPerson slug={own.slug} section={section} />

  if (own.status === 'loading' || own.status === 'idle') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <p className="osv3p-prose">Finding your profile…</p>
      </div>
    )
  }

  if (own.status === 'signedout') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="users"
          title="Sign in to edit your profile"
          body="Your profile is yours alone to edit, so we need to know it is you."
        />
        <ButtonRow><Button variant="primary" icon="send" href="/login">Sign in</Button></ButtonRow>
      </div>
    )
  }

  if (own.status === 'error') {
    return (
      <div className="osv3p-screen osv3p-screen--profile">
        <EmptyState
          icon="cross"
          title="We could not tell whose profile to open"
          body="Reload the page. If it keeps happening, sign out and back in."
        />
      </div>
    )
  }

  // Signed in, but no person record is linked to this account. That is a real
  // state — not every member has been given a profile record — and it says so
  // rather than opening an empty form that saves to nothing.
  const fields = PERSON_FIELDS.map((f) => ({ id: f.field, title: f.label }))
  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Edit profile</h1>
          <p className="osv3p-pagehead-sub">Every field the directory uses to match you to people, work and opportunities.</p>
        </div>
      </header>

      <EmptyState
        icon="users"
        title="No profile is linked to your account yet"
        body="Once your profile record exists, this page becomes the form that fills it in. The fields below are the full set it holds."
      />

      <Card>
        <CardHeader title="Profile fields" count={fields.length} />
        <CardBody>
          <CheckList items={fields} />
        </CardBody>
      </Card>

      <ButtonRow>
        <Button variant="primary" icon="user-plus" href="/add-profile">Start a profile</Button>
      </ButtonRow>
    </div>
  )
}
