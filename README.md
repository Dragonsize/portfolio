# Security Portfolio + Learning Labs

Two Vercel apps in one repository:

- `apps/portfolio` - public portfolio: dark purple UI, an interactive wireframe network globe, and a small `nsh` terminal. No embedded vulnerable routes or challenge data.
- `apps/labs` - standalone, simulation-only web-security labs. All eight are request-driven with a built-in request editor: SQL injection, JWT, XSS, CSRF, authentication, path traversal, SSRF and information exposure. Each has hints, a hidden flag to find, and a patch-and-replay fix phase.

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

## Run locally (no Vercel account needed)

```bash
npm start              # portfolio http://127.0.0.1:3000 and labs http://127.0.0.1:3001
npm run start:labs     # labs only
npm run start:portfolio
node scripts/local-server.js labs --port 4000   # custom port
```

`scripts/local-server.js` has no dependencies. It serves the static files, runs the real handlers in `apps/*/api/` with a Vercel-style `req`/`res`, and applies the headers from each `vercel.json` (including the CSP), so problems show up locally the same way they would in production. It binds to `127.0.0.1` by default; passing `--host 0.0.0.0` exposes it to your network and prints a warning. It is a dev server, not a production host: use Vercel for the public deployment.

The rate limiter and visitor-location header only behave fully on Vercel. Locally `/api/geo` returns 204 (no location headers), so the globe uses the browser timezone.

## Local development with the Vercel CLI

Use this if you want exact Vercel behaviour. Run each app in its own terminal:

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
- `api/_lib/interactive-labs.js` and `interactive-labs-extra.js` - deterministic engines for all eight labs, each with a vulnerable build and a patched build (`fixed=1`). Flags sit inside leaked data and are never a response field.
- `api/_lib/create-interactive-handler.js` and `rate-limit.js` - HTTP wrapper that reads the query, JSON or form body, `Authorization: Bearer` header, `session` cookie and `Origin` header, with a best-effort rate limit.
- `api/_lib/lab-scenarios.js` - the small surface the flag verifier uses.
- `api/lab-submit.js` - shared server-side flag verifier.
- `interactive-ui.js`, `shared/repeater.js`, `shared/interactive-config.js`, `shared/interactive-config-extra.js` - the in-page request editor, per-lab apps, hints and patch-and-replay phase. Edit lab text and patch options in the config files.

Tools are optional. The Repeater panel covers everything in the browser, and Burp Suite works against each lab's own endpoint. Automated scanners (nmap, sqlmap, wpscan) are not needed and requests are rate limited.

## Quality checks

```bash
npm run check  # syntax-checks every .js file under apps/, scripts/ and tests/
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
