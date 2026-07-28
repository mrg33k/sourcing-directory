import React, { useEffect } from 'react'
import { EmptyState } from '../../components/osv3/index.js'
import '../../styles/osv3-profile.css'

export default function OSConnections() {
  useEffect(() => { document.title = 'Connections | SpaceOS' }, [])
  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Connections</h1>
          <p className="osv3p-pagehead-sub">People and organizations you are connected to.</p>
        </div>
      </header>
      <EmptyState
        icon="users"
        title="No connections yet"
        body="Connect from a person or organization profile and they will collect here."
      />
    </div>
  )
}
