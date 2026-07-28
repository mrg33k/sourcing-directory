import React, { useEffect } from 'react'
import {
  Card, CardHeader, CardBody, CheckList, CompletenessMeter, EmptyState,
} from '../../components/osv3/index.js'
import { computeProfileCompleteness, PERSON_FIELDS } from '../../lib/profileCompleteness.js'
import '../../styles/osv3-profile.css'

/**
 * /profile/edit — the edit shell.
 *
 * The form is deliberately not faked. There is no person table to write to, so
 * a set of inputs here would collect keystrokes and throw them away. What this
 * screen does give is the real thing an edit screen is for: the complete field
 * list, and the score that moves when you fill one.
 */

export default function OSProfileEdit() {
  useEffect(() => { document.title = 'Edit profile | SpaceOS' }, [])

  const completeness = computeProfileCompleteness(null)
  const fields = PERSON_FIELDS.map((f) => ({ id: f.field, title: f.label }))

  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Edit profile</h1>
          <p className="osv3p-pagehead-sub">Every field the directory uses to match you to people, work and opportunities.</p>
        </div>
      </header>

      <Card>
        <CardHeader title="Completeness" />
        <CardBody>
          <CompletenessMeter percent={completeness.percent} missing={completeness.missing} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Profile fields" count={fields.length} />
        <CardBody>
          <CheckList items={fields} />
        </CardBody>
      </Card>

      <EmptyState
        icon="edit"
        title="Editing is not connected to a record yet"
        body="The fields above are the full set the profile screen renders. Saving switches on with the person record; until then this page will not pretend to store anything."
      />
    </div>
  )
}
