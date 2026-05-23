import React from 'react';
import SRWNav from './SRWNav.jsx';
import SRWFooter from './SRWFooter.jsx';
import useSRWTitle from './useSRWTitle.js';
import './srw.css';

const HERO_BG = '/images/space-rising/bg-space.jpg';

const MEDIA_BY_YEAR = [
  {
    year: '2026',
    items: [
      { headline: "Zahra's Arizona Space Congress 2026 Experience | Higher Orbits", type: 'Blog' },
      { headline: 'Arizona hosts first Space Congress to boost aerospace economy', type: 'Story' },
      { headline: "Arizona Space Congress aims to turn renewed space excitement into a real economic play for the state", type: 'Watch Segment' },
      { headline: "Arizona's spaceport push: Yuma for launch, Sierra Vista for re-entry", type: 'Story' },
      { headline: 'Arizona aims to become key player in trillion-dollar space economy', type: 'Story' },
      { headline: 'Arizona Space Congress | FOX 10 Talks', type: 'Podcast' },
      { headline: "Arizona space industry prepares for 'gold boom' with first 'Space Congress'", type: 'Video' },
      { headline: 'Arizona Horizon - Space Congress 2026', type: 'Watch' },
      { headline: 'Desert Showdown: Yuma and Sierra Vista Scramble for Arizona\'s First Spaceports', type: 'Story' },
      { headline: 'KTAR Podcast: Arizona Space Congress', type: 'Podcast' },
      { headline: 'Aerospace companies will convene in Phoenix to seek ways to bolster innovation and growth', type: 'Story' },
      { headline: "Zahra's Thoughts Before Arizona Space Congress 2026", type: 'Blog' },
      { headline: "Arizona aims to become America's premier space state", type: 'Video' },
      { headline: "Alexis's Thoughts Before Arizona Space Congress 2026", type: 'Blog' },
      { headline: 'Arizona Space Congress™ 2026 Mobilizes Statewide Leaders to Position Arizona as a U.S. Industrial Base for the Space Economy', type: 'Story' },
      { headline: 'Arizona Space Technology Market Intelligence Report 2026', type: 'Podcast' },
      { headline: 'Space Force Poised for 80 Percent Funding Boost in 2027 Budget', type: 'Article' },
      { headline: 'Statement from Brett Mecum, Chairman of the Arizona Space Commission, on the Launch of Artemis II', type: 'Statement' },
      { headline: 'Relaunched Arizona Space Commission targets growth in space industry', type: 'Article' },
      { headline: 'Arizona Space Congress™ 2026 Mobilizes Statewide Leaders to Position Arizona as the U.S. Industrial Base for the Space Economy', type: 'Article' },
      { headline: 'World Innovation Network Brings Space Tank™ Innovation Competition to Arizona Space Congress 2026', type: 'Story' },
      { headline: "Government, Academia, Investors, Entrepreneurs, and Students to Deliver Action Blueprint for Arizona Space 2030", type: 'Story' },
      { headline: 'U of A takes leading operations role in NASA mission', type: 'Story' },
      { headline: 'Space Force Southern activated at Davis-Monthan AFB', type: 'Story' },
      { headline: 'Newly Launched! Open Space Report with David Ariosto', type: 'Podcast' },
    ],
  },
  {
    year: '2025',
    items: [
      { headline: 'U of A Launches AZSCI Project to Push High-Speed, Space-Based Data', type: 'Story' },
      { headline: "Mark Kelly Says This 'Exciting' Scientific Find Raises Questions Of Life Beyond Earth", type: 'Story' },
      { headline: 'Blue Origin and Luxembourg Partner on Oasis-1 Mission to Map Lunar Resources', type: 'Story' },
      { headline: 'NASA selects rocket for U of A-led Aspera mission', type: 'Story' },
      { headline: 'A Profound Moment at Biosphere 2', type: 'Blog' },
      { headline: "Blue Origin chooses Luxembourg for its European office and signs a declaration of intent for space cooperation", type: 'Story' },
      { headline: 'Governor Katie Hobbs launches Arizona Space Commission and announces appointments', type: 'Story' },
      { headline: "How semiconductor industry helps Arizona's space industry take flight", type: 'Story' },
      { headline: 'Leaders gather for summit to explore ways to make Arizona a bigger space industry force', type: 'Story' },
      { headline: 'ASU in position to accelerate collaboration between space, semiconductor industries', type: 'Story' },
    ],
  },
  {
    year: '2024',
    items: [
      { headline: 'Virgin Galactic completes new spaceship manufacturing facility in Arizona', type: 'Story' },
      { headline: "12 News: Governor Hobbs joined scientists and ASU researchers to talk about taking Arizona out of this world", type: 'Video' },
      { headline: "Gov. Hobbs tells space-related companies Arizona is 'open for business'", type: 'Story' },
      { headline: 'Thunderbird at ASU student champions commercial space programs', type: 'Story' },
      { headline: "Arizona's pushes space sector's growth through education, collaboration, economy", type: 'Story' },
      { headline: "Arizona declares Pluto as its 'official state planet' — even though it's not a planet", type: 'Story' },
      { headline: 'Opportunities are boundless', type: 'Story' },
    ],
  },
  {
    year: '2023',
    items: [
      { headline: 'Blue Origin space company opens new office in Phoenix', type: 'Story' },
      { headline: 'City funds efforts to get a spaceport in Yuma County', type: 'Story' },
      { headline: 'Arizona PBS to air special on Psyche space mission', type: 'Video' },
      { headline: 'Exploring new frontiers of space (University of Arizona / Arizona Space Institute)', type: 'Story' },
      { headline: "ASU helps chart a course for Arizona's space industry", type: 'Story' },
      { headline: "Lt. Col. Justin Chandler, director of the chief of space operations' Strategic Initiatives Group of the U.S. Space Force", type: 'Video' },
      { headline: 'Ambassador Barbara M. Barrett, former 25th Secretary of the Air Force', type: 'Video' },
    ],
  },
];

export default function SRWMedia() {
  useSRWTitle('Media | Space Rising');

  return (
    <div data-srw>
      <SRWNav />

      <header className="srw-hero srw-hero-sm">
        <div className="srw-hero-bg" style={{ backgroundImage: `url(${HERO_BG})` }} />
        <div className="srw-hero-veil" />
        <div className="srw-wrap srw-hero-inner">
          <div className="srw-eyebrow">In the News</div>
          <h1>Media</h1>
          <p className="srw-hero-sub">
            Share your media highlights with Arizona's space community.
          </p>
        </div>
      </header>

      <section className="srw-section">
        <div className="srw-wrap">
          {MEDIA_BY_YEAR.map((group) => (
            <div key={group.year} style={{ marginBottom: 56 }}>
              <h3 className="srw-year-head">{group.year} Media Highlights</h3>
              <div className="srw-list">
                {group.items.map((m, i) => (
                  <div className="srw-list-item" key={i}>
                    <span className="srw-list-title">{m.headline}</span>
                    <span className="srw-list-meta">{m.type}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="srw-contact">
        <div className="srw-wrap">
          <div className="srw-eyebrow">Submit Media</div>
          <h2>Share your media highlights with Arizona's space community</h2>
          <a href="mailto:info@spacerising.org" className="srw-email">info@spacerising.org</a>
        </div>
      </section>

      <SRWFooter />
    </div>
  );
}
