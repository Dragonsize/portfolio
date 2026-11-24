// Per-lab content for the request-driven labs: story, hints, patch options and reading links.
// Plain data so it is easy to edit. All strings are rendered with textContent.

export const INTERACTIVE = Object.freeze({
  sqli: {
    story: 'ShopLab sells security gear. Its search box builds a SQL query by pasting your text into it. One internal row is hidden from public results. Make the search return it, then read what it contains.',
    goal: 'Find the flag stored in the hidden internal row.',
    hints: [
      'Type a normal word like "key" first and read the query shown below the results.',
      'Add a single quote (\') and look at the error. It reveals how your text sits inside the query.',
      "The query ends with AND visibility = 'public'. You need the OR to change which rows match.",
      "Try closing the string and adding a condition that is always true: ' OR '1'='1"
    ],
    patches: [
      { id: 'strip', label: "Strip single quotes from the search text", code: "search = search.replace(/'/g, '')", correct: false, why: "A blocklist is bypassable and breaks real names like O'Brien. The query is still built by string concatenation." },
      { id: 'param', label: 'Use a parameterized query with a bound value', code: "db.query(\n  \"SELECT id, name, price FROM products WHERE name LIKE ? AND visibility = 'public'\",\n  ['%' + search + '%']\n)", correct: true, why: 'The database receives code and data separately, so input can never change the query structure.' },
      { id: 'hide', label: 'Hide the SQL error message from users', code: "catch (e) { return res.status(500).json({ error: 'Something went wrong' }) }", correct: false, why: 'Hiding errors removes a clue, not the bug. Attackers can still inject and read results (blind or union-based).' }
    ],
    links: [
      ['OWASP: SQL Injection', 'https://owasp.org/www-community/attacks/SQL_Injection'],
      ['OWASP: Query Parameterization Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Query_Parameterization_Cheat_Sheet.html']
    ]
  },
  jwt: {
    story: 'AdminLab issues a session token when you visit. Its server trusts whatever the token says about itself. Become an admin and open the admin panel.',
    goal: 'Get the admin panel to open and read the internal note.',
    hints: [
      'Decode the token with the editor below. The payload contains a "role" claim.',
      'Changing the role breaks the signature. What does the header\'s "alg" field tell the server to do?',
      'Set alg to "none". A token with no signature has an empty third segment.',
      'Set role to "admin", alg to "none", and send the token with the signature left empty.'
    ],
    patches: [
      { id: 'decode', label: 'Decode the token and trust the alg in its header', code: 'const claims = decode(token)\nif (claims.role === "admin") grant()', correct: false, why: 'Decoding is not verifying. Anyone can write any claims into a token they craft themselves.' },
      { id: 'verify', label: 'Verify with a fixed algorithm allowlist and a server-held secret', code: 'jwt.verify(token, SERVER_SECRET, { algorithms: ["HS256"] })', correct: true, why: 'The server decides the algorithm and checks the signature, so a forged token or alg "none" is rejected.' },
      { id: 'double', label: 'Base64-encode the role claim twice', code: 'payload.role = btoa(btoa("admin"))', correct: false, why: 'Encoding is not protection. Anyone can decode it, and the signature is still never checked.' }
    ],
    links: [
      ['PortSwigger: JWT attacks', 'https://portswigger.net/web-security/jwt'],
      ['OWASP: JSON Web Token Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html']
    ]
  },
  xss: {
    story: 'NoteLab shows what you searched for on the results page. Level 1 has no protection. Level 2 adds a filter that removes script tags. Get a payload to run in the simulated browser on both levels.',
    goal: 'Trigger the simulated alert at level 2 and read what it leaks.',
    hints: [
      'At level 1, any script-capable HTML in the search text is reflected unchanged.',
      'At level 2 the filter removes script tags. Is a script tag the only way to run code?',
      'HTML elements can run code from event attributes such as onerror or onload.',
      'Try an image that fails to load and runs a handler: <img src=x onerror=alert(1)>'
    ],
    patches: [
      { id: 'blocklist', label: 'Also remove onerror and onload attributes', code: "input = input.replace(/on(error|load)=/gi, '')", correct: false, why: 'Blocklists miss variants (onfocus, onmouseover, svg handlers). Defence has to be at the output, not a growing list.' },
      { id: 'encode', label: 'Encode output for its context and render with textContent', code: 'results.textContent = "No results for " + search', correct: true, why: 'The browser treats the value as text, never as markup, no matter what characters it contains.' },
      { id: 'lower', label: 'Lowercase the search text before showing it', code: 'search = search.toLowerCase()', correct: false, why: 'Case does not matter to HTML. <IMG SRC=X ONERROR=...> and the lowercase form behave identically.' }
    ],
    links: [
      ['OWASP: Cross Site Scripting Prevention Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'],
      ['PortSwigger: Cross-site scripting', 'https://portswigger.net/web-security/cross-site-scripting']
    ]
  }
});

export const BURP_STEPS = Object.freeze([
  'Optional. Everything works in the built-in Repeater below, but you can use your own tools too.',
  'Set your browser to use the Burp proxy (127.0.0.1:8080) and turn Intercept on.',
  'Use the lab in the page. Requests to this lab\'s /api/ endpoint appear in Proxy > HTTP history.',
  'Send one to Repeater, edit the query, header or body, and send it again.',
  'The JWT lab also reads the token from an Authorization: Bearer header or a session cookie.',
  'Only this lab\'s own endpoint is in scope. Do not run scanners (nmap, sqlmap, wpscan); they find nothing here and are rate limited.'
]);
