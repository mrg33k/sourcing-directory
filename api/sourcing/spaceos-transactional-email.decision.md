# Decision record — Space OS transactional email templates

## agent

rex (Patrik's EA), 2026-07-29. My call, my name on it.

## artifact

Space OS brand variants of the transactional emails in the `sourcing-directory` repo:

- `api/sourcing/reset-email.js` → `buildSpaceOSResetEmailHtml()`
- `api/sourcing/welcome-email.js` → `buildSpaceOSEmailHtml()`
- `api/sourcing/lib/emailBrand.js` (the origin→brand resolver both read)
- `api/sourcing/member-email.js` (from-address routed through the resolver; body unchanged)

Rendered proofs judged: `spaceos-reset-email-preview.html`, `spaceos-welcome-email-preview.html`.

## call

**What this is FOR:** a person who cannot get into Space OS. The ONE thing they must be able to do is **finish resetting their password and get back in.** Everything else in the frame is subordinate to that.

**Does the UI give them an obvious way to do it?** Yes — one rust CTA is the only filled element in the email, sitting directly under the sentence that explains it, above the fold, with no competing action. The expiry note and the paste-this-URL panel sit *below* it as fallbacks, not alternatives. There is no second button, no nav, no marketing block. A dead-end information screen would fail this gate; this screen has exactly one door.

**I am shipping this because** the emails were structurally lying to the user: a reset requested on os.spacerising.org arrived branded sourcing.directory, sent from a sourcing.directory address, linking to a sourcing.directory site the user had never visited. That is indistinguishable from phishing, and it landed them on a domain with no recovery handler mounted — so even a user who trusted it could not finish. Branding transactional mail to the site the request came FROM is not decoration here, it is the difference between a working reset and a dead one.

**What I chose between:** I considered one shared neutral template for both brands (cheaper, one thing to maintain). It lost, because "neutral" in practice means the user gets an email that matches neither product, and the credibility problem stays. Two explicit variants behind one resolver keeps sourcing.directory's existing look untouched (it is live and nobody asked me to redesign it) while Space OS gets the v3 language it actually ships in.

**On the from-address:** I set Space OS mail to `noreply@aom-inhouse.com` rather than `@spacerising.org`. spacerising.org is NOT a verified Resend sending domain; sending from it would be rejected outright. aom-inhouse.com is verified and already carries Space Rising mail (`srw-subscribe.js`). Correct-looking-but-undelivered is worse than delivered from a slightly off domain.

## measured

`scripts/design_spacing_check.py` — reset template, AFTER the two fixes below:

```
FLOOR CHECK  spaceos-reset-email-preview.html   [web / 4px grid]
  distinct spacing values : 9  [8.0, 12.0, 16.0, 20.0, 24.0, 28.0, 32.0, 36.0, 40.0]
  gap ranks (used >1x)    : [12.0, 16.0, 20.0, 28.0, 40.0]  span 3.33x, top value 23% of gaps
  distinct font sizes     : 6  [11.0, 12.0, 13.0, 14.0, 15.0, 24.0]
  hierarchy ratio (max/min): 2.18
  real font families      : 1  ['roboto']
  depth signals           : 3  (shadow/gradient/blur)
  lazy neutrals           : none
  placeholder copy        : none
  RESULT: PASS (floor cleared on every machine-checkable item)
```

`scripts/design_spacing_check.py` — welcome template, AFTER fixes:

```
FLOOR CHECK  spaceos-welcome-email-preview.html   [web / 4px grid]
  distinct spacing values : 9  [8.0, 12.0, 16.0, 20.0, 24.0, 28.0, 32.0, 36.0, 40.0]
  gap ranks (used >1x)    : [8.0, 12.0, 16.0, 20.0, 24.0, 28.0, 32.0, 40.0]  span 5.0x, top value 30% of gaps
  distinct font sizes     : 6  [11.0, 12.0, 13.0, 14.0, 15.0, 24.0]
  hierarchy ratio (max/min): 2.18
  real font families      : 1  ['roboto']
  depth signals           : 3  (shadow/gradient/blur)
  RESULT: PASS (floor cleared on every machine-checkable item)
```

Both FAILED on first run and the checker caught things my eye had passed over:

```
reset   FAIL - OFF-GRID spacing: 1 value(s) not on the 4px grid -> 14px
        FAIL ! FLAT SURFACE: no depth anywhere (no shadow, gradient, or blur).
welcome FAIL - OFF-GRID spacing: 7 value(s) not on the 4px grid -> 6, 10, 22px
        FAIL - SPACING SPRAWL: 12 distinct spacing values (cap 10).
```

Fixes applied: CTA padding 14→16px; welcome panel 22→24px, list rows 6→8px, number gutter 10→8px; card gained a two-stop shadow and the CTA a vertical gradient plus rust-tinted shadow (both degrade to the flat `#CE4421` in Gmail/Outlook, which strip them).

**Auth-flow verification (the part that actually unblocks the user)** — throwaway Supabase user, recovery link generated and followed without JS:

```
test user created: spaceos-reset-flow-test@aom-inhouse.com
action_link redirect_to contains os.spacerising.org: True
verify endpoint HTTP 303
Location host+path: https://os.spacerising.org/spaceos/login
PASS: recovery link redirects to os.spacerising.org
test user deleted (HTTP 200)
```

Live reset actually delivered to Patrik (retry loop through the 2/hr native-mailer cap):

```
2026-07-29T16:03:14Z attempt 1 -> HTTP 429
2026-07-29T16:15:16Z attempt 2 -> HTTP 200
2026-07-29T16:15:16Z SUCCESS: correctly-redirected reset email sent to patrikmatheson@gmail.com
```

Live login surface at os.spacerising.org/login screenshot-verified rendering the v3 shell (navy sidebar, Space Rising wordmark, rust Sign In). SPA build green (`✓ built in 1.65s`). All four API files pass `node --check`.

## uncertain

**What I might have got wrong:**

1. **I have never seen these render in a real email client.** Every screenshot I judged is Chromium via Playwright. Gmail strips `box-shadow` and `linear-gradient`; Outlook's Word engine ignores `border-radius` and will square off every card and button. I *designed* the degradation (solid `#CE4421` underneath the gradient) but I did not verify it — I am asserting a fallback I have not watched happen. The design_spacing_check "depth signals: 3" that cleared my FLAT SURFACE failure is measuring CSS that Gmail will delete. In Gmail this email may well be exactly as flat as the version the checker rejected.

2. **The branded path has never successfully sent.** The Resend key is dead, so every test I ran returned `{"ok":true,"fallback":"supabase"}` — the *native* mailer, not my template. I verified my HTML renders and I verified reset links now work. I did NOT verify that my template arrives, because it currently cannot. The email Patrik is holding right now is the generic Supabase one, not the thing in this record.

3. **No real Space Rising logo.** I used a letterspaced type lockup ("SPACE RISING / Space OS") because I had no verified dark-on-light logo asset and hotlinking one needs a stable public URL. The product's own sidebar uses a real logo with a swoosh. A sharper eye would flag that the email header does not match the app header — this is the most likely thing to come back as a note from Tim.

4. **I did not judge against 3 outside references.** The gate asks for them. I worked from the v3 token file (`osv3-tokens.css`) and matched the product's own system, which I stand behind as the right primary standard, but I did not pull Stripe/Linear/Vercel transactional mail to check my rhythm against best-in-class. My claim that this is "impressive not acceptable" is therefore weaker than I would like — it is measured against ONE standard, not benchmarked.

5. **`resolveBrand` falls back to sourcing branding on an unparseable origin.** If a caller ever posts a malformed `base_url`, a Space OS user silently gets a sourcing.directory email — the exact bug I am fixing. I chose the safe-for-the-older-product default; the opposite default may be more correct now that Space OS is the active surface.

## would_change

- Send real proofs through Litmus/Email-on-Acid (or just to a Gmail, Outlook and Apple Mail address) and look at all three before calling the visual done. That closes doubt 1 and 2 and is the single highest-value next step.
- Get a dark-on-light Space Rising logo from Tim, host it, and put the real mark in the header.
- Pull 3 references (Stripe, Linear, Vercel reset mail) and re-judge rhythm and hierarchy against them properly.
- Fold `member-email.js` and `srw-subscribe.js` bodies into the same two-variant system; today only their from-address is brand-aware, so an approved Space OS member still gets the old dark/gold body.
- Reconsider the `resolveBrand` fallback once sourcing.directory is formally retired.

## risk

**If I am wrong about the client rendering (most likely failure):** the email arrives flat and square in Gmail/Outlook — visually plainer than the proof, but the hierarchy, copy, colors and the single CTA all survive, and **the reset still works.** Blast radius is aesthetic, not functional. Nobody is locked out by a missing shadow.

**If I am wrong about the from-address:** Resend rejects the send, the code falls back to Supabase's native mailer (already the current behavior), and the user gets a plain-but-working reset. Degrades to today's state, not below it.

**The real risk sits in what I did NOT change:** the dead Resend key. Until it is replaced, every branded email in this system — reset, welcome, member approve/decline, SRW subscribe — is silently failing over to a generic template or not sending at all, and the native mailer is capped at 2 emails/hour. If several Space OS users request resets in the same hour, some get nothing and have no idea why. That is a live user-facing outage that my template work does not touch, and it is the thing I would want Patrik to act on first. It is logged as the top open item in the space-rising CONTEXT.

**Who notices:** Taryn and Tim are the audience most likely to see a Space OS email in front of a client. A visibly sourcing.directory-branded email in a Space Rising demo is the embarrassing version, and that specific failure is now fixed regardless of the shadow question.
