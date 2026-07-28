# Security Portfolio + Learning Labs

Two Vercel apps in one repository:

- `apps/portfolio` — public, terminal-inspired portfolio. No embedded vulnerable routes or challenge data.
- `apps/labs` — standalone educational simulations for common web-security concepts.

## Safety boundary

Labs are deterministic fixtures, not vulnerable services. They never execute supplied JavaScript, reach external URLs, read host files, create real accounts/sessions, or expose credentials. Use them only for education in this repository's lab environment.

Progress is local to browser storage. It is not an identity, score, leaderboard, or security control.

## Requirements

- Node.js 20+
- npm 10+
- Vercel account for deployments

```bash
npm install
npm run check
npm test
```

`npm install` generates `package-lock.json`; commit it. CI and clean installs should then use:

```bash
npm ci
```

This checkout does not include a lockfile yet, so run `npm install` once before `npm ci`.

## Local development

Run each Vercel app in separate terminal:

```bash
npm run dev:portfolio  # http://localhost:3000
npm run dev:labs       # http://localhost:3001
```

`npm run dev` starts portfolio app. `vercel dev` is required because labs include Vercel Serverless Functions.

Before local portfolio-to-labs demos, update `labsUrl` in `apps/portfolio/app.js` to `http://localhost:3001`. Restore production URL before deployment.

## Deploy separate Vercel projects

Recommended domain layout:

- Portfolio: `example.com`
- Labs: `labs.example.com`

1. Push repository to GitHub, GitLab, or Bitbucket.
2. In Vercel, import repository for portfolio project. Set **Root Directory** to `apps/portfolio`.
3. Import same repository again for labs project. Set **Root Directory** to `apps/labs`.
4. Attach portfolio domain to first project and labs subdomain to second project.
5. Set production labs URL in `apps/portfolio/app.js`.
6. Update placeholder canonical domain in `apps/portfolio/robots.txt` and `apps/portfolio/sitemap.xml`.
7. Deploy preview URLs, verify them, then promote each project.

Vercel Hobby commonly supports multiple projects and subdomains. Confirm current usage limits and plan terms in Vercel dashboard before launch.

CLI alternatives:

```bash
npm run deploy:portfolio
npm run deploy:labs
```

Link each directory to its own Vercel project when prompted.

## Portfolio content

`apps/portfolio/app.js` contains `PORTFOLIO` configuration:

- labs URL
- project drafts and verified URLs
- skills
- contact links

Replace all placeholders before production. Do not publish unverified certifications, metrics, clients, social URLs, or a résumé link.

Contact is deliberate text links only. No contact form backend exists.

## Labs architecture

- `apps/labs/shared/challenge-registry.js` — public card metadata and explicit endpoint mapping.
- `apps/labs/shared/progress-store.js` — local versioned completion store.
- `apps/labs/api/_lib/lab-scenarios.js` — server-only deterministic scenario/flag logic.
- `apps/labs/api/lab-submit.js` — shared server-side flag verifier.

Each lab endpoint returns JSON:

```json
{
  "challengeId": "sqli",
  "status": "active",
  "artifact": {},
  "hint": "...",
  "learning": ["..."],
  "remediation": ["..."]
}
```

Supported concepts: input/query boundaries, output encoding, request integrity, token validation, authentication decisions, virtual path handling, outbound request controls, and information exposure.

## Quality checks

```bash
npm run check  # JavaScript syntax checks
npm test       # registry and deterministic simulator tests
```

Manual release checks:

1. Keyboard-test portfolio navigation and terminal: `~`, Tab, history arrows, Ctrl+L, Escape, and focus restoration.
2. Test mobile width, 200% zoom, and reduced-motion mode.
3. Open and complete each lab; reload; confirm local progress; test reset.
4. Inspect preview response headers. Portfolio must not expose lab APIs, debug headers, fake secrets, or unsafe CSP.
5. Check `robots.txt` and `sitemap.xml` after configuring real domain.

## Security reporting

No security-reporting address configured yet. Add `SECURITY.md` with a verified contact before public launch.

## License

No license selected. Add one before accepting external contributions or reuse.
