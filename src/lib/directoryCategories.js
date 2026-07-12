// Directory category mapping — built from the canonical mapping JSON
// This maps company names to categories and computes real counts

const categoryMap = {
  'Infrastructure': [],
  'Mobility': [],
  'Intelligence': [],
  'Life': [],
  'Industry': [],
  'Defense': []
};

// Canonical list of 162 companies with their categories
const companyToCategoryData = [
  { name: "10k24 Studio", category: "Industry" },
  { name: "6|21 Group Benefits", category: "Industry" },
  { name: "6|21 Private Wealth, LLC", category: "Industry" },
  { name: "ADS Consulting Group", category: "Industry" },
  { name: "AEON Space", category: "Intelligence" },
  { name: "AOM Studio", category: "Industry" },
  { name: "ASM International", category: "Infrastructure" },
  { name: "ASU Space and Earth Exploration", category: "Industry" },
  { name: "Acceleron Labs (Arizona)", category: "Life" },
  { name: "AeroVironment (Tucson)", category: "Mobility" },
  { name: "Air Liquide Electronics", category: "Infrastructure" },
  { name: "Allegheny Construction Specialties", category: "Infrastructure" },
  { name: "Alpha Metalcraft Group", category: "Infrastructure" },
  { name: "Amkor Technology", category: "Infrastructure" },
  { name: "Amkor Technology Peoria", category: "Infrastructure" },
  { name: "Applied Materials", category: "Infrastructure" },
  { name: "Arizona Commerce Authority", category: "Industry" },
  { name: "Arizona Defense Industries (Mesa)", category: "Defense" },
  { name: "Arizona Oncology", category: "Life" },
  { name: "Arizona State University Biodesign Institute", category: "Life" },
  { name: "Arizona State University Semiconductor Research", category: "Infrastructure" },
  { name: "Arsenal Government and Public Affairs ", category: "Defense" },
  { name: "Aspired Future", category: "Intelligence" },
  { name: "Axcelis Technologies", category: "Infrastructure" },
  { name: "Axim Biotechnologies", category: "Life" },
  { name: "BAE Systems (Scottsdale)", category: "Defense" },
  { name: "BTX Global Logistics", category: "Intelligence" },
  { name: "Banner Health Research", category: "Life" },
  { name: "Barrow Neurological Institute", category: "Life" },
  { name: "Basler Electric Arizona", category: "Infrastructure" },
  { name: "Benchmark Electronics", category: "Infrastructure" },
  { name: "BeyondTheory", category: "Industry" },
  { name: "Big Sky Way Leadership College, Inc.", category: "Industry" },
  { name: "BioOptio Diagnostics", category: "Life" },
  { name: "Blacknight Space Labs", category: "Infrastructure" },
  { name: "Boeing Defense Phoenix", category: "Defense" },
  { name: "Cactus Materials", category: "Infrastructure" },
  { name: "Caldwell Law", category: "Mobility" },
  { name: "Caris Life Sciences", category: "Life" },
  { name: "Casa Grande Union High School", category: "Industry" },
  { name: "Collins Aerospace (Tucson)", category: "Mobility" },
  { name: "Cubic Defense (Tucson)", category: "Defense" },
  { name: "DITHD", category: "Defense" },
  { name: "DRS Defense Solutions (Tempe)", category: "Defense" },
  { name: "DXC Technology (Defense / Phoenix)", category: "Defense" },
  { name: "Deca Technologies", category: "Infrastructure" },
  { name: "Dignity Health St. Joseph's Hospital and Medical Center", category: "Life" },
  { name: "EMD Electronics", category: "Infrastructure" },
  { name: "Elbit Systems of America (Chandler)", category: "Defense" },
  { name: "Entegris", category: "Infrastructure" },
  { name: "Envisionate", category: "Intelligence" },
  { name: "Exact Sciences (Scottsdale)", category: "Life" },
  { name: "FormFactor Arizona", category: "Infrastructure" },
  { name: "FreeFall Aerospace", category: "Intelligence" },
  { name: "GNB", category: "Infrastructure" },
  { name: "General Dynamics Mission Systems", category: "Defense" },
  { name: "General Dynamics Mission Systems (Scottsdale)", category: "Defense" },
  { name: "HDR", category: "Mobility" },
  { name: "HEICO Aerojet Arizona", category: "Mobility" },
  { name: "HTG Molecular Diagnostics", category: "Life" },
  { name: "Helomics (dba PrognomIQ)", category: "Life" },
  { name: "Honeywell Aerospace", category: "Mobility" },
  { name: "Hughes Inc.", category: "Life" },
  { name: "IEC Electronics", category: "Infrastructure" },
  { name: "II-VI Incorporated Arizona", category: "Infrastructure" },
  { name: "Ignova Mechanical", category: "Infrastructure" },
  { name: "Industrial Inspection and Consulting", category: "Industry" },
  { name: "Intel Chandler", category: "Infrastructure" },
  { name: "International Research Center", category: "Industry" },
  { name: "Intuitive Machines", category: "Intelligence" },
  { name: "Iridex Corporation (Arizona)", category: "Life" },
  { name: "Iridium Communications", category: "Intelligence" },
  { name: "JX Advanced Metals USA", category: "Infrastructure" },
  { name: "Jabil", category: "Infrastructure" },
  { name: "KALIX Systems, Inc.", category: "Infrastructure" },
  { name: "KLA Corporation", category: "Infrastructure" },
  { name: "Kerecis Arizona", category: "Life" },
  { name: "Kforce Government Solutions (Phoenix)", category: "Defense" },
  { name: "KinetX Aerospace", category: "Intelligence" },
  { name: "Kratos Defense (Arizona)", category: "Defense" },
  { name: "L3Harris Technologies", category: "Intelligence" },
  { name: "L3Harris Technologies (Phoenix)", category: "Defense" },
  { name: "LJA Environmental Services", category: "Industry" },
  { name: "Lam Research", category: "Infrastructure" },
  { name: "Leidos (Arizona)", category: "Mobility" },
  { name: "Leonardo DRS (Tempe)", category: "Defense" },
  { name: "Linde Electronics", category: "Infrastructure" },
  { name: "Lockheed Martin Missiles & Fire Control", category: "Defense" },
  { name: "MGC Pure Chemicals America", category: "Infrastructure" },
  { name: "Mayo Clinic Arizona", category: "Life" },
  { name: "Mercury Systems (Phoenix)", category: "Intelligence" },
  { name: "Microbiologics Arizona", category: "Life" },
  { name: "Microchip Technology", category: "Infrastructure" },
  { name: "Mirror Grinding and Metrology Lab (UA)", category: "Industry" },
  { name: "Moog Inc. (Arizona)", category: "Defense" },
  { name: "Moog Inc. Arizona", category: "Infrastructure" },
  { name: "Moov Technologies", category: "Infrastructure" },
  { name: "NXP Semiconductors", category: "Infrastructure" },
  { name: "Nammo Defense Systems (Mesa)", category: "Defense" },
  { name: "Near Space Corporation", category: "Mobility" },
  { name: "Newspace Brand Builders", category: "Infrastructure" },
  { name: "Nextage", category: "Mobility" },
  { name: "Northrop Grumman", category: "Infrastructure" },
  { name: "ON Semiconductor", category: "Infrastructure" },
  { name: "OSI Systems", category: "Defense" },
  { name: "Orbital Effects (formerly Kuiper)", category: "Intelligence" },
  { name: "PDF Solutions", category: "Infrastructure" },
  { name: "PEER Group", category: "Infrastructure" },
  { name: "Palomar Technologies", category: "Infrastructure" },
  { name: "Paragon Space Development", category: "Mobility" },
  { name: "Parsons Corporation (Arizona)", category: "Defense" },
  { name: "Peterson Spring", category: "Infrastructure" },
  { name: "Phantom Space Corporation", category: "Mobility" },
  { name: "Phoenix Defense", category: "Infrastructure" },
  { name: "Plug and Play", category: "Industry" },
  { name: "Q Station", category: "Industry" },
  { name: "Qorvo", category: "Infrastructure" },
  { name: "Rafael Advanced Defense Systems (Arizona)", category: "Defense" },
  { name: "Raytheon Intelligence & Space", category: "Intelligence" },
  { name: "Raytheon Missiles & Defense (Tucson)", category: "Defense" },
  { name: "Revive Medical (Arizona)", category: "Life" },
  { name: "Rincon Aerospace", category: "Mobility" },
  { name: "Rincon Research", category: "Intelligence" },
  { name: "Rincon Research (Tucson)", category: "Intelligence" },
  { name: "Rocket Lab (Geost)", category: "Mobility" },
  { name: "Rose Law Group", category: "Intelligence" },
  { name: "SAIC (Arizona)", category: "Defense" },
  { name: "SWITZER", category: "Infrastructure" },
  { name: "Sanmina", category: "Infrastructure" },
  { name: "Saras Micro Devices", category: "Infrastructure" },
  { name: "SciTec (Arizona)", category: "Defense" },
  { name: "Sector Groundswell LLC", category: "Industry" },
  { name: "SemQuest Inc.", category: "Infrastructure" },
  { name: "Sentinel Space Systems Corporation", category: "Intelligence" },
  { name: "Shibaura Electronics of America Corporation", category: "Intelligence" },
  { name: "Sierra Nevada Corporation (Chandler)", category: "Defense" },
  { name: "Sierra Space", category: "Mobility" },
  { name: "Sirotin Ventures", category: "Intelligence" },
  { name: "SkyMapper Inc.", category: "Infrastructure" },
  { name: "Skyworks Solutions", category: "Infrastructure" },
  { name: "Space OS — Discovery Library", category: "Industry" },
  { name: "Space Products And Innovation Inc", category: "Infrastructure" },
  { name: "Space Rising", category: "Industry" },
  { name: "StandardAero", category: "Mobility" },
  { name: "System Safety Institute by Redfly Engineering", category: "Mobility" },
  { name: "TGen (Translational Genomics Research Institute)", category: "Life" },
  { name: "TSMC Arizona", category: "Infrastructure" },
  { name: "Teledyne FLIR (Tucson)", category: "Defense" },
  { name: "Test Aerospace Corp", category: "Mobility" },
  { name: "Texas Space Coalition", category: "Industry" },
  { name: "The Barringer Crater Company", category: "Industry" },
  { name: "The Space Nurse, LLC", category: "Life" },
  { name: "Tokyo Electron Arizona", category: "Infrastructure" },
  { name: "Transnational Space Alliance Summit", category: "Industry" },
  { name: "Trax International", category: "Defense" },
  { name: "Ultradent Products (Arizona)", category: "Life" },
  { name: "Ventana Medical Systems / Roche Tissue Diagnostics", category: "Life" },
  { name: "Viasat Inc.", category: "Intelligence" },
  { name: "WRV Services", category: "Intelligence" },
  { name: "World View Enterprises", category: "Intelligence" },
  { name: "Yuma Spaceport", category: "Mobility" },
  { name: "Zendeavor Interplanetary, LLC", category: "Industry" }
];

// Build the category lookup
const nameToCategory = {};
companyToCategoryData.forEach(entry => {
  nameToCategory[entry.name] = entry.category;
  categoryMap[entry.category].push(entry.name);
});

// Category metadata: labels, subtitles, colors
export const CATEGORIES = [
  {
    id: '01',
    key: 'Infrastructure',
    label: 'INFRASTRUCTURE',
    subtitle: 'Build Space',
    color: '#6366F1',
    icon: '🏗️'
  },
  {
    id: '02',
    key: 'Mobility',
    label: 'MOBILITY',
    subtitle: 'Move through Space',
    color: '#14B8A6',
    icon: '🚀'
  },
  {
    id: '03',
    key: 'Intelligence',
    label: 'INTELLIGENCE',
    subtitle: 'Operate in Space',
    color: '#F97316',
    icon: '🛰️'
  },
  {
    id: '04',
    key: 'Life',
    label: 'LIFE',
    subtitle: 'Life in Space',
    color: '#FBBF24',
    icon: '🫀'
  },
  {
    id: '05',
    key: 'Industry',
    label: 'INDUSTRY',
    subtitle: 'Prosper in Space',
    color: '#8B5CF6',
    icon: '💼'
  },
  {
    id: '06',
    key: 'Defense',
    label: 'DEFENSE',
    subtitle: 'Secure Space',
    color: '#3B82F6',
    icon: '🛡️'
  }
];

// Get category for a company name
export function getCategoryForCompany(companyName) {
  return nameToCategory[companyName] || null;
}

// Get category count
export function getCategoryCount(categoryKey) {
  return categoryMap[categoryKey] ? categoryMap[categoryKey].length : 0;
}

// Get all companies in a category
export function getCompaniesByCategory(categoryKey) {
  return categoryMap[categoryKey] || [];
}

// Get category metadata by key
export function getCategoryMeta(categoryKey) {
  return CATEGORIES.find(c => c.key === categoryKey);
}

// Compute real category counts for all
export function getAllCategoryCounts() {
  const counts = {};
  CATEGORIES.forEach(cat => {
    counts[cat.key] = getCategoryCount(cat.key);
  });
  return counts;
}

export default {
  CATEGORIES,
  getCategoryForCompany,
  getCategoryCount,
  getCompaniesByCategory,
  getCategoryMeta,
  getAllCategoryCounts
};
