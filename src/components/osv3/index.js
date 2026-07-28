/**
 * The osv3 profile/admin primitive set.
 *
 * Every component here is PURELY PRESENTATIONAL: no supabase import, no fetch,
 * no router dependency, no palette prop. They take data and render classes from
 * src/styles/osv3-profile.css, which is the only place a --v3-* token is read.
 *
 * Import the stylesheet once per screen:
 *   import '../../styles/osv3-profile.css'
 */

export { default as Icon, ICON_NAMES } from './Icon.jsx'
export { default as Card, CardHeader, CardBody, CardFooter, CardLink, CardAction } from './Card.jsx'
export { default as Tabs } from './Tabs.jsx'
export { default as Pill, PillRow } from './Pill.jsx'
export { default as VerifiedBadge } from './VerifiedBadge.jsx'
export { default as Avatar, initialsOf } from './Avatar.jsx'
export { default as LogoTile, monogramOf } from './LogoTile.jsx'
export { default as Bar } from './Bar.jsx'
export { default as MissionBars } from './MissionBars.jsx'
export { default as StatStrip } from './StatStrip.jsx'
export { default as CheckList } from './CheckList.jsx'
export { default as KeyValueList } from './KeyValueList.jsx'
export { default as CountGrid } from './CountGrid.jsx'
export { default as IconList } from './IconList.jsx'
export { default as BulletList, SplitList } from './BulletList.jsx'
export { default as Button, ButtonRow } from './Button.jsx'
export { default as EmptyState } from './EmptyState.jsx'
export { default as CompletenessMeter } from './CompletenessMeter.jsx'
export { default as MapPanel } from './MapPanel.jsx'
export { default as DataTable } from './DataTable.jsx'
export { default as DonutChart, DonutLegend } from './DonutChart.jsx'
export { default as LineChart } from './LineChart.jsx'
export { default as KpiTile } from './KpiTile.jsx'
