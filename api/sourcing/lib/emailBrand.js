// Email branding resolver for the two public faces of this platform.
//
// One codebase serves two brands: the Space OS product on *.spacerising.org
// and the original sourcing.directory. Every transactional email must carry
// the brand of the SITE THE USER WAS ON, not a hardcoded one — a password
// reset requested on os.spacerising.org that arrives dressed as
// sourcing.directory reads as phishing and strands the user on the wrong
// domain.
//
// The from-address domain must stay on a Resend-verified domain.
// aom-inhouse.com is verified and already sends Space Rising mail
// (see srw-subscribe.js); spacerising.org is NOT verified — sending from it
// would make Resend reject the send outright.

export function resolveBrand(originUrl) {
  let host = '';
  try {
    host = new URL(originUrl).hostname;
  } catch {
    // fall through to sourcing default
  }

  if (host === 'spacerising.org' || host.endsWith('.spacerising.org')) {
    return {
      key: 'spaceos',
      from: 'Space Rising <noreply@aom-inhouse.com>',
      defaultOrgName: 'Space Rising',
      siteLabel: 'os.spacerising.org',
      siteUrl: 'https://os.spacerising.org',
      contactEmail: 'hello@aom-inhouse.com',
      footerSign: 'Space Rising — Space OS',
    };
  }

  return {
    key: 'sourcing',
    from: process.env.RESEND_FROM_ADDRESS || 'Sourcing Directory <noreply@sourcing.directory>',
    defaultOrgName: 'AOM Sourcing Directory',
    siteLabel: 'sourcing.directory',
    siteUrl: 'https://sourcing.directory',
    contactEmail: 'hello@sourcing.directory',
    footerSign: 'AOM — Ahead of Market',
  };
}
