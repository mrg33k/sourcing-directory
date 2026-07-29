/**
 * Route shim. The admin dashboard lives in AdminTools.jsx.
 *
 * src/main.jsx registers /admin-tools/_preview against THIS path and main.jsx is
 * frozen while these screens are built in parallel, so the screen is re-exported
 * here rather than the route being repointed. Exactly what OSPersonProfile.jsx
 * and OSCompanyProfile.jsx already do for the two profile screens.
 *
 * WHAT THIS FILE USED TO BE: a second, older copy of the same dashboard — the
 * transcribed ADMIN_FIXTURE numbers, no states, no live read, and headings built
 * from CardHeader rather than the mixed-case treatment the reference measures.
 * Two admin screens existed and the route was wired to the one that could never
 * show a real figure. It is replaced rather than kept, because a stale duplicate
 * of a screen is the copy that gets edited by mistake.
 *
 * When main.jsx next opens for edit, point the lazy() import at ./AdminTools.jsx
 * and delete this file. Nothing else imports it.
 */

export { default } from './AdminTools.jsx'
