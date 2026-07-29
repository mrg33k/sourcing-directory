// Email branding resolver for the two public faces of this platform.
//
// One codebase serves two brands: the Space OS product on *.spacerising.org
// and the original sourcing.directory. Every transactional email must carry
// the brand of the SITE THE USER WAS ON, not a hardcoded one — a password
// reset requested on os.spacerising.org that arrives dressed as
// sourcing.directory reads as phishing and strands the user on the wrong
// domain.
//
// Space OS sends from spacerising.org (Patrik, 2026-07-29: "just change it to
// spacerising instead" — sourcing.directory is the legacy product, Space OS on
// spacerising.org is the live one, so the live product gets the sending domain).
//
// THIS REQUIRES spacerising.org TO BE THE VERIFIED DOMAIN IN RESEND. As of
// 2026-07-29 it is NOT — sourcing.directory still holds the account's single
// domain slot. Until the swap lands, Resend rejects these sends and the callers
// fall back to Supabase's native mailer: a generic template, capped at 2
// emails/hour, but with correct os.spacerising.org links (site_url was fixed the
// same day). So the failure mode is "plain email" and never "no email".
//
// To finish: in Resend remove sourcing.directory, add spacerising.org, then add
// the DKIM/SPF records it issues to spacerising.org's DNS (Google Cloud DNS —
// nameservers ns-cloud-d{1..4}.googledomains.com). No further code change needed.
// SPACEOS_FROM_ADDRESS overrides this without a deploy if the domain choice moves.

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
      from: process.env.SPACEOS_FROM_ADDRESS || 'Space Rising <noreply@spacerising.org>',
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
