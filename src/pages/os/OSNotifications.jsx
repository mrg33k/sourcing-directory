import React, { useEffect } from 'react'
import { EmptyState } from '../../components/osv3/index.js'
import '../../styles/osv3-profile.css'

export default function OSNotifications() {
  useEffect(() => { document.title = 'Notifications | SpaceOS' }, [])
  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Notifications</h1>
          <p className="osv3p-pagehead-sub">Verification, connection and content updates.</p>
        </div>
      </header>
      <EmptyState
        icon="bell"
        title="No notifications"
        body="Updates about your profile, connections and submissions will appear here."
      />
    </div>
  )
}
