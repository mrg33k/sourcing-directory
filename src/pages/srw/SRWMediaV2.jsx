import React from 'react';
import SRWNavV2 from './SRWNavV2.jsx';
import SRWFooterV2 from './SRWFooterV2.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw-v2.css';

const MEDIA_BY_YEAR = [
  {
    year: '2026',
    items: [
      { headline: "Zahra's Arizona Space Congress 2026 Experience | Higher Orbits", type: 'BLOG' },
      { headline: 'Arizona hosts first Space Congress to boost aerospace economy', type: 'STORY' },
      { headline: 'Arizona Space Congress aims to turn renewed space excitement into a real economic play for the state', type: 'WATCH' },
      { headline: "Arizona's spaceport push: Yuma for launch, Sierra Vista for re-entry", type: 'STORY' },
      { headline: 'Arizona aims to become key player in trillion-dollar space economy', type: 'STORY' },
      { headline: 'Arizona Space Congress | FOX 10 Talks', type: 'PODCAST' },
      { headline: "Arizona space industry prepares for 'gold boom' with first 'Space Congress'", type: 'VIDEO' },
      { headline: 'Arizona Horizon — Space Congress 2026', type: 'WATCH' },
      { headline: "Desert Showdown: Yuma and Sierra Vista Scramble for Arizona's First Spaceports", type: 'STORY' },
      { headline: 'KTAR Podcast: Arizona Space Congress', type: 'PODCAST' },
      { headline: 'Aerospace companies will convene in Phoenix to seek ways to bolster innovation and growth', type: 'STORY' },
      { headline: "Zahra's Thoughts Before Arizona Space Congress 2026", type: 'BLOG' },
      { headline: "Arizona aims to become America's premier space state", type: 'VIDEO' },
      { headline: "Alexis's Thoughts Before Arizona Space Congress 2026", type: 'BLOG' },
      { headline: 'Arizona Space Congress™ 2026 Mobilizes Statewide Leaders to Position Arizona as a U.S. Industrial Base', type: 'STORY' },
      { headline: 'Arizona Space Technology Market Intelligence Report 2026', type: 'PODCAST' },
      { headline: 'Space Force Poised for 80 Percent Funding Boost in 2027 Budget', type: 'ARTICLE' },
      { headline: 'Statement from Brett Mecum on the Launch of Artemis II', type: 'STATEMENT' },
      { headline: 'Relaunched Arizona Space Commission targets growth in space industry', type: 'ARTICLE' },
      { headline: "Government, Academia, Investors to Deliver Action Blueprint for Arizona Space 2030", type: 'STORY' },
      { headline: 'U of A takes leading operations role in NASA mission', type: 'STORY' },
      { headline: 'Space Force Southern activated at Davis-Monthan AFB', type: 'STORY' },
      { headline: 'Newly Launched! Open Space Report with David Ariosto', type: 'PODCAST' },
    ],
  },
  {
    year: '2025',
    items: [
      { headline: 'U of A Launches AZSCI Project to Push High-Speed, Space-Based Data', type: 'STORY' },
      { headline: "Mark Kelly Says This 'Exciting' Scientific Find Raises Questions Of Life Beyond Earth", type: 'STORY' },
      { headline: 'Blue Origin and Luxembourg Partner on Oasis-1 Mission to Map Lunar Resources', type: 'STORY' },
      { headline: 'NASA selects rocket for U of A-led Aspera mission', type: 'STORY' },
      { headline: 'A Profound Moment at Biosphere 2', type: 'BLOG' },
      { headline: 'Governor Katie Hobbs launches Arizona Space Commission and announces appointments', type: 'STORY' },
      { headline: "How semiconductor industry helps Arizona's space industry take flight", type: 'STORY' },
      { headline: 'Leaders gather for summit to explore ways to make Arizona a bigger space industry force', type: 'STORY' },
      { headline: 'ASU in position to accelerate collaboration between space, semiconductor industries', type: 'STORY' },
    ],
  },
  {
    year: '2024',
    items: [
      { headline: 'Virgin Galactic completes new spaceship manufacturing facility in Arizona', type: 'STORY' },
      { headline: '12 News: Governor Hobbs joined scientists and ASU researchers', type: 'VIDEO' },
      { headline: "Gov. Hobbs tells space-related companies Arizona is 'open for business'", type: 'STORY' },
      { headline: 'Thunderbird at ASU student champions commercial space programs', type: 'STORY' },
      { headline: "Arizona's pushes space sector's growth through education, collaboration, economy", type: 'STORY' },
      { headline: 'Opportunities are boundless', type: 'STORY' },
    ],
  },
  {
    year: '2023',
    items: [
      { headline: 'Blue Origin space company opens new office in Phoenix', type: 'STORY' },
      { headline: 'City funds efforts to get a spaceport in Yuma County', type: 'STORY' },
      { headline: 'Arizona PBS to air special on Psyche space mission', type: 'VIDEO' },
      { headline: 'Exploring new frontiers of space (University of Arizona / Arizona Space Institute)', type: 'STORY' },
      { headline: "ASU helps chart a course for Arizona's space industry", type: 'STORY' },
    ],
  },
];

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
                {group.items.map((m, i) => (
                  <li className="srw-pg-list-item" key={i}>
                    <div className="srw-pg-list-date"></div>
                    <div>
                      <div className="srw-pg-list-title">{m.headline}</div>
                    </div>
                    <div className="srw-pg-list-type">{m.type}</div>
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
