// Single source of truth for portfolio content. Edit this file to update the site.
export const PORTFOLIO = {
  identity: {
    name: 'Naven Tran',
    role: 'Cybersecurity-focused Computer Science student',
    summary: 'Vice President of IT-Zone Tech Club. I build Python security tools, hunt bugs on public bug bounty programs, take freelance work, and compete in CTFs.'
  },
  // Edit details/periods to match your real roles.
  experience: [
    { period: 'now', role: 'Vice President', org: 'IT-Zone Tech Club', detail: 'Help lead the club: planning activities, workshops and member projects.' },
    { period: 'now', role: 'Freelance Developer', org: 'Self-employed', detail: 'Build websites and tools for clients, with a security review as part of every delivery.' },
    { period: 'now', role: 'Bug Bounty Hunter', org: 'Public programs', detail: 'Test in-scope targets on public bug bounty programs and report findings through responsible disclosure.' }
  ],
  labs: {
    title: 'Security Learning Labs',
    summary: 'Eight deterministic web-security simulations (SQLi, XSS, SSRF, JWT and more) with serverless API checks. Safe by design: no real exploits, no outbound requests.',
    tags: ['JavaScript', 'Vercel Functions', 'Web security'],
    href: 'https://labs-naventran.vercel.app/'
  },
  github: 'https://github.com/Dragonsize',
  taglines: [
    'securing systems, one packet at a time',
    'building python security tools',
    'hunting bugs, disclosing responsibly',
    'shipping freelance builds, secured',
    'chasing flags in CTFs'
  ],
  signal: ['BUG BOUNTY', 'SECURITY RESEARCH', 'FREELANCE', 'NETWORK AUDITING', 'CTF PRACTICE', 'PYTHON TOOLS', 'IT-ZONE TECH CLUB'],
  stats: [
    { value: 'VP', label: 'IT-Zone Tech Club' },
    { value: '7.5', label: 'IELTS band, 2025' },
    { value: '3', label: 'security and systems projects' },
    { value: '8', label: 'interactive security labs' }
  ],
  projects: [
    { title: 'Network Audit Scanner', summary: 'Concurrent Python TCP scanner that checks discovered services against baseline audit expectations.', tags: ['Python', 'Networking', 'Auditing'] },
    { title: 'CTF Image Forensics Toolkit', summary: 'Bash toolkit that runs repeatable image triage steps and writes structured findings for authorized CTF challenges.', tags: ['Bash', 'CTF', 'Forensics'] },
    { title: 'Real-Time Messaging Platform', summary: 'Live chat built on Node.js, Express and WebSockets, with persistent storage in Supabase PostgreSQL.', tags: ['Node.js', 'WebSockets', 'PostgreSQL'] }
  ],
  competitions: [
    { name: "IT-Zone's Software Contest", result: 'First Prize', year: '2026' },
    { name: "IT-Zone's Software Contest", result: 'Best Individual', year: '2026' },
    { name: 'Trae Solo', result: '2nd Place', year: '2026' },
    { name: 'Municipal Academic Excellence Award', result: 'Third Prize', year: '2025' }
  ],
  certifications: [
    { name: 'IELTS', detail: 'Band 7.5', year: '2025' },
    { name: 'OPSWAT', detail: 'Introduction to Critical Infrastructure Protection', year: '2026' }
  ],
  education: { school: 'Ton Duc Thang University', detail: 'B.Sc. Computer Science, sophomore', period: '2025 – Present' },
  skills: [
    { title: 'Web security', items: ['SQL injection', 'XSS', 'Authentication testing', 'Legal labs and CTFs'] },
    { title: 'Network auditing', items: ['TCP service discovery', 'Baseline audit checks', 'Python tooling'] },
    { title: 'Development', items: ['Python', 'JavaScript', 'C / C++', 'HTML / CSS', 'Linux', 'Git', 'Postman'] },
    { title: 'Working style', items: ['Self-learning', 'Teamwork', 'Communication', 'Time management'] }
  ],
  contacts: [
    { label: 'GitHub', value: 'Dragonsize', href: 'https://github.com/Dragonsize' },
    { label: 'LinkedIn', value: 'navensol', href: 'https://www.linkedin.com/in/navensol/' },
    { label: 'Email', value: 'tranphate@gmail.com', href: 'mailto:tranphate@gmail.com' }
  ]
};
