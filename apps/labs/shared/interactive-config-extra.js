// Content for the csrf, auth, path, ssrf and secrets labs. Plain data; rendered with textContent only.

export const EXTRA_INTERACTIVE = Object.freeze({
  csrf: {
    story: 'BankLab lets a signed-in user send money. Browsers attach your session cookie to every request to the bank, even requests started by a page on another site. See whether the server checks that you meant to send it.',
    goal: 'Make a cross-site request move money, then read the incident log.',
    hints: [
      'Load your session first and note the token. What does a transfer request need to carry?',
      'Send a transfer with the token field empty. Does the server care?',
      'A forged form on another site sends an Origin that is not https://bank.lab. Change the origin field and send again.',
      'Set origin to https://evil.example, to to mallory, leave the token empty. Sending it as GET works too.'
    ],
    patches: [
      { id: 'httponly', label: 'Mark the session cookie HttpOnly', code: 'Set-Cookie: session=abc123; HttpOnly; Secure', correct: false, why: 'HttpOnly stops scripts from reading the cookie. The browser still attaches it to forged requests, so the attack is unchanged.' },
      { id: 'token', label: 'Require an anti-forgery token, check Origin, accept POST only', code: "if (req.method !== 'POST') return 405\nif (!allowedOrigins.has(req.headers.origin)) return 403\nif (req.body.token !== session.csrfToken) return 403", correct: true, why: 'A forged page cannot read your token and its Origin is wrong, so the server can tell the request did not come from your own form.' },
      { id: 'hide', label: 'Rename the transfer URL so attackers cannot guess it', code: "app.post('/x9f2-transfer', transfer)", correct: false, why: 'Obscurity is not a control. The URL is visible to anyone who uses the site, and the browser still sends the cookie.' }
    ],
    links: [
      ['OWASP: CSRF Prevention Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html'],
      ['PortSwigger: CSRF', 'https://portswigger.net/web-security/csrf']
    ]
  },
  auth: {
    story: 'VaultLab has a login form and three accounts. Find a way in as the administrator, using only what the form tells you.',
    goal: 'Sign in as admin and read the break-glass code.',
    hints: [
      'Try a username that does not exist, then one that does. Compare the two messages.',
      'Different messages let anyone list valid accounts. Which of alice, bob and admin exist?',
      'Privileged accounts often keep their factory default password. Try the usual ones.',
      'Try the user admin with the password admin123.'
    ],
    patches: [
      { id: 'message', label: 'Return one generic error but keep the default password', code: "return res.status(401).json({ error: 'Invalid credentials' })", correct: false, why: 'A generic message stops account enumeration, but the factory default still opens the admin account.' },
      { id: 'bootstrap', label: 'Force a unique password at setup, rate limit, and use one generic error', code: 'if (user.mustChangePassword) disableLogin(user)\nif (failures >= 5) return lock(15 * 60)\nreturn generic401()', correct: true, why: 'No shared default exists, guessing is throttled, and the responses reveal nothing about which accounts are real.' },
      { id: 'rename', label: 'Rename the admin account to "root"', code: "users.rename('admin', 'root')", correct: false, why: 'The default password is the weakness, not the name. Attackers try root too.' }
    ],
    links: [
      ['OWASP: Authentication Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html'],
      ['PortSwigger: Authentication vulnerabilities', 'https://portswigger.net/web-security/authentication']
    ]
  },
  path: {
    story: 'DocsLab shows documents from a docs folder. Staff keep notes in a different folder that is not linked anywhere. Level 2 adds a filter that removes "../" from the file name.',
    goal: 'Read the private staff notes at Level 2.',
    hints: [
      'Open guide.txt and read the "resolved" path in the response. The server builds it from your input.',
      'The release notes mention a folder that is not linked. What is it called?',
      '".." climbs one folder up. At Level 2 the filter removes "../" once, in a single pass.',
      'Level 1: ../private/staff-notes.txt. Level 2: ....//private/staff-notes.txt (removing "../" from the middle leaves a new "../").'
    ],
    patches: [
      { id: 'strip', label: 'Strip "../" from the file name', code: "name = name.replace(/\\.\\.\\//g, '')", correct: false, why: 'Removing text once can create the text you tried to remove. "....//" becomes "../" again. Blocklists on paths keep losing.' },
      { id: 'contain', label: 'Resolve the path, then require it to stay inside docs/', code: "const full = path.resolve(DOCS, name)\nif (!full.startsWith(DOCS + path.sep)) return 403", correct: true, why: 'Checking the final resolved path works for every encoding and trick, because it tests where the file really is.' },
      { id: 'lower', label: 'Lowercase and trim the file name', code: 'name = name.trim().toLowerCase()', correct: false, why: 'Case and spaces are irrelevant to ".." segments, so the traversal still works.' }
    ],
    links: [
      ['PortSwigger: File path traversal', 'https://portswigger.net/web-security/file-path-traversal'],
      ['OWASP: Path Traversal', 'https://owasp.org/www-community/attacks/Path_Traversal']
    ]
  },
  ssrf: {
    story: 'PreviewLab fetches a link for you and shows a summary. It runs in a network with an internal admin console and a cloud metadata service. Nothing here makes a real request; the whole network is simulated. Level 2 blocks the words localhost and 127.0.0.1.',
    goal: 'Reach the cloud metadata service at Level 2 and read the role credentials.',
    hints: [
      'Preview the example link and read "resolvedHost" in the response.',
      'Try an internal address at Level 1. The internal console tells you where else to look.',
      'At Level 2 the filter checks the text you typed. The URL parser later rewrites numeric hosts, so the filter and the fetcher disagree.',
      '169.254.169.254 written as one number is 2852039166. Try http://2852039166/latest/meta-data/ and follow the listing down to the role.'
    ],
    patches: [
      { id: 'blocklist', label: 'Block the strings localhost and 127.0.0.1', code: "if (/localhost|127\\.0\\.0\\.1/.test(url)) return 403", correct: false, why: 'The same address has many spellings (2130706433, 0x7f000001, 127.1, [::1]). Blocklists on text always miss one.' },
      { id: 'allowlist', label: 'Allow only approved hosts, checked after parsing, and deny private ranges', code: 'const host = new URL(input).hostname\nif (!ALLOWED.has(host) || isPrivate(resolve(host))) return 403', correct: true, why: 'The check runs on the same value the fetcher will use, and only known destinations pass.' },
      { id: 'timeout', label: 'Add a 2 second timeout to the fetcher', code: 'fetch(url, { signal: AbortSignal.timeout(2000) })', correct: false, why: 'A timeout limits how long a request takes, not where it goes. The internal request still succeeds quickly.' }
    ],
    links: [
      ['PortSwigger: Server-side request forgery', 'https://portswigger.net/web-security/ssrf'],
      ['OWASP: SSRF Prevention Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html']
    ]
  },
  secrets: {
    story: 'ShipLab is a small shop that went live with its staging settings still on. Look around the way a visitor would and see what it tells you.',
    goal: 'Find the leaked environment file and read the recovery code.',
    hints: [
      'Request / and /status. Read the headers and the body of each response.',
      'robots.txt lists pages the owner would rather search engines skipped.',
      'A debug page that lists file names is a gift to an attacker. Which file does it name?',
      'Request /.env. To see how errors leak, also try /orders/abc.'
    ],
    patches: [
      { id: 'robots', label: 'Add /.env to the Disallow list in robots.txt', code: 'User-agent: *\nDisallow: /.env', correct: false, why: 'robots.txt is a public file that only asks polite crawlers to skip pages. Listing a secret path there advertises it.' },
      { id: 'harden', label: 'Do not deploy debug or env files, return generic errors, strip version headers, rotate leaked secrets', code: "app.disable('x-powered-by')\nif (prod) removeDebugRoutes()\nres.status(400).json({ error: 'Invalid request' })", correct: true, why: 'Removing the exposure and the clues shrinks what an attacker can learn. Rotating the exposed secrets matters because they may already be copied.' },
      { id: 'rename', label: 'Rename .env to .config', code: 'mv .env .config', correct: false, why: 'A renamed file is still a file the web server hands out. Files with secrets should not be in the web root at all.' }
    ],
    links: [
      ['OWASP Top 10: Security Misconfiguration', 'https://owasp.org/Top10/A05_2021-Security_Misconfiguration/'],
      ['PortSwigger: Information disclosure', 'https://portswigger.net/web-security/information-disclosure']
    ]
  }
});
