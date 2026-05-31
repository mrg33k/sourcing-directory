import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

// R10b (nat-geo-uplift) — scraped live from spacerising.org/media 2026-05-31.
// Each item carries a real outbound URL. Rows render as <a target="_blank">.
// Year is extracted from URL path where present; items without a date in their
// URL inherit the year of the previous dated item (preserves chronological
// flow as seen on the org page).
const MEDIA_ITEMS = [
  // ── 2026 ──────────────────────────────────────────────────────────────────
  { year: '2026', type: 'STORY',     headline: 'Blacknight Space launches Arizona accelerator for commercial space startups', url: 'https://www.bizjournals.com/phoenix/news/2026/05/26/blacknight-space-labs-arizona-accelerator.html' },
  { year: '2026', type: 'BLOG',      headline: "Zahra's Arizona Space Congress 2026 Experience | Higher Orbits", url: 'https://higherorbits.org/zahras-arizona-space-congress-2026-experience/' },
  { year: '2026', type: 'STORY',     headline: 'Arizona hosts first Space Congress to boost aerospace economy', url: 'https://www.azfamily.com/2026/04/29/arizona-hosts-first-space-congress-boost-aerospace-economy/?outputType=amp' },
  { year: '2026', type: 'WATCH',     headline: 'Arizona Space Congress aims to turn renewed space excitement into a real economic play for the state', url: 'https://www.youtube.com/watch?v=GxshwgfXw8E' },
  { year: '2026', type: 'STORY',     headline: "Arizona's spaceport push: Yuma for launch, Sierra Vista for re-entry", url: 'https://www.abc15.com/arizonas-spaceport-push-yuma-for-launch-sierra-vista-for-re-entry' },
  { year: '2026', type: 'STORY',     headline: 'Arizona aims to become key player in trillion-dollar space economy', url: 'https://www.12news.com/article/news/local/arizona/arizona-aims-to-become-key-player-trillion-dollar-space-economy/75-8516b5e7-8417-40c7-a301-fa7dd72ff3c2' },
  { year: '2026', type: 'PODCAST',   headline: 'Arizona Space Congress | FOX 10 Talks', url: 'https://www.fox10phoenix.com/video/fmc-g4plrcojr01gya0x' },
  { year: '2026', type: 'VIDEO',     headline: "Arizona space industry prepares for 'gold boom' with first 'Space Congress'", url: 'https://www.fox10phoenix.com/video/fmc-f5qjpefy8ltm951u' },
  { year: '2026', type: 'WATCH',     headline: 'Arizona Horizon — Space Congress 2026', url: 'https://www.pbs.org/video/colorado-river-water-rights-economy-space-rising-arizona-space-congress-colorectal-cancer-tv0v38/' },
  { year: '2026', type: 'STORY',     headline: "Desert Showdown: Yuma and Sierra Vista Scramble for Arizona's First Spaceports", url: 'https://hoodline.com/2026/04/desert-showdown-yuma-and-sierra-vista-scramble-for-arizona-s-first-spaceports/' },
  { year: '2026', type: 'STORY',     headline: 'Aerospace companies will convene in Phoenix to seek ways to bolster innovation and growth', url: 'https://www.kjzz.org/business/2026-04-28/aerospace-companies-will-convene-in-phoenix-to-seek-ways-to-bolster-innovation-and-growth' },
  { year: '2026', type: 'BLOG',      headline: "Zahra's Thoughts Before Arizona Space Congress 2026", url: 'https://higherorbits.org/zahras-thoughts-before-arizona-space-congress-2026/' },
  { year: '2026', type: 'VIDEO',     headline: "Arizona aims to become America's premier space state", url: 'https://www.azfamily.com/video/2026/04/07/arizona-aims-become-americas-premier-space-state/' },
  { year: '2026', type: 'BLOG',      headline: "Alexis's Thoughts Before Arizona Space Congress 2026", url: 'https://higherorbits.org/alexiss-thoughts-before-arizona-space-congress-2026/' },
  { year: '2026', type: 'STORY',     headline: 'Arizona Space Congress™ 2026 Mobilizes Statewide Leaders to Position Arizona as a U.S. Industrial Base for the Space Economy', url: 'https://azpbs.org/calendar/arizona-space-congress/' },
  { year: '2026', type: 'PODCAST',   headline: 'Arizona Space Technology Market Intelligence Report 2026', url: 'https://www.youtube.com/watch?v=TLb_wggd_gk' },
  { year: '2026', type: 'ARTICLE',   headline: 'Space Force Poised for 80 Percent Funding Boost in 2027 Budget', url: 'https://www.airandspaceforces.com/space-force-80-percent-funding-boost-2027-budget/' },
  { year: '2026', type: 'STATEMENT', headline: 'Statement from Brett Mecum, Chairman of the Arizona Space Commission, on the Launch of Artemis II', url: 'https://www.linkedin.com/posts/brettmecum_my-official-statement-from-todays-nasa-activity-7445262314896973824-NIoR/' },
  { year: '2026', type: 'ARTICLE',   headline: 'Relaunched Arizona Space Commission targets growth in space industry', url: 'https://www.azfamily.com/2026/04/07/relaunched-arizona-space-commission-targets-growth-space-industry/' },
  { year: '2026', type: 'ARTICLE',   headline: 'Arizona Space Congress™ 2026 Mobilizes Statewide Leaders to Position Arizona as the U.S. Industrial Base for the Space Economy', url: 'https://www.linkedin.com/pulse/arizona-space-congress-2026-mobilizes-statewide-leaders-xqvdc' },
  { year: '2026', type: 'STORY',     headline: 'World Innovation Network Brings Space Tank™ Innovation Competition to Arizona Space Congress 2026', url: 'https://www.linkedin.com/pulse/world-innovation-networks-space-tank-lands-arizona-m6fac/' },
  { year: '2026', type: 'STORY',     headline: 'Government, Academia, Investors, Entrepreneurs, and Students to Deliver Action Blueprint for Arizona Space 2030', url: 'https://www.arizonafoothillsmagazine.com/events/details/24544-arizona-space-congress.html' },
  { year: '2026', type: 'STORY',     headline: 'U of A takes leading operations role in NASA mission', url: 'https://news.arizona.edu/news/u-takes-leading-operations-role-nasa-mission' },
  { year: '2026', type: 'STORY',     headline: 'Space Force Southern activated at Davis-Monthan AFB', url: 'https://www.afsouth.af.mil/News/Article-Display/Article/4384729/space-forces-southern-activated-at-davis-monthan-afb/' },
  // ── 2025 ──────────────────────────────────────────────────────────────────
  { year: '2025', type: 'STORY',     headline: 'U of A Launches AZSCI Project to Push High-Speed, Space-Based Data', url: 'https://news.arizona.edu/news/big-idea-challenge-powers-orbital-data-center-development' },
  { year: '2025', type: 'STORY',     headline: "Mark Kelly Says This 'Exciting' Scientific Find Raises Questions Of Life Beyond Earth", url: 'https://www.aol.com/articles/did-life-happen-nasa-says-223100338.html' },
  { year: '2025', type: 'STORY',     headline: 'Blue Origin and Luxembourg Partner on Oasis-1 Mission to Map Lunar Resources', url: 'https://www.blueorigin.com/news/blue-origin-luxembourg-partner-on-oasis-1-mission' },
  { year: '2025', type: 'STORY',     headline: 'Blue Origin chooses Luxembourg for its European office and signs a declaration of intent for space cooperation', url: 'https://gouvernement.lu/en/actualites/toutes_actualites/communiques/2025/06-juin/19-delles-blue-origin.html' },
  { year: '2025', type: 'STORY',     headline: 'Governor Katie Hobbs launches Arizona Space Commission and announces appointments', url: 'https://azgovernor.gov/office-arizona-governor/news/2025/02/governor-katie-hobbs-launches-arizona-space-commission-and' },
  { year: '2025', type: 'STORY',     headline: "How semiconductor industry helps Arizona's space industry take flight", url: 'https://www.azcentral.com/story/money/business/tech/2025/03/21/how-semiconductor-industry-helps-arizonas-space-industry-take-flight/82575352007/' },
  { year: '2025', type: 'STORY',     headline: 'Leaders gather for summit to explore ways to make Arizona a bigger space industry force', url: 'https://ktar.com/arizona-business/arizona-space-summit-asu/5685545/' },
  { year: '2025', type: 'STORY',     headline: 'ASU in position to accelerate collaboration between space, semiconductor industries', url: 'https://news.asu.edu/20250321-science-and-technology-asu-position-accelerate-collaboration-between-space-semiconductor' },
  // ── 2024 ──────────────────────────────────────────────────────────────────
  { year: '2024', type: 'STORY',     headline: 'Virgin Galactic completes new spaceship manufacturing facility in Arizona', url: 'https://www.businesswire.com/news/home/20240710712223/en/Virgin-Galactic-Completes-New-Spaceship-Manufacturing-Facility-in-Arizona' },
  // ── 2023 ──────────────────────────────────────────────────────────────────
  { year: '2023', type: 'STORY',     headline: 'City funds efforts to get a spaceport in Yuma County', url: 'https://kyma.com/news/kyma-com-category-news-yuma-county/2023/02/02/city-funds-efforts-to-get-a-spaceport-in-yuma-county/' },
];

// Group by year for the editorial layout, preserving order.
const MEDIA_BY_YEAR = MEDIA_ITEMS.reduce((acc, item) => {
  const last = acc[acc.length - 1];
  if (last && last.year === item.year) last.items.push(item);
  else acc.push({ year: item.year, items: [item] });
  return acc;
}, []);

export default function SRWMediaV2() {
  useSRWTitle('Media | Space Rising');

  return (
    <div data-srw="v2">
      <SRWNavV2 />

      <header
        className="srw-pg-hero"
        style={{ '--srw-pg-hero-bg': "url('/v2-assets/asteroid-distant.png')" }}
      >
        <div className="srw-pg-hero-inner">
          <div className="srw-pg-eyebrow">IN THE NEWS</div>
          <h1 className="srw-pg-title">What's being said<span className="srw-pg-period">.</span></h1>
          <p className="srw-pg-sub">
            Coverage of Arizona's space industry from across the state and the country. The signal we're tracking — and the signal we're sending.
          </p>
        </div>
      </header>

      <section className="srw-pg-section">
        <div className="srw-wrap">
          {MEDIA_BY_YEAR.map((group) => (
            <div key={group.year}>
              <h3 className="srw-pg-year">{group.year} · {group.items.length} ITEMS</h3>
              <ul className="srw-pg-list">
                {group.items.map((m) => (
                  <li key={m.url} className="srw-pg-list-item srw-pg-list-item-link">
                    <a
                      className="srw-pg-list-link"
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="srw-pg-list-date"></div>
                      <div>
                        <div className="srw-pg-list-title">{m.headline}</div>
                      </div>
                      <div className="srw-pg-list-type">{m.type}</div>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="srw-pg-cta-stripe">
        <div className="srw-wrap">
          <div className="srw-pg-eyebrow">SUBMIT MEDIA</div>
          <h2>Share your media highlights with the community<span className="srw-pg-period">.</span></h2>
          <a href="mailto:info@spacerising.org" className="srw-pg-cta-stripe-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooterV2 />
    </div>
  );
}
