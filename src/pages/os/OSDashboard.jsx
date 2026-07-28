import React, { useEffect } from 'react'
import { EmptyState } from '../../components/osv3/index.js'
import '../../styles/osv3-profile.css'

export default function OSDashboard() {
  useEffect(() => { document.title = 'Dashboard | SpaceOS' }, [])
  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Dashboard</h1>
          <p className="osv3p-pagehead-sub">Your activity across the Space Rising ecosystem.</p>
        </div>
      </header>
      <EmptyState
        icon="grid"
        title="Nothing to show yet"
        body="Your dashboard fills in as you connect, save and post. Until then there is nothing here worth pretending about."
      />
    </div>
  )
}
