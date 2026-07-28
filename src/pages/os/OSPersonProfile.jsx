/**
 * Route shim. The person profile screen lives in ProfilePerson.jsx.
 *
 * src/main.jsx registers /people/:slug and /people/_preview against THIS path
 * and main.jsx is frozen while the three profile screens are built in parallel,
 * so the screen is re-exported here rather than the route being repointed.
 * Nothing else imports this file. When main.jsx next opens for edit, point the
 * lazy() import at ./ProfilePerson.jsx and delete this file.
 */
export { default } from './ProfilePerson.jsx'
