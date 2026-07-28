import { useState, useEffect, useRef } from 'react'

// ─── Data ────────────────────────────────────────────────────────────────────

const SKILLS = [
  { category: 'Offensive Security', items: [
    { name: 'Penetration Testing', level: 92 },
    { name: 'Exploit Development', level: 78 },
    { name: 'Web App Security (OWASP)', level: 95 },
    { name: 'Reverse Engineering', level: 71 },
    { name: 'Social Engineering', level: 84 },
  ]},
  { category: 'Defensive Security', items: [
    { name: 'Incident Response', level: 88 },
    { name: 'Threat Hunting', level: 82 },
    { name: 'SIEM / Log Analysis', level: 90 },
    { name: 'Network Forensics', level: 76 },
    { name: 'Malware Analysis', level: 69 },
  ]},
  { category: 'Infrastructure & Cloud', items: [
    { name: 'Linux Hardening', level: 94 },
    { name: 'AWS Security', level: 80 },
    { name: 'Docker / Kubernetes', level: 75 },
    { name: 'Firewall & IDS/IPS', level: 87 },
    { name: 'Zero Trust Architecture', level: 73 },
  ]},
]

const PROJECTS = [
  {
    id: 'p1',
    name: 'CVE-2024-GHOST',
    status: 'DISCLOSED',
    statusColor: '#00ff41',
    tags: ['kernel', 'privilege-escalation', 'linux'],
    desc: 'Discovered a local privilege escalation vulnerability in Linux kernel v6.1–6.6 via a race condition in the io_uring subsystem. Achieved full root from an unprivileged user in under 2 seconds on affected systems.',
    year: '2024',
    impact: 'CVSSv3: 8.8 HIGH',
  },
  {
    id: 'p2',
    name: 'REDTEAM-FRAMEWORK',
    status: 'ACTIVE',
    statusColor: '#00ff41',
    tags: ['python', 'C2', 'evasion', 'open-source'],
    desc: 'Custom command-and-control framework with encrypted comms, process injection, and living-off-the-land techniques. Modular agent architecture with support for 12 post-exploitation modules.',
    year: '2023',
    impact: '1.4k GitHub stars',
  },
  {
    id: 'p3',
    name: 'PHISHCHAIN',
    status: 'DEPRECATED',
    statusColor: '#888888',
    tags: ['phishing', 'automation', 'OSINT'],
    desc: 'Automated spear-phishing campaign orchestration platform built for authorized red team engagements. Integrates OSINT gathering, lure generation, and campaign analytics.',
    year: '2022',
    impact: '94% simulated click rate',
  },
  {
    id: 'p4',
    name: 'HONEYPOT-MESH',
    status: 'ACTIVE',
    statusColor: '#00ff41',
    tags: ['deception', 'threat-intel', 'python'],
    desc: 'Distributed honeypot network spanning 47 nodes across 12 regions. Captures 2M+ attack attempts daily, feeding a proprietary threat intelligence database with real-time IOCs.',
    year: '2024',
    impact: '2M+ daily events',
  },
]

const CTF_WINS = [
  { comp: 'DEF CON 32 CTF', placement: '#3', category: 'Finals', year: '2024', points: '4,820' },
  { comp: 'pwn2own Vancouver', placement: '#1', category: 'Browser', year: '2024', points: '$200,000' },
  { comp: 'HackTheBox Pro Labs', placement: 'Omniscient', category: 'Endgame', year: '2023', points: '100/100' },
  { comp: 'picoCTF', placement: '#7', category: 'Open Division', year: '2023', points: '19,650' },
  { comp: 'Google CTF', placement: '#12', category: 'Global', year: '2023', points: '3,100' },
  { comp: 'NahamCon CTF', placement: '#2', category: 'Global', year: '2022', points: '11,420' },
]

const CERTS = [
  { name: 'OSCP', full: 'Offensive Security Certified Professional', issuer: 'OffSec', year: '2022', color: '#00ff41' },
  { name: 'OSED', full: 'Offensive Security Exploit Developer', issuer: 'OffSec', year: '2023', color: '#00ff41' },
  { name: 'CRTE', full: 'Certified Red Team Expert', issuer: 'Altered Security', year: '2023', color: '#ff6b35' },
  { name: 'PNPT', full: 'Practical Network Penetration Tester', issuer: 'TCM Security', year: '2022', color: '#4fc3f7' },
  { name: 'CISSP', full: 'Certified Information Systems Security Professional', issuer: 'ISC²', year: '2023', color: '#888888' },
  { name: 'CEH', full: 'Certified Ethical Hacker', issuer: 'EC-Council', year: '2021', color: '#888888' },
]

const TIMELINE = [
  { year: '2024', role: 'Senior Red Team Operator', org: 'NovaSec Labs', desc: 'Lead adversary simulation engagements for Fortune 100 clients. Manage a team of 6 red teamers.' },
  { year: '2022', role: 'Penetration Tester II', org: 'CipherStrike Inc.', desc: 'Conducted 40+ external/internal pentests, web app assessments, and phishing campaigns.' },
  { year: '2020', role: 'SOC Analyst → Pentester', org: 'DataVault Financial', desc: 'Started in blue team, pivoted to offensive after discovering two internal vulnerabilities.' },
  { year: '2018', role: 'Security Intern', org: 'GovCERT', desc: 'Assisted in network monitoring, vulnerability scanning, and incident triage.' },
]

// ─── Components ──────────────────────────────────────────────────────────────

function Prompt({ user = 'ghost', host = 'portfolio', path = '~' }: { user?: string; host?: string; path?: string }) {
  return (
    <span className="select-none">
      <span style={{ color: '#00ff41' }}>{user}@{host}</span>
      <span style={{ color: '#888' }}>:</span>
      <span style={{ color: '#4fc3f7' }}>{path}</span>
      <span style={{ color: '#888' }}>$</span>
    </span>
  )
}

function TerminalWindow({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border glow-green-box ${className}`} style={{ borderColor: '#1e1e1e', backgroundColor: '#0a0a0a' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: '#1e1e1e', backgroundColor: '#0d0d0d' }}>
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#ff5f57' }} />
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#febc2e' }} />
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#28c840' }} />
        <span className="ml-4 text-xs" style={{ color: '#555', letterSpacing: '0.1em' }}>{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function SkillBar({ name, level, delay = 0 }: { name: string; level: number; delay?: number }) {
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimated(true) },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const blocks = Math.round(level / 5)
  const totalBlocks = 20

  return (
    <div ref={ref} className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs" style={{ color: '#888' }}>{name}</span>
        <span className="text-xs" style={{ color: '#00ff41' }}>{level}%</span>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: totalBlocks }).map((_, i) => (
          <div
            key={i}
            className="h-2 flex-1 transition-all"
            style={{
              backgroundColor: animated && i < blocks ? '#00ff41' : '#1a1a1a',
              transitionDelay: animated ? `${delay + i * 30}ms` : '0ms',
              transitionDuration: '200ms',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function NavBar({ activeSection, onNav }: { activeSection: string; onNav: (s: string) => void }) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const links = ['about', 'skills', 'projects', 'ctf', 'certs', 'contact']

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b"
      style={{ backgroundColor: 'rgba(8,8,8,0.95)', borderColor: '#1e1e1e', backdropFilter: 'blur(4px)' }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: '#00ff41' }} className="text-sm font-bold glow-green">▶_GHOST</span>
        <span style={{ color: '#333' }} className="text-xs hidden sm:block">// red team operator</span>
      </div>

      <div className="flex items-center gap-1">
        {links.map(link => (
          <button
            key={link}
            onClick={() => onNav(link)}
            className="px-3 py-1 text-xs transition-all"
            style={{
              color: activeSection === link ? '#00ff41' : '#555',
              backgroundColor: activeSection === link ? 'rgba(0,255,65,0.08)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {link}
          </button>
        ))}
      </div>

      <div className="text-xs" style={{ color: '#333' }}>
        {time} UTC
      </div>
    </nav>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function HeroSection() {
  const [line, setLine] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  const lines = [
    { prompt: true, text: 'whoami' },
    { prompt: false, text: 'Alex "Ghost" Mercer' },
    { prompt: true, text: 'cat role.txt' },
    { prompt: false, text: 'Senior Red Team Operator | CVE Researcher | CTF Player' },
    { prompt: true, text: 'cat status.txt' },
    { prompt: false, text: '[ONLINE] — Available for engagements & speaking' },
    { prompt: true, text: '' },
  ]

  useEffect(() => {
    if (line < lines.length - 1) {
      const t = setTimeout(() => setLine(l => l + 1), line === 0 ? 800 : 600)
      return () => clearTimeout(t)
    }
  }, [line])

  return (
    <section id="about" className="min-h-screen flex items-center justify-center px-6 pt-20">
      <div className="max-w-4xl w-full">
        {/* ASCII art header */}
        <div className="mb-8 overflow-x-auto">
          <pre className="text-xs leading-tight select-none" style={{ color: '#00ff41', opacity: 0.6 }}>
{`  ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗
 ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
 ██║  ███╗███████║██║   ██║███████╗   ██║
 ██║   ██║██╔══██║██║   ██║╚════██║   ██║
 ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║
  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝  `}
          </pre>
        </div>

        <TerminalWindow title="ghost@portfolio: ~/intro">
          <div className="space-y-1 text-sm leading-relaxed">
            {lines.slice(0, line + 1).map((l, i) => (
              <div key={i} className="flex gap-3">
                {l.prompt ? (
                  <>
                    <Prompt />
                    <span style={{ color: '#d4d4d4' }}>{l.text}</span>
                  </>
                ) : (
                  <span style={{ color: '#00ff41' }} className="pl-2">{l.text}</span>
                )}
              </div>
            ))}
            {line === lines.length - 1 && (
              <div className="flex gap-3">
                <Prompt />
                <span className="cursor-blink" style={{ color: '#00ff41' }}>█</span>
              </div>
            )}
          </div>
        </TerminalWindow>

        {/* Stats bar */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-px" style={{ backgroundColor: '#1e1e1e' }}>
          {[
            { label: 'CVEs Found', value: '11' },
            { label: 'CTF Wins', value: '47+' },
            { label: 'Pentests', value: '120+' },
            { label: 'Bug Bounties', value: '$340k' },
          ].map(stat => (
            <div key={stat.label} className="flex flex-col items-center py-4" style={{ backgroundColor: '#0a0a0a' }}>
              <span className="text-2xl font-bold glow-green" style={{ color: '#00ff41' }}>{stat.value}</span>
              <span className="text-xs mt-1" style={{ color: '#555' }}>{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-4 flex-wrap">
          <a
            href="#contact"
            className="px-6 py-2 text-sm font-bold transition-all"
            style={{ backgroundColor: '#00ff41', color: '#000', textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#00cc33')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#00ff41')}
          >
            &gt; HIRE ME
          </a>
          <a
            href="#projects"
            className="px-6 py-2 text-sm transition-all border"
            style={{ borderColor: '#333', color: '#888', textDecoration: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#00ff41'; e.currentTarget.style.color = '#00ff41' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888' }}
          >
            &gt; VIEW WORK
          </a>
        </div>
      </div>
    </section>
  )
}

function SkillsSection() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section id="skills" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            <Prompt path="~/skills" />
            <span className="text-sm" style={{ color: '#d4d4d4' }}>ls -la</span>
          </div>
          <h2 className="text-2xl font-bold mt-4" style={{ color: '#d4d4d4' }}>
            <span style={{ color: '#00ff41' }}>//</span> TECHNICAL SKILLS
          </h2>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 mb-6 border-b" style={{ borderColor: '#1e1e1e' }}>
          {SKILLS.map((cat, i) => (
            <button
              key={cat.category}
              onClick={() => setActiveTab(i)}
              className="px-4 py-2 text-xs border-b-2 transition-all"
              style={{
                borderBottomColor: activeTab === i ? '#00ff41' : 'transparent',
                color: activeTab === i ? '#00ff41' : '#555',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === i ? '#00ff41' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {cat.category}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            {SKILLS[activeTab].items.map((skill, i) => (
              <SkillBar key={skill.name} name={skill.name} level={skill.level} delay={i * 100} />
            ))}
          </div>
          <TerminalWindow title="skill_analysis.sh" className="h-fit">
            <div className="text-xs space-y-2" style={{ color: '#555' }}>
              <div><span style={{ color: '#00ff41' }}>$</span> analyzing {SKILLS[activeTab].category.toLowerCase()}...</div>
              <div style={{ color: '#333' }}>──────────────────────────</div>
              {SKILLS[activeTab].items.map(s => (
                <div key={s.name}>
                  <span style={{ color: '#4fc3f7' }}>[{s.level >= 85 ? 'EXPERT' : s.level >= 70 ? 'PROFICIENT' : 'LEARNING'}]</span>
                  {' '}<span style={{ color: '#888' }}>{s.name}</span>
                </div>
              ))}
              <div style={{ color: '#333' }}>──────────────────────────</div>
              <div>
                <span style={{ color: '#00ff41' }}>avg proficiency: </span>
                <span style={{ color: '#ff6b35' }}>
                  {Math.round(SKILLS[activeTab].items.reduce((a, s) => a + s.level, 0) / SKILLS[activeTab].items.length)}%
                </span>
              </div>
            </div>
          </TerminalWindow>
        </div>
      </div>
    </section>
  )
}

function ProjectsSection() {
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <section id="projects" className="py-24 px-6" style={{ backgroundColor: '#060606' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            <Prompt path="~/projects" />
            <span className="text-sm" style={{ color: '#d4d4d4' }}>find . -type f -name "*.md"</span>
          </div>
          <h2 className="text-2xl font-bold mt-4" style={{ color: '#d4d4d4' }}>
            <span style={{ color: '#00ff41' }}>//</span> PROJECTS & RESEARCH
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-px" style={{ backgroundColor: '#1e1e1e' }}>
          {PROJECTS.map(p => (
            <div
              key={p.id}
              className="p-5 cursor-pointer transition-all"
              style={{ backgroundColor: expanded === p.id ? '#0f0f0f' : '#0a0a0a' }}
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm font-bold" style={{ color: '#d4d4d4' }}>{p.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#555' }}>{p.year}</div>
                </div>
                <span className="text-xs px-2 py-0.5 font-bold" style={{ color: p.statusColor, border: `1px solid ${p.statusColor}22` }}>
                  {p.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                {p.tags.map(t => (
                  <span key={t} className="text-xs px-2 py-0.5" style={{ color: '#555', backgroundColor: '#111' }}>
                    #{t}
                  </span>
                ))}
              </div>

              {expanded === p.id && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1a1a1a' }}>
                  <p className="text-xs leading-relaxed" style={{ color: '#888' }}>{p.desc}</p>
                  <div className="mt-3 text-xs" style={{ color: '#ff6b35' }}>
                    ↳ {p.impact}
                  </div>
                </div>
              )}

              <div className="text-xs mt-2" style={{ color: '#333' }}>
                {expanded === p.id ? '▲ collapse' : '▼ expand'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTFSection() {
  return (
    <section id="ctf" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            <Prompt path="~/ctf" />
            <span className="text-sm" style={{ color: '#d4d4d4' }}>cat leaderboard.json | jq .</span>
          </div>
          <h2 className="text-2xl font-bold mt-4" style={{ color: '#d4d4d4' }}>
            <span style={{ color: '#00ff41' }}>//</span> CTF & COMPETITIONS
          </h2>
        </div>

        <TerminalWindow title="ctf_results.log">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: '#1e1e1e' }}>
                  {['COMPETITION', 'PLACEMENT', 'CATEGORY', 'YEAR', 'REWARD'].map(h => (
                    <th key={h} className="text-left py-2 pr-6" style={{ color: '#555', fontWeight: 'normal' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CTF_WINS.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b transition-colors"
                    style={{ borderColor: '#0f0f0f' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d0d0d')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="py-2.5 pr-6" style={{ color: '#d4d4d4' }}>{row.comp}</td>
                    <td className="py-2.5 pr-6 font-bold" style={{ color: row.placement === '#1' ? '#00ff41' : row.placement === '#2' || row.placement === '#3' ? '#ff6b35' : '#888' }}>
                      {row.placement}
                    </td>
                    <td className="py-2.5 pr-6" style={{ color: '#555' }}>{row.category}</td>
                    <td className="py-2.5 pr-6" style={{ color: '#555' }}>{row.year}</td>
                    <td className="py-2.5" style={{ color: '#4fc3f7' }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TerminalWindow>

        {/* HTB rank card */}
        <div className="mt-6 grid grid-cols-3 gap-px" style={{ backgroundColor: '#1e1e1e' }}>
          {[
            { label: 'HackTheBox Rank', value: 'Pro Hacker', color: '#ff6b35' },
            { label: 'TryHackMe Rank', value: 'King', color: '#00ff41' },
            { label: 'CTFtime Rating', value: '2,841', color: '#4fc3f7' },
          ].map(stat => (
            <div key={stat.label} className="py-4 px-5" style={{ backgroundColor: '#0a0a0a' }}>
              <div className="text-xs mb-1" style={{ color: '#555' }}>{stat.label}</div>
              <div className="text-lg font-bold" style={{ color: stat.color }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CertsSection() {
  return (
    <section id="certs" className="py-24 px-6" style={{ backgroundColor: '#060606' }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            <Prompt path="~/certs" />
            <span className="text-sm" style={{ color: '#d4d4d4' }}>ls -la ./certifications/</span>
          </div>
          <h2 className="text-2xl font-bold mt-4" style={{ color: '#d4d4d4' }}>
            <span style={{ color: '#00ff41' }}>//</span> CERTIFICATIONS
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-px" style={{ backgroundColor: '#1e1e1e' }}>
          {CERTS.map(cert => (
            <div
              key={cert.name}
              className="p-5 transition-all group"
              style={{ backgroundColor: '#0a0a0a' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0d0d0d')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#0a0a0a')}
            >
              <div className="text-xl font-bold mb-1" style={{ color: cert.color }}>{cert.name}</div>
              <div className="text-xs leading-snug mb-3" style={{ color: '#555' }}>{cert.full}</div>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: '#333' }}>{cert.issuer}</span>
                <span className="text-xs" style={{ color: '#444' }}>{cert.year}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="mt-16">
          <h3 className="text-sm font-bold mb-6" style={{ color: '#555' }}>// EXPERIENCE TIMELINE</h3>
          <div className="space-y-0">
            {TIMELINE.map((item, i) => (
              <div key={i} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-px flex-1" style={{ backgroundColor: '#1e1e1e' }} />
                  <div className="w-2 h-2 my-1 flex-shrink-0" style={{ backgroundColor: '#00ff41' }} />
                  <div className="w-px flex-1" style={{ backgroundColor: '#1e1e1e' }} />
                </div>
                <div className="pb-8 flex-1">
                  <div className="flex items-baseline gap-4 mb-1">
                    <span className="text-sm font-bold" style={{ color: '#00ff41' }}>{item.year}</span>
                    <span className="text-sm font-bold" style={{ color: '#d4d4d4' }}>{item.role}</span>
                    <span className="text-xs" style={{ color: '#555' }}>@ {item.org}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: '#555' }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactSection() {
  const [fields, setFields] = useState({ name: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [focused, setFocused] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <section id="contact" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            <Prompt path="~/contact" />
            <span className="text-sm" style={{ color: '#d4d4d4' }}>./send_message.sh</span>
          </div>
          <h2 className="text-2xl font-bold mt-4" style={{ color: '#d4d4d4' }}>
            <span style={{ color: '#00ff41' }}>//</span> CONTACT
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <TerminalWindow title="contact_form.sh">
            {submitted ? (
              <div className="space-y-2 text-sm">
                <div><Prompt /><span style={{ color: '#d4d4d4' }}> ./send_message.sh</span></div>
                <div style={{ color: '#00ff41' }}>
                  [OK] Message transmitted successfully.<br />
                  [OK] PGP-signed and encrypted.<br />
                  [OK] ETA: 24–48h response window.
                </div>
                <div className="flex gap-2 mt-4">
                  <Prompt />
                  <span className="cursor-blink" style={{ color: '#00ff41' }}>█</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {[
                  { key: 'name', label: 'your_name', type: 'text', placeholder: 'John Doe' },
                  { key: 'email', label: 'email_addr', type: 'email', placeholder: 'you@domain.com' },
                  { key: 'subject', label: 'subject', type: 'text', placeholder: 'Engagement inquiry' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs mb-1" style={{ color: '#555' }}>
                      <span style={{ color: '#00ff41' }}>$</span> {f.label}:
                    </label>
                    <input
                      type={f.type}
                      value={fields[f.key as keyof typeof fields]}
                      onChange={e => setFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      onFocus={() => setFocused(f.key)}
                      onBlur={() => setFocused('')}
                      placeholder={f.placeholder}
                      className="w-full text-sm px-3 py-2 outline-none transition-all"
                      style={{
                        backgroundColor: '#111',
                        color: '#d4d4d4',
                        border: `1px solid ${focused === f.key ? '#00ff41' : '#1e1e1e'}`,
                        fontFamily: 'JetBrains Mono, monospace',
                      }}
                      required
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#555' }}>
                    <span style={{ color: '#00ff41' }}>$</span> message:
                  </label>
                  <textarea
                    value={fields.message}
                    onChange={e => setFields(prev => ({ ...prev, message: e.target.value }))}
                    onFocus={() => setFocused('message')}
                    onBlur={() => setFocused('')}
                    placeholder="Describe your engagement..."
                    rows={4}
                    className="w-full text-sm px-3 py-2 outline-none transition-all resize-none"
                    style={{
                      backgroundColor: '#111',
                      color: '#d4d4d4',
                      border: `1px solid ${focused === 'message' ? '#00ff41' : '#1e1e1e'}`,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 text-sm font-bold transition-all"
                  style={{ backgroundColor: '#00ff41', color: '#000' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#00cc33')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#00ff41')}
                >
                  &gt; TRANSMIT MESSAGE
                </button>
              </form>
            )}
          </TerminalWindow>

          <div className="space-y-4">
            <TerminalWindow title="pgp_key.asc">
              <div className="text-xs space-y-1" style={{ color: '#555' }}>
                <div style={{ color: '#00ff41' }}>-----BEGIN PGP PUBLIC KEY-----</div>
                <div>Key ID: <span style={{ color: '#4fc3f7' }}>0xDEAD1337CAFE</span></div>
                <div>Fingerprint: <span style={{ color: '#d4d4d4' }}>A3F2 91BC DE4A 0011 BEEF</span></div>
                <div>Algorithm: <span style={{ color: '#d4d4d4' }}>RSA 4096-bit</span></div>
                <div style={{ color: '#00ff41' }}>-----END PGP PUBLIC KEY-----</div>
              </div>
            </TerminalWindow>

            <div className="space-y-2">
              {[
                { label: 'Email', value: 'ghost@redteam.io', icon: '✉' },
                { label: 'Keybase', value: '/ghost_redteam', icon: '🔑' },
                { label: 'GitHub', value: 'github.com/ghost-sec', icon: '⌥' },
                { label: 'HackTheBox', value: 'Ghost#4821', icon: '⚡' },
                { label: 'LinkedIn', value: '/in/alex-ghost-mercer', icon: '◈' },
              ].map(item => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 px-4 py-2.5 border transition-all cursor-pointer"
                  style={{ borderColor: '#1a1a1a', backgroundColor: '#0a0a0a' }}
                  onMouseEnter={e => { (e.currentTarget.style.borderColor = '#00ff41'); (e.currentTarget.style.backgroundColor = '#0d0d0d') }}
                  onMouseLeave={e => { (e.currentTarget.style.borderColor = '#1a1a1a'); (e.currentTarget.style.backgroundColor = '#0a0a0a') }}
                >
                  <span style={{ color: '#333' }}>{item.icon}</span>
                  <span className="text-xs" style={{ color: '#555', width: '70px' }}>{item.label}</span>
                  <span className="text-xs" style={{ color: '#888' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t py-6 px-6" style={{ borderColor: '#1a1a1a' }}>
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs" style={{ color: '#333' }}>
        <div>
          <span style={{ color: '#00ff41' }}>ghost@redteam</span>:~$ echo "All opinions are my own. Use responsibly."
        </div>
        <div className="flex gap-6">
          <span>PGP: 0xDEAD1337CAFE</span>
          <span>© 2024 Alex Mercer</span>
        </div>
      </div>
    </footer>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeSection, setActiveSection] = useState('about')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { threshold: 0.3 }
    )
    const sections = document.querySelectorAll('section[id]')
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const onNav = (section: string) => {
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div style={{ backgroundColor: '#080808', minHeight: '100vh' }}>
      <NavBar activeSection={activeSection} onNav={onNav} />
      <HeroSection />
      <SkillsSection />
      <ProjectsSection />
      <CTFSection />
      <CertsSection />
      <ContactSection />
      <Footer />
    </div>
  )
}
