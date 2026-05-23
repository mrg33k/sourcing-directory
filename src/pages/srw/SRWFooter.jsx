import React from 'react';
import { Link } from 'react-router-dom';

export default function SRWFooter() {
  return (
    <footer className="srw-footer">
      <div className="srw-wrap">
        <div className="srw-footer-inner">
          <div>
            <img src="/images/space-rising/logo-white.png" alt="Space Rising" />
            <p className="srw-footer-mission">
              The connective layer for the evolving space economy — mobilizing
              Arizona's space ecosystem across industry, government, and academia.
            </p>
            <div className="srw-social">
              <a href="https://www.linkedin.com/company/space-rising/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.98 3.5C4.98 4.88 3.87 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.02 8h4.96v15H.02V8zm7.5 0h4.75v2.05h.07c.66-1.25 2.27-2.57 4.67-2.57 5 0 5.92 3.29 5.92 7.57V23h-4.96v-6.67c0-1.59-.03-3.64-2.22-3.64-2.22 0-2.56 1.73-2.56 3.52V23H7.52V8z" />
                </svg>
              </a>
              <a href="https://www.youtube.com/@spacerising" target="_blank" rel="noreferrer" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
                </svg>
              </a>
            </div>
          </div>

          <div className="srw-footer-col">
            <Link to="/srw/spaceos">SpaceOS™</Link>
            <Link to="/srw/space-congress">Space Congress™</Link>
            <Link to="/srw/events">Events</Link>
            <Link to="/srw/media">Reports & Media</Link>
            <Link to="/srw/partnerships">Partnerships</Link>
            <a href="mailto:info@spacerising.org">Subscribe</a>
          </div>
        </div>
      </div>

      <div className="srw-footer-bottom">
        <span>© {new Date().getFullYear()} Space Rising. All rights reserved.</span>
        <a href="mailto:info@spacerising.org">info@spacerising.org</a>
      </div>
    </footer>
  );
}
