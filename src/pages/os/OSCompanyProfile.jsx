/**
 * The company profile screen lives in ProfileCompany.jsx.
 *
 * This module is the route seam and nothing else: src/main.jsx lazy-imports
 * ./pages/os/OSCompanyProfile.jsx and this re-exports the screen.
 *
 * As of 2026-07-28 that seam carries EVERY company URL, not just the preview:
 * /company/_preview, /company/:slug and the bare /:slug all resolve here. The
 * earlier note on this file said to collapse it into a direct import of
 * ProfileCompany.jsx "next time main.jsx is open" — main.jsx was open for that
 * switch and the collapse was deliberately not done. Three agents are editing
 * this checkout in parallel; deleting a module that main.jsx imports, to save
 * one hop that costs nothing at runtime, is the kind of change that turns a
 * merge into a white screen. One indirection is cheaper than that.
 *
 * Collapse it when the checkout is quiet: point main.jsx at ProfileCompany.jsx
 * and delete this file. Nothing else imports it.
 */

export { default } from './ProfileCompany.jsx'
