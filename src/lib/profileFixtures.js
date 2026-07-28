/**
 * profileFixtures.js — the two reference screens, as data.
 *
 * Every string, number, label and list ORDER below is transcribed from
 * corner/users/aom/projects/space-rising/missions/profiles-admin-rebuild/
 * reference/measurements-person.json and measurements-company.json — the
 * files that were read off the design PNGs pixel by pixel. Nothing here was
 * retyped from the image, and nothing here is invented.
 *
 * These back /people/_preview and /company/_preview. That is how the profile
 * screens are visible and measurable before a real backing table exists.
 *
 * Map marker coordinates are in the 960x600 albersUsa space of
 * src/lib/usStatesPaths.js (derived from the state bounding boxes in that
 * file). Mahia, New Zealand is off that map, so it carries no marker — it is
 * listed beside the map instead of pinned into the wrong ocean.
 */

export const PREVIEW_SLUG = '_preview'

export const PERSON_FIXTURE = {
  slug: PREVIEW_SLUG,
  kind: 'person',
  name: 'Tim Struck',
  verified: true,
  verifiedLabel: 'Verified',
  role: 'Co-Founder & Chief Brand Officer',
  organization: 'Space Rising',
  location: 'Scottsdale, Arizona, USA',
  email: 'tim@spacerising.com',
  linkedin: 'https://www.linkedin.com/',
  photoUrl: null,
  bio: 'Brand strategist and visual communicator focused on building connections that drive the commercial space economy forward. I help organizations share their story, align their message, and create meaningful impact.',
  tags: ['Brand Strategy', 'Ecosystem Communications', 'Visual Systems', 'Commercial Space'],

  tabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'needs', label: 'Needs' },
    { id: 'experience', label: 'Experience' },
    { id: 'affiliations', label: 'Affiliations' },
  ],

  availability: {
    heading: 'AVAILABILITY',
    status: 'Open to Collaboration',
    body: 'Actively seeking partnerships and exciting projects that advance the space economy.',
    primaryCta: 'CONNECT',
  },

  about: {
    heading: 'ABOUT ME',
    body: 'I co-founded Space Rising to strengthen the space economy through connection, strategy, and shared purpose. With 20+ years in brand strategy, design, and communications, I help organizations tell their story and build systems that drive real impact.',
    link: 'View full bio',
  },

  capabilities: {
    heading: 'CAPABILITIES',
    action: 'Edit',
    total: 12,
    // 10 shown of 12 — the card footer states the total, the grid shows ten.
    shown: [
      { id: 'brand-strategy', title: 'Brand Strategy' },
      { id: 'marketing-strategy', title: 'Marketing Strategy' },
      { id: 'visual-identity', title: 'Visual Identity' },
      { id: 'public-relations', title: 'Public Relations' },
      { id: 'strategic-comms', title: 'Strategic Communications' },
      { id: 'content-strategy', title: 'Content Strategy' },
      { id: 'storytelling', title: 'Storytelling' },
      { id: 'event-comms', title: 'Event Communications' },
      { id: 'ecosystem-development', title: 'Ecosystem Development' },
      { id: 'digital-design', title: 'Digital Design' },
    ],
    footerLink: 'View all capabilities (12)',
  },

  missions: {
    heading: 'SPACE MISSIONS',
    action: 'Edit',
    rows: [
      { id: 'build', label: 'Build Space', pct: 90 },
      { id: 'operate', label: 'Operate in Space', pct: 80 },
      { id: 'prosper', label: 'Prosper Through Space', pct: 75 },
      { id: 'live', label: 'Live in Space', pct: 60 },
      { id: 'move', label: 'Move Through Space', pct: 50 },
      { id: 'secure', label: 'Secure Space', pct: 40 },
    ],
  },

  lookingFor: {
    heading: "WHAT I'M LOOKING FOR",
    action: 'Edit',
    left: {
      heading: "I'M SEEKING",
      items: [
        'Strategic partnerships',
        'Arizona aerospace leaders',
        'Government introductions',
        'Collaborators on ecosystem projects',
      ],
    },
    right: {
      heading: 'I CAN PROVIDE',
      items: [
        'Brand & communications strategy',
        'Storytelling & content development',
        'Ecosystem connections',
        'Event & community engagement',
      ],
    },
  },

  affiliations: {
    heading: 'AFFILIATIONS',
    action: '+ Add',
    items: [
      { id: 'space-rising', title: 'Space Rising', sub: 'Co-Founder', logo: true },
      { id: 'az-space-council', title: 'Arizona Space Council', sub: 'Council Member', logo: true },
      { id: 'az-commerce', title: 'Arizona Commerce Authority', sub: 'Advisory Member', logo: true },
      { id: 'u-of-a', title: 'The University of Arizona', sub: 'Guest Lecturer', logo: true },
    ],
    footerLink: 'View all affiliations',
  },

  locationCard: {
    heading: 'LOCATION',
    city: 'Scottsdale, Arizona',
    note: 'Open to local, national, and global collaboration',
    highlight: ['AZ'],
    markers: [{ id: 'scottsdale', x: 248, y: 395, label: 'Scottsdale, Arizona' }],
  },

  activity: {
    heading: 'ACTIVITY HIGHLIGHTS',
    stats: [
      { id: 'connections', icon: 'users', label: 'Connections', value: '128' },
      { id: 'organizations', icon: 'building', label: 'Organizations', value: '64' },
      { id: 'projects', icon: 'briefcase', label: 'Projects', value: '18' },
      { id: 'events', icon: 'calendar', label: 'Events Attended', value: '12' },
      { id: 'views', icon: 'eye', label: 'Profile Views', value: '342' },
    ],
  },
}

export const COMPANY_FIXTURE = {
  slug: PREVIEW_SLUG,
  kind: 'company',
  name: 'Rocket Lab USA, Inc.',
  verified: true,
  verifiedLabel: 'Verified Organization',
  categories: ['Space Systems', 'Launch', 'Satellite Manufacturing'],
  location: 'Long Beach, California, USA',
  website: 'www.rocketlabusa.com',
  email: 'info@rocketlabusa.com',
  linkedin: 'https://www.linkedin.com/',
  logoUrl: null,
  description: 'Rocket Lab is a global leader in launch services and space systems. We provide frequent, reliable access to space with Electron launch vehicles and deliver end-to-end solutions for satellite design, manufacturing, and mission operations.',
  tags: ['Launch Systems', 'Satellite Manufacturing', 'Spacecraft Components', 'Mission Operations', 'Advanced Manufacturing'],

  tabs: [
    { id: 'overview', label: 'Overview' },
    { id: 'capabilities', label: 'Capabilities' },
    { id: 'people', label: 'People', count: 68 },
    { id: 'location', label: 'Location' },
    { id: 'affiliations', label: 'Affiliations' },
  ],

  connect: {
    heading: 'CONNECT WITH ROCKET LAB',
    status: 'Open to Collaboration',
    body: 'Actively seeking partnerships, suppliers, and talented team members.',
    primaryCta: 'CONNECT',
    secondaryCta: 'FOLLOW',
  },

  atAGlance: {
    heading: 'AT A GLANCE',
    rows: [
      { id: 'founded', icon: 'check-circle', key: 'Founded', value: '2006' },
      { id: 'employees', icon: 'users', key: 'Employees', value: '1,100+' },
      { id: 'org-type', icon: 'building', key: 'Organization Type', value: 'Private Company' },
      { id: 'naics', icon: 'file', key: 'NAICS Code', value: '336414, 336414, 541330' },
      { id: 'hq', icon: 'location', key: 'Headquarters', value: 'Long Beach, CA, USA' },
    ],
    footerLink: 'View full company details',
  },

  capabilities: {
    heading: 'CAPABILITIES',
    total: 18,
    // 8 shown of 18.
    shown: [
      { id: 'launch-services', icon: 'rocket', title: 'Launch Services', sub: 'Small satellite launch' },
      { id: 'space-systems', icon: 'chip', title: 'Space Systems & Components', sub: 'Avionics, propulsion, structures' },
      { id: 'satellite-manufacturing', icon: 'satellite', title: 'Satellite Manufacturing', sub: 'Satellite buses & components' },
      { id: 'advanced-manufacturing', icon: 'gear', title: 'Advanced Manufacturing', sub: 'CNC, composites, 3D printing' },
      { id: 'payload-integration', icon: 'layers', title: 'Payload Integration', sub: 'Mechanical, electrical, software' },
      { id: 'testing-environmental', icon: 'gauge', title: 'Testing & Environmental', sub: 'Vibration, thermal vacuum, EMC' },
      { id: 'mission-operations', icon: 'grid', title: 'Mission Operations', sub: 'Flight operations & ground systems' },
      { id: 'data-telemetry', icon: 'signal', title: 'Data & Telemetry', sub: 'Ground stations, data systems' },
    ],
    footerLink: 'View all',
  },

  missions: {
    heading: 'SPACE MISSIONS',
    rows: [
      { id: 'build', label: 'Build Space', pct: 90 },
      { id: 'operate', label: 'Operate in Space', pct: 85 },
      { id: 'prosper', label: 'Prosper Through Space', pct: 75 },
      { id: 'move', label: 'Move Through Space', pct: 70 },
      { id: 'secure', label: 'Secure Space', pct: 60 },
      { id: 'live', label: 'Live in Space', pct: 40 },
    ],
    footerLink: 'View mission alignment details',
  },

  whatWeDo: {
    heading: 'WHAT WE DO',
    body: 'Rocket Lab provides end-to-end space solutions including launch services with Electron, satellite design and manufacturing, spacecraft components, and mission operations. Our vertically integrated approach delivers reliability, responsiveness, and innovation for commercial, government, and defense customers.',
    link: 'View full description',
  },

  whoWeWorkWith: {
    heading: 'WHO WE WORK WITH',
    footerLink: 'View all',
    counts: [
      { id: 'suppliers', icon: 'truck', value: '28', label: 'Suppliers' },
      { id: 'partners', icon: 'handshake', value: '12', label: 'Partners' },
      { id: 'customers', icon: 'users', value: '9', label: 'Customers' },
      { id: 'universities', icon: 'graduation', value: '14', label: 'Universities' },
      { id: 'gov-programs', icon: 'bank', value: '7', label: 'Gov. Programs' },
      { id: 'investors', icon: 'investor', value: '35', label: 'Investors' },
    ],
  },

  lookingFor: {
    heading: 'LOOKING FOR',
    action: 'Edit',
    left: {
      heading: '',
      items: [
        'Composite materials suppliers',
        'Precision machining partners',
        'RF / microwave component manufacturers',
      ],
    },
    right: {
      heading: '',
      items: [
        'Test facility partnerships',
        'Software engineering talent',
        'Strategic investment partners',
      ],
    },
    footerLink: 'View all needs',
  },

  locations: {
    heading: 'LOCATIONS',
    items: [
      { id: 'hq', icon: 'location', title: 'Headquarters', sub: 'Long Beach, CA, USA' },
      { id: 'lc1', icon: 'location', title: 'Launch Complex 1', sub: 'Mahia, New Zealand' },
      { id: 'ops', icon: 'location', title: 'Operations Facility', sub: 'Virginia, USA' },
    ],
    footerLink: 'View all locations',
    highlight: ['CA', 'VA'],
    markers: [
      { id: 'long-beach', x: 163, y: 360, label: 'Long Beach, CA, USA' },
      { id: 'virginia', x: 845, y: 290, label: 'Virginia, USA' },
    ],
  },

  activity: {
    heading: 'ACTIVITY HIGHLIGHTS',
    footerLink: 'View all activity',
    stats: [
      { id: 'views', icon: 'eye', label: 'Profile Views', value: '1,426', note: 'Last 30 days' },
      { id: 'requests', icon: 'user-plus', label: 'Connection Requests', value: '248', note: 'Last 30 days' },
      { id: 'opportunities', icon: 'briefcase', label: 'Opportunities Posted', value: '9', note: 'Last 30 days' },
      { id: 'projects', icon: 'grid', label: 'Projects Participating', value: '18', note: 'Active' },
      { id: 'events', icon: 'calendar', label: 'Events Attended', value: '12', note: 'Last 90 days' },
    ],
  },

  footer: 'SpaceOS is a platform of Space Rising. Building connections that advance the space economy.',
}

/**
 * Admin Tools fixture — the third reference screen. Same rule: every figure is
 * the one printed on design-admin-tools.png. The admin screen's own tabs and
 * buttons run on the existing link blue; only the shared sidebar stays rust
 * (design-decisions.md D2).
 */
export const ADMIN_FIXTURE = {
  title: 'Admin Tools',
  subtitle: 'Manage and monitor the SpaceOS platform.',
  exportCta: 'EXPORT REPORT',

  tabs: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'users', label: 'Users' },
    { id: 'organizations', label: 'Organizations' },
    { id: 'verification', label: 'Verification' },
    { id: 'content', label: 'Content' },
    { id: 'activity', label: 'Activity' },
    { id: 'settings', label: 'Settings' },
  ],

  kpis: [
    { id: 'users', icon: 'users', label: 'Total Users', value: '2,843', delta: '18%', deltaNote: 'from last 30 days', linkLabel: 'View all users' },
    { id: 'orgs', icon: 'building', label: 'Organizations', value: '623', delta: '12%', deltaNote: 'from last 30 days', linkLabel: 'View all organizations' },
    { id: 'capabilities', icon: 'rocket', label: 'Capabilities', value: '1,732', delta: '15%', deltaNote: 'from last 30 days', linkLabel: 'View all capabilities' },
    { id: 'locations', icon: 'location', label: 'Locations', value: '128', delta: '7%', deltaNote: 'from last 30 days', linkLabel: 'View all locations' },
    { id: 'verified', icon: 'shield-check', label: 'Verified Organizations', value: '412', delta: '9%', deltaNote: 'from last 30 days', linkLabel: 'View verification' },
  ],

  platformActivity: {
    heading: 'Platform Activity',
    note: '(Last 30 Days)',
    footerLink: 'View full report',
    xLabels: ['May 1', 'May 8', 'May 15', 'May 22', 'May 29'],
    yTicks: [0, 25, 50, 75, 100],
    series: [
      { id: 'users', label: 'New Users', tone: 'a', points: [52, 50, 54, 51, 57, 55, 62, 60, 58, 64, 66, 63, 70, 68, 72, 71, 76, 74, 79, 82, 80, 85, 83, 88, 86, 84, 87, 82, 80, 78] },
      { id: 'orgs', label: 'New Organizations', tone: 'b', points: [26, 28, 27, 31, 30, 34, 33, 37, 36, 40, 38, 42, 41, 45, 43, 47, 46, 44, 49, 48, 52, 50, 55, 53, 57, 56, 54, 58, 56, 54] },
      { id: 'capabilities', label: 'New Capabilities', tone: 'c', points: [8, 9, 11, 10, 13, 12, 15, 14, 17, 16, 19, 18, 21, 20, 23, 22, 25, 24, 27, 26, 29, 28, 31, 30, 33, 32, 34, 33, 35, 34] },
    ],
  },

  verificationSplit: {
    heading: 'Organizations by Verification Status',
    footerLink: 'View all',
    total: 623,
    totalLabel: 'Total',
    segments: [
      { id: 'verified', label: 'Verified', value: 412, tone: 'verified' },
      { id: 'pending', label: 'Pending Review', value: 138, tone: 'pending' },
      { id: 'unverified', label: 'Unverified', value: 66, tone: 'unverified' },
      { id: 'rejected', label: 'Rejected', value: 7, tone: 'rejected' },
    ],
  },

  recentOrganizations: {
    heading: 'Recent Organizations',
    footerLink: 'View all organizations',
    columns: [
      { id: 'organization', header: 'Organization' },
      { id: 'location', header: 'Location' },
      { id: 'status', header: 'Status' },
      { id: 'since', header: 'Member Since' },
      { id: 'actions', header: 'Actions', align: 'right' },
    ],
    rows: [
      { id: 'rocket-lab', name: 'Rocket Lab USA, Inc.', sub: 'Launch Services', location: 'Long Beach, CA', status: 'Verified', tone: 'verified', since: 'May 25, 2025' },
      { id: 'honeywell', name: 'Honeywell Aerospace', sub: 'Aerospace Manufacturing', location: 'Phoenix, AZ', status: 'Verified', tone: 'verified', since: 'May 24, 2025' },
      { id: 'asu', name: 'Arizona State University', sub: 'Research Institution', location: 'Tempe, AZ', status: 'Verified', tone: 'verified', since: 'May 23, 2025' },
      { id: 'blue-canyon', name: 'Blue Canyon Technologies', sub: 'Satellite Manufacturing', location: 'Louisville, CO', status: 'Pending Review', tone: 'pending', since: 'May 23, 2025' },
      { id: 'intuitive-machines', name: 'Intuitive Machines', sub: 'Space Systems', location: 'Houston, TX', status: 'Unverified', tone: 'unverified', since: 'May 22, 2025' },
    ],
  },

  pendingItems: {
    heading: 'Pending Items',
    footerLink: 'Review all pending items',
    rows: [
      { id: 'orgs-awaiting', label: 'Organizations Awaiting Verification', value: 138 },
      { id: 'user-registrations', label: 'User Registrations Awaiting Approval', value: 24 },
      { id: 'capability-submissions', label: 'Capability Submissions', value: 37 },
      { id: 'content-submissions', label: 'Content Submissions', value: 12 },
    ],
  },

  recentActivity: {
    heading: 'Recent System Activity',
    footerLink: 'View all activity',
    items: [
      { id: 'a1', icon: 'building', title: 'New organization registered', sub: 'RocketStar Propulsion', time: '2 minutes ago' },
      { id: 'a2', icon: 'org-check', title: 'Organization verified', sub: 'Blue Canyon Technologies', time: '1 hour ago' },
      { id: 'a3', icon: 'users', title: 'New user registered', sub: 'Jane Smith', time: '2 hours ago' },
      { id: 'a4', icon: 'rocket', title: 'Capability added', sub: 'Satellite Manufacturing', time: '3 hours ago' },
      { id: 'a5', icon: 'briefcase', title: 'Organization updated', sub: 'Honeywell Aerospace', time: '5 hours ago' },
    ],
  },

  quickActions: {
    heading: 'Quick Actions',
    items: [
      { id: 'add-org', icon: 'building', label: 'Add New Organization' },
      { id: 'verify-org', icon: 'shield-check', label: 'Verify Organization' },
      { id: 'export', icon: 'download', label: 'Export Data' },
      { id: 'announce', icon: 'megaphone', label: 'Send Announcement' },
      { id: 'settings', icon: 'gear', label: 'System Settings' },
    ],
  },
}

export default { PERSON_FIXTURE, COMPANY_FIXTURE, ADMIN_FIXTURE, PREVIEW_SLUG }
