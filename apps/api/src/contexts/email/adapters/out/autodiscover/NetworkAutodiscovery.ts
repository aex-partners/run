import net from 'node:net'
import { resolveMx } from 'node:dns/promises'
import {
  EmailAutodiscovery,
  DiscoveredMailSettings,
} from '@/contexts/email/application/ports/out/EmailAutodiscovery'

interface ServerConfig {
  host: string
  port: number
  secure: boolean
}

interface ProviderConfig {
  domains: string[]
  mxContains?: string[]
  smtp: ServerConfig
  imap: ServerConfig
}

// Well-known provider database, ported 1:1 from AEX email/autodiscover.ts.
const KNOWN_PROVIDERS: ProviderConfig[] = [
  {
    domains: ['gmail.com', 'googlemail.com'],
    mxContains: ['google.com', 'googlemail.com'],
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
  },
  {
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'msn.com'],
    mxContains: ['outlook.com', 'microsoft.com'],
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
  },
  {
    domains: ['yahoo.com', 'yahoo.com.br', 'ymail.com'],
    mxContains: ['yahoodns.net', 'yahoo.com'],
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
  },
  {
    domains: ['icloud.com', 'me.com', 'mac.com'],
    mxContains: ['icloud.com'],
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
  },
  {
    domains: ['zoho.com', 'zohomail.com'],
    mxContains: ['zoho.com'],
    smtp: { host: 'smtp.zoho.com', port: 465, secure: true },
    imap: { host: 'imap.zoho.com', port: 993, secure: true },
  },
  {
    domains: ['protonmail.com', 'proton.me', 'pm.me'],
    mxContains: ['protonmail.ch'],
    smtp: { host: 'smtp.protonmail.ch', port: 465, secure: true },
    imap: { host: 'imap.protonmail.ch', port: 993, secure: true },
  },
  {
    domains: ['uol.com.br', 'bol.com.br'],
    mxContains: ['uol.com.br'],
    smtp: { host: 'smtps.uol.com.br', port: 587, secure: false },
    imap: { host: 'imap.uol.com.br', port: 993, secure: true },
  },
  {
    domains: ['terra.com.br'],
    mxContains: ['terra.com.br'],
    smtp: { host: 'smtp.terra.com.br', port: 587, secure: false },
    imap: { host: 'imap.terra.com.br', port: 993, secure: true },
  },
]

const settingsFrom = (provider: ProviderConfig): DiscoveredMailSettings => ({
  smtpHost: provider.smtp.host,
  smtpPort: provider.smtp.port,
  smtpSecure: provider.smtp.secure,
  imapHost: provider.imap.host,
  imapPort: provider.imap.port,
  imapSecure: provider.imap.secure,
})

// Driven adapter for the EmailAutodiscovery port. Ports AEX's 4-step strategy:
// known providers -> Mozilla autoconfig -> MX records -> common host patterns
// with a TCP connection test. No domain logic, just network probing.
export class NetworkAutodiscovery implements EmailAutodiscovery {
  async discover(email: string): Promise<DiscoveredMailSettings | null> {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return null

    return (
      matchByDomain(domain) ??
      (await tryAutoconfig(domain)) ??
      (await matchByMx(domain)) ??
      (await tryCommonPatterns(domain))
    )
  }
}

function matchByDomain(domain: string): DiscoveredMailSettings | null {
  const provider = KNOWN_PROVIDERS.find((p) => p.domains.includes(domain))
  return provider ? settingsFrom(provider) : null
}

async function tryAutoconfig(domain: string): Promise<DiscoveredMailSettings | null> {
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=test@${domain}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ]

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) continue

      const xml = await res.text()
      const smtp = parseServerFromXml(xml, 'outgoingServer')
      const imap = parseServerFromXml(xml, 'incomingServer')
      if (smtp && imap) {
        return {
          smtpHost: smtp.host,
          smtpPort: smtp.port,
          smtpSecure: smtp.secure,
          imapHost: imap.host,
          imapPort: imap.port,
          imapSecure: imap.secure,
        }
      }
    } catch {
      // try next URL
    }
  }
  return null
}

function parseServerFromXml(xml: string, tag: 'incomingServer' | 'outgoingServer'): ServerConfig | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!match || !match[1]) return null

  const block = match[1]
  const host = block.match(/<hostname>([^<]+)<\/hostname>/i)?.[1]?.trim()
  const port = block.match(/<port>([^<]+)<\/port>/i)?.[1]?.trim()
  const ssl = block.match(/<socketType>([^<]+)<\/socketType>/i)?.[1]?.trim()
  if (!host || !port) return null

  return {
    host,
    port: parseInt(port, 10),
    secure: ssl?.toUpperCase() === 'SSL' || ssl?.toUpperCase() === 'TLS',
  }
}

async function matchByMx(domain: string): Promise<DiscoveredMailSettings | null> {
  try {
    const records = await resolveMx(domain)
    if (!records || records.length === 0) return null
    const exchanges = records.map((r) => r.exchange.toLowerCase())

    for (const provider of KNOWN_PROVIDERS) {
      if (!provider.mxContains) continue
      const match = exchanges.some((ex) => provider.mxContains!.some((mx) => ex.includes(mx)))
      if (match) return settingsFrom(provider)
    }
  } catch {
    // DNS resolution failed
  }
  return null
}

function testPort(host: string, port: number, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function tryCommonPatterns(domain: string): Promise<DiscoveredMailSettings | null> {
  const smtpCandidates: ServerConfig[] = [
    { host: `mail.${domain}`, port: 465, secure: true },
    { host: `mail.${domain}`, port: 587, secure: false },
    { host: `smtp.${domain}`, port: 465, secure: true },
    { host: `smtp.${domain}`, port: 587, secure: false },
    { host: domain, port: 465, secure: true },
    { host: domain, port: 587, secure: false },
  ]
  const imapCandidates: ServerConfig[] = [
    { host: `mail.${domain}`, port: 993, secure: true },
    { host: `imap.${domain}`, port: 993, secure: true },
    { host: `mail.${domain}`, port: 143, secure: false },
    { host: domain, port: 993, secure: true },
  ]

  let smtp: ServerConfig | null = null
  let imap: ServerConfig | null = null

  for (const candidate of smtpCandidates) {
    if (await testPort(candidate.host, candidate.port)) {
      smtp = candidate
      break
    }
  }
  for (const candidate of imapCandidates) {
    if (await testPort(candidate.host, candidate.port)) {
      imap = candidate
      break
    }
  }

  if (smtp && imap) {
    return {
      smtpHost: smtp.host,
      smtpPort: smtp.port,
      smtpSecure: smtp.secure,
      imapHost: imap.host,
      imapPort: imap.port,
      imapSecure: imap.secure,
    }
  }

  // Only SMTP found: fall back to a sensible IMAP default (AEX behaviour).
  if (smtp) {
    return {
      smtpHost: smtp.host,
      smtpPort: smtp.port,
      smtpSecure: smtp.secure,
      imapHost: smtp.host.replace('smtp.', 'imap.'),
      imapPort: 993,
      imapSecure: true,
    }
  }

  return null
}
