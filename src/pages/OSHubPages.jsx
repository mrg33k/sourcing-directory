import React from 'react'
import OSHubPlaceholder from './OSHubPlaceholder'

export const OSEcosystemHub = () => (
  <OSHubPlaceholder
    title="Ecosystem"
    intro="Explore the space ecosystem. Discover companies, organizations, and professionals shaping the industry."
    sections={[
      { label: 'Companies', href: '/directory' },
      { label: 'Organizations', future: true },
      { label: 'People', future: true },
    ]}
  />
)

export const OSIntelligenceHub = () => (
  <OSHubPlaceholder
    title="Intelligence"
    intro="Stay informed. Access research, news, reports, articles, and industry insights."
    sections={[
      { label: 'Reports', href: '/reports' },
      { label: 'Articles', href: '/articles' },
      { label: 'Discovery', href: '/discovery' },
      { label: 'News', future: true },
      { label: 'Podcasts', href: '/podcasts' },
      { label: 'Videos', future: true },
    ]}
  />
)

export const OSOpportunitiesHub = () => (
  <OSHubPlaceholder
    title="Opportunities"
    intro="Find funding, grants, and business opportunities in the space sector."
    sections={[
      { label: 'RFPs', future: true },
      { label: 'Grants', href: '/grants' },
      { label: 'Dealbank', href: '/deal-bank' },
    ]}
  />
)

export const OSLearningHub = () => (
  <OSHubPlaceholder
    title="Learning"
    intro="Develop your skills and knowledge with curated space industry courses and resources."
    sections={[
      { label: 'Coursera for Space', future: true, href: '/learning' },
    ]}
  />
)

export const OSLibraryHub = () => (
  <OSHubPlaceholder
    title="My Library"
    intro="Curate your personal collection of resources, reports, and follows."
    sections={[
      { label: 'Saved Items', href: '/library' },
      { label: 'Follows', href: '/library' },
    ]}
  />
)
