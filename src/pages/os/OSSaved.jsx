import React, { useEffect } from 'react'
import { EmptyState } from '../../components/osv3/index.js'
import '../../styles/osv3-profile.css'

export default function OSSaved() {
  useEffect(() => { document.title = 'Saved | SpaceOS' }, [])
  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Saved</h1>
          <p className="osv3p-pagehead-sub">Everything you bookmarked across SpaceOS.</p>
        </div>
      </header>
      <EmptyState
        icon="bookmark"
        title="Nothing saved yet"
        body="Use the bookmark control on any listing, report or profile and it lands here."
      />
    </div>
  )
}
