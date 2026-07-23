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
        href: '/organizations',
        icon: 'org',
        comingSoon: false,
      },
      {
        label: 'People',
        description: "Founders, researchers, and professionals building Arizona's space future.",
        href: '/people',
        icon: 'people',
        comingSoon: false,
      },
    ]}
    ctaBand={{
      text: "Know a company, organization, or professional we're missing from the directory?",
      ctaLabel: 'Submit a listing',
      href: '/admin/listings',
    }}
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
        href: '/news',
        icon: 'news',
        comingSoon: false,
      },
      {
        label: 'Videos',
        description: 'Arizona Space Congress sessions, panel discussions, and event recordings.',
        href: '/videos',
        icon: 'video',
        comingSoon: false,
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
        href: '/rfps',
        icon: 'rfp',
        comingSoon: false,
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
    ctaBand={{
      text: "Have an RFP, grant, or investment opportunity to share with Arizona's space community?",
      ctaLabel: 'Post an opportunity',
      href: '/admin/listings',
    }}
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
      {
        label: 'Aerospace Engineering Fundamentals',
        description: 'Propulsion, orbital mechanics, and systems design — the technical core every space professional needs.',
        href: null,
        icon: 'discovery',
        comingSoon: true,
      },
      {
        label: 'Space Business & Policy',
        description: 'Frameworks, case studies, and regulatory analysis for space entrepreneurs and executives.',
        href: null,
        icon: 'article',
        comingSoon: true,
      },
      {
        label: 'Satellite Systems & Operations',
        description: 'End-to-end mission design, ground systems, and data processing for Earth observation and comms.',
        href: null,
        icon: 'report',
        comingSoon: true,
      },
      {
        label: 'Arizona Career Accelerator',
        description: "Connect with Arizona's space employers. Job prep, interview coaching, and direct intro to local teams.",
        href: null,
        icon: 'people',
        comingSoon: true,
      },
      {
        label: 'Space Law & Compliance',
        description: 'Licensing, export controls (ITAR/EAR), and commercial space law essentials for founders and teams.',
        href: null,
        icon: 'rfp',
        comingSoon: true,
      },
    ]}
    ctaBand={{
      text: "Courses launching in 2025. Be first in the door for Arizona space learning.",
      ctaLabel: 'Join the waitlist',
      href: '/join',
    }}
  />
)

export const OSLibraryHub = () => (
  <OSHubAlivePage
    title="My Library"
    eyebrow="SPACE OS // MY LIBRARY"
    subtitle="Your personal collection. Saved resources, follows, and the content you come back to."
    accent="#6366F1"
    emptyStateBanner={{
      icon: 'bookmark',
      title: 'Your library starts here',
      subtitle: 'Save reports, articles, and listings as you explore Space OS. Follow the companies and topics that matter to your work — everything lives here.',
      ctaLabel: 'Sign in to start collecting',
      ctaHref: '/login',
    }}
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
    ctaBand={{
      text: "Everything you save and follow across Space OS lives in your Library — sign in to start.",
      ctaLabel: 'Sign in',
      href: '/login',
    }}
  />
)
