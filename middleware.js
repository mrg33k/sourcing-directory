// Link previews (Slack, iMessage, LinkedIn, X) read the raw HTML without running
// the app, so the share title + image have to be in the HTML itself. index.html is
// shared with spacerising.org, so this swaps in the Sourcing Directory tags for
// every other host (sourcing.directory + previews) and leaves spacerising.org alone.
// Any failure falls through to the untouched page.

export const config = {
  // Pages only: skip the API, anything with a file extension, and asset folders.
  matcher: ['/((?!api/|assets/|sd/|v2-assets/|images/|.*\\..*).*)'],
};

const TITLE = 'Sourcing Directory | Find the right source';
const DESC = 'Suppliers, capabilities, and certifications across aerospace, semiconductors, manufacturing, and construction.';
const IMAGE = 'https://sourcing.directory/sd/og.jpg';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function brand(html, url) {
  const meta = (attr, key, val) => {
    const re = new RegExp(`<meta\\s+${attr}="${key.replace(':', '\\:')}"[^>]*>`, 'i');
    const tag = `<meta ${attr}="${key}" content="${esc(val)}" />`;
    return re.test(html) ? (html = html.replace(re, tag)) : (html = html.replace('</head>', `    ${tag}\n  </head>`));
  };
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${TITLE}</title>`);
  meta('name', 'description', DESC);
  meta('property', 'og:site_name', 'Sourcing Directory');
  meta('property', 'og:title', TITLE);
  meta('property', 'og:description', DESC);
  meta('property', 'og:url', `https://sourcing.directory${url.pathname}`);
  meta('property', 'og:image', IMAGE);
  meta('property', 'og:image:width', '1200');
  meta('property', 'og:image:height', '630');
  meta('property', 'og:image:alt', 'Sourcing Directory. Find the right source.');
  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', TITLE);
  meta('name', 'twitter:description', DESC);
  meta('name', 'twitter:image', IMAGE);
  meta('property', 'og:image:type', 'image/jpeg');
  meta('property', 'og:image:secure_url', IMAGE);
  const links = [
    '<link rel="icon" type="image/svg+xml" href="/sd/favicon.svg" />',
    '<link rel="icon" type="image/png" sizes="32x32" href="/sd/favicon-32.png" />',
    '<link rel="apple-touch-icon" href="/sd/apple-touch-icon.png" />',
    `<link rel="image_src" href="${IMAGE}" />`,
    '<meta name="theme-color" content="#0B0B0D" />',
  ];
  html = html.replace(/<link[^>]+rel="(?:icon|shortcut icon|apple-touch-icon)"[^>]*>\s*/gi, '');
  html = html.replace('</head>', `    ${links.join('\n    ')}\n  </head>`);
  return html;
}

export default async function middleware(request) {
  try {
    const host = (request.headers.get('host') || '').toLowerCase();
    if (host.includes('spacerising')) return undefined;
    const url = new URL(request.url);
    const res = await fetch(new URL('/index.html', url));
    if (!res.ok) return undefined;
    const html = brand(await res.text(), url);
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' },
    });
  } catch {
    return undefined;
  }
}
