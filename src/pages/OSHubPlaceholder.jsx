import React from 'react'
import './OSHubPlaceholder.css'

const OSHubPlaceholder = ({ title, intro, sections }) => {
  return (
    <div className="osv3-hub-placeholder">
      <div className="osv3-hub-wrapper">
        <section className="osv3-hub-header">
          <h1 className="osv3-hub-title">{title}</h1>
          <p className="osv3-hub-intro">{intro}</p>
        </section>

        <section className="osv3-hub-sections">
          <div className="osv3-hub-eyebrow">Explore</div>
          <div className="osv3-hub-grid">
            {sections.map((section) => (
              <div key={section.label} className="osv3-hub-card">
                <div className="osv3-hub-card-header">
                  <h3 className="osv3-hub-card-title">{section.label}</h3>
                  {section.count !== undefined && (
                    <span className="osv3-hub-card-badge">{section.count}</span>
                  )}
                  {section.future && (
                    <span className="osv3-future-tag">Future</span>
                  )}
                </div>
                {section.href ? (
                  <a href={section.href} className="osv3-hub-card-link">
                    Explore →
                  </a>
                ) : (
                  <span className="osv3-hub-card-link-muted">Coming soon</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default OSHubPlaceholder
