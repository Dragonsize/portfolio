# Security Portfolio + Learning Labs

Two Vercel apps in one repository:

- `apps/portfolio` - public portfolio: dark purple UI, an interactive wireframe network globe, and a small `nsh` terminal. No embedded vulnerable routes or challenge data.
- `apps/labs` - standalone, simulation-only web-security labs. Three are request-driven (SQL injection, JWT, XSS) with a built-in request editor; five are still keyword-based.

## Safety boundary

Labs are deterministic fixtures, not vulnerable services. They never execute supplied JavaScript, reach external URLs, read host files, create real accounts or sessions, or expose credentials. Use them only for education in this repository's lab environment.

Progress is local to browser storage. It is not an identity, score, leaderboard, or security control.

## Requirements

- Node.js 20+
- npm 10+
- Vercel CLI and account for local serverless functions and deployments

```bash
npm ci
npm run check
npm test
```

## Local development

Run each Vercel app in its own terminal:

```bash
npm run dev:portfolio  # http://localhost:3000
npm run dev:labs       # http://localhost:3001
```

`vercel dev` is required because both apps contain Vercel Serverless Functions (`/api/geo` in the portfolio, `/api/*` in the labs). A plain static server serves the pages but not the APIs; the portfolio still works without `/api/geo` and falls back to the browser timezone.

## Deploy separate Vercel projects

1. Push the repository to GitHub.
2. In Vercel, import it once for the portfolio and set **Root Directory** to `apps/portfolio`.
3. Import it again for the labs and set **Root Directory** to `apps/labs`.
4. Attach your domains, deploy previews, verify, then promote.

CLI alternatives (each directory is linked to its own project when prompted):

```bash
npm run deploy:portfolio
npm run deploy:labs
```

## Portfolio content

All site content lives in `apps/portfolio/data.js`: identity, taglines, stats, projects, experience, competitions, certifications, skills and contact links. The terminal's virtual files are generated from the same data, so editing it updates both.

Do not publish unverified certifications, metrics or clients. Contact is text links only; no form backend exists. Keep personal documents (CV, notes, saved pages) out of the repository.

Other portfolio files:

- `net-globe.js` - the hero globe (hosts, packet arcs, click-to-scan, visitor marker).
- `visitor-geo.js` and `api/geo.js` - approximate visitor location from Vercel's IP headers, with a timezone fallback. Nothing is stored or logged.
- `terminal.js` - the `nsh` shell over a read-only virtual home directory.

## Labs architecture

- `shared/challenge-registry.js` - public card metadata and endpoint mapping. `interactive: true` marks the request-driven labs.
- `shared/progress-store.js` - local versioned completion store.
- `api/_lib/interactive-labs.js` - deterministic engines for sqli, jwt and xss, each with a vulnerable build and a patched build (`fixed=1`).
- `api/_lib/create-interactive-handler.js` and `rate-limit.js` - HTTP wrapper that reads the query, JSON body, `Authorization: Bearer` header and `session` cookie, with a best-effort rate limit.
- `api/_lib/lab-scenarios.js` - keyword-based scenarios for the remaining labs and flag verification for all labs.
- `api/lab-submit.js` - shared server-side flag verifier.
- `interactive-ui.js`, `shared/repeater.js`, `shared/interactive-config.js` - the in-page request editor, hints and patch-and-replay phase.

Tools are optional. The Repeater panel covers everything in the browser, and Burp Suite works against each lab's own endpoint. Automated scanners (nmap, sqlmap, wpscan) are not needed and requests are rate limited.

## Quality checks

```bash
npm run check  # JavaScript syntax checks
npm test       # simulators, repeater parser, terminal, globe maths, geo
```

Manual release checks:

1. Keyboard-test the portfolio and terminal: backtick, Tab, history arrows, Ctrl+L, Ctrl+C, Escape and focus restoration.
2. Test mobile width, 200% zoom and reduced-motion mode.
3. Open and complete each lab, reload, confirm local progress, test reset.
4. Inspect preview response headers. The portfolio must not expose lab APIs, debug headers, fake secrets or an unsafe CSP.
5. After deploying, confirm `/api/geo` returns data and is not caught by the 404 route.

## Security reporting

No security-reporting address is configured yet. Add a `SECURITY.md` with a verified contact before public launch.

## License

No license selected. Add one before accepting external contributions or reuse.
