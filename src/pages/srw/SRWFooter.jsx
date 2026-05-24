import React from 'react';

// Space Rising footer — matches spacerising.org layout exactly:
// Big ghost logo on the left (oversized, dimmed), mission text + social icons
// + SUBSCRIBE button stacked on the right. Bottom strip shows Photo Credits
// (NASA) on the left and copyright/email on the right, single line.
export default function SRWFooter() {
  return (
    <footer className="srw-footer">
      <div className="srw-footer-inner">
        <div className="srw-footer-logo">
          <img
            src="https://images.squarespace-cdn.com/content/v1/68dd48ebe70058312aa9230b/82e43967-ce2d-47fc-9d5d-efe3433d1876/SpaceRising_LOGO-WHT.png?format=1500w"
            alt="Space Rising"
          />
        </div>

        <div className="srw-footer-right">
          <p className="srw-footer-mission">
            <strong>Space Rising</strong> is dedicated to strengthening the nation's space ecosystem and empowering the next generation of leaders who will carry it forward.
          </p>

          <div className="srw-footer-actions">
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
            <a href="mailto:info@spacerising.org" className="srw-footer-subscribe">SUBSCRIBE</a>
          </div>
        </div>
      </div>

      <div className="srw-footer-bottom">
        <span><strong>Photo Credits:</strong> NASA</span>
        <span>© {new Date().getFullYear()} All rights reserved. | <a href="mailto:info@spacerising.org">info@spacerising.org</a></span>
      </div>
    </footer>
  );
}
