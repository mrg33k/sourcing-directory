import React from 'react'
import OSHubAlivePage from './OSHubAlivePage'

export const OSEcosystemHub = () => (
  <OSHubAlivePage
    title="Ecosystem"
    eyebrow="SPACE OS // ECOSYSTEM"
    subtitle="The living map of Arizona's space industry. Companies, organizations, and professionals building tomorrow."
    accent="#8B5CF6"
    sections={[
      {
        label: 'Companies',
        description: 'Browse the directory of Arizona space companies sorted by sector, size, and capability.',
        href: '/directory',
        icon: 'company',
        comingSoon: false,
      },
      {
        label: 'Organizations',
        description: 'Nonprofits, government agencies, universities, and industry bodies shaping the space economy.',
        href: null,
        icon: 'org',
        comingSoon: true,
      },
      {
        label: 'People',
        description: "Founders, researchers, and professionals building Arizona's space future.",
        href: null,
        icon: 'people',
        comingSoon: true,
      },
    ]}
  />
)

export const OSIntelligenceHub = () => (
  <OSHubAlivePage
    title="Intelligence"
    eyebrow="SPACE OS // INTELLIGENCE"
    subtitle="Research, analysis, and insight from across Arizona's space intelligence network. Stay informed."
    accent="#3B82F6"
    sections={[
      {
        label: 'Reports',
        description: "In-depth market intelligence and research on Arizona's space and semiconductor sectors.",
        href: '/reports',
        icon: 'report',
        comingSoon: false,
      },
      {
        label: 'Articles',
        description: 'Analysis, commentary, and expert perspectives from across the ecosystem.',
        href: '/articles',
        icon: 'article',
        comingSoon: false,
      },
      {
        label: 'Discovery',
        description: 'Whitepapers, technical papers, and open-access research from industry and academia.',
        href: '/discovery',
        icon: 'discovery',
        comingSoon: false,
      },
      {
        label: 'Podcasts',
        description: 'Conversations with space leaders, researchers, and entrepreneurs across Arizona.',
        href: '/podcasts',
        icon: 'podcast',
        comingSoon: false,
      },
      {
        label: 'News',
        description: 'Real-time coverage from KTAR, AZPBS, FOX 10, and Arizona-focused space outlets.',
        href: null,
        icon: 'news',
        comingSoon: true,
      },
      {
        label: 'Videos',
        description: 'Arizona Space Congress sessions, panel discussions, and event recordings.',
        href: null,
        icon: 'video',
        comingSoon: true,
      },
    ]}
  />
)

export const OSOpportunitiesHub = () => (
  <OSHubAlivePage
    title="Opportunities"
    eyebrow="SPACE OS // OPPORTUNITIES"
    subtitle="Find your next deal. Grants, solicitations, and investment opportunities in Arizona's space sector."
    accent="#F97316"
    sections={[
      {
        label: 'RFPs',
        description: "Open solicitations from NASA, DoD, and state agencies seeking Arizona-based vendors.",
        href: null,
        icon: 'rfp',
        comingSoon: true,
      },
      {
        label: 'Grants',
        description: "SBIR/STTR, Arizona Commerce Authority, and foundation funding for space companies.",
        href: '/grants',
        icon: 'grant',
        comingSoon: false,
      },
      {
        label: 'Dealbank',
        description: 'Active investments, investor profiles, and deal-flow for the Arizona space sector.',
        href: '/deal-bank',
        icon: 'deal',
        comingSoon: false,
      },
    ]}
  />
)

export const OSLearningHub = () => (
  <OSHubAlivePage
    title="Learning"
    eyebrow="SPACE OS // LEARNING"
    subtitle="Build your expertise. Curated courses and learning paths for the next generation of space professionals."
    accent="#06B6D4"
    sections={[
      {
        label: 'Coursera for Space',
        description: 'Curated courses in aerospace engineering, space business, and emerging space technologies.',
        href: null,
        icon: 'learn',
        comingSoon: true,
      },
    ]}
  />
)

export const OSLibraryHub = () => (
  <OSHubAlivePage
    title="My Library"
    eyebrow="SPACE OS // MY LIBRARY"
    subtitle="Your personal collection. Saved resources, follows, and the content you come back to."
    accent="#6366F1"
    sections={[
      {
        label: 'Saved Items',
        description: "Reports, articles, and listings you've bookmarked for later reading and reference.",
        href: null,
        icon: 'bookmark',
        comingSoon: true,
      },
      {
        label: 'Follows',
        description: "Companies, people, and topics you're tracking across the Arizona space ecosystem.",
        href: null,
        icon: 'follow',
        comingSoon: true,
      },
    ]}
  />
)
