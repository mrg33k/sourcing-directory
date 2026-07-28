import React, { useEffect } from 'react'
import { EmptyState } from '../../components/osv3/index.js'
import '../../styles/osv3-profile.css'

export default function OSMessages() {
  useEffect(() => { document.title = 'Messages | SpaceOS' }, [])
  return (
    <div className="osv3p-screen osv3p-screen--profile">
      <header className="osv3p-pagehead">
        <div>
          <h1 className="osv3p-pagehead-title">Messages</h1>
          <p className="osv3p-pagehead-sub">Direct conversations with people and organizations.</p>
        </div>
      </header>
      <EmptyState
        icon="mail"
        title="No messages"
        body="Messaging is not switched on yet. When it is, your threads appear here."
      />
    </div>
  )
}
