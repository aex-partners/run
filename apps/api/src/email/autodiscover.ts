/**
 * Email server auto-discovery.
 *
 * Strategy:
 * 1. Match domain against well-known providers (Gmail, Outlook, Yahoo, etc.)
 * 2. Try Mozilla autoconfig XML (autoconfig.{domain}/mail/config-v1.1.xml)
 * 3. Resolve MX records and match against known providers
 * 4. Try common host patterns (mail.domain, imap.domain, smtp.domain)
 * 5. Connection-test the candidates
 */

import { resolve } from "dns";
import { promisify } from "util";
import net from "net";

const resolveMx = promisify(resolve) as unknown as (domain: string) => Promise<{ exchange: string; priority: number }[]>;

export interface DiscoveredSettings {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
}

export type DiscoverStep =
  | "checking_known_providers"
  | "checking_autoconfig"
  | "checking_mx_records"
  | "trying_common_patterns"
  | "testing_connection"
  | "done"
  | "failed";

export interface DiscoverProgress {
  step: DiscoverStep;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Well-known provider database
// ---------------------------------------------------------------------------

interface ProviderConfig {
  domains: string[];
  mxContains?: string[];
  smtp: { host: string; port: number; secure: boolean };
  imap: { host: string; port: number; secure: boolean };
}

const KNOWN_PROVIDERS: ProviderConfig[] = [
  {
    domains: ["gmail.com", "googlemail.com"],
    mxContains: ["google.com", "googlemail.com"],
    smtp: { host: "smtp.gmail.com", port: 465, secure: true },
    imap: { host: "imap.gmail.com", port: 993, secure: true },
  },
  {
    domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    mxContains: ["outlook.com", "microsoft.com"],
    smtp: { host: "smtp-mail.outlook.com", port: 587, secure: false },
    imap: { host: "outlook.office365.com", port: 993, secure: true },
  },
  {
    domains: ["yahoo.com", "yahoo.com.br", "ymail.com"],
    mxContains: ["yahoodns.net", "yahoo.com"],
    smtp: { host: "smtp.mail.yahoo.com", port: 465, secure: true },
    imap: { host: "imap.mail.yahoo.com", port: 993, secure: true },
  },
  {
    domains: ["icloud.com", "me.com", "mac.com"],
    mxContains: ["icloud.com"],
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
    imap: { host: "imap.mail.me.com", port: 993, secure: true },
  },
  {
    domains: ["zoho.com", "zohomail.com"],
    mxContains: ["zoho.com"],
    smtp: { host: "smtp.zoho.com", port: 465, secure: true },
    imap: { host: "imap.zoho.com", port: 993, secure: true },
  },
  {
    domains: ["protonmail.com", "proton.me", "pm.me"],
    mxContains: ["protonmail.ch"],
    smtp: { host: "smtp.protonmail.ch", port: 465, secure: true },
    imap: { host: "imap.protonmail.ch", port: 993, secure: true },
  },
  {
    domains: ["uol.com.br", "bol.com.br"],
    mxContains: ["uol.com.br"],
    smtp: { host: "smtps.uol.com.br", port: 587, secure: false },
    imap: { host: "imap.uol.com.br", port: 993, secure: true },
  },
  {
    domains: ["terra.com.br"],
    mxContains: ["terra.com.br"],
    smtp: { host: "smtp.terra.com.br", port: 587, secure: false },
    imap: { host: "imap.terra.com.br", port: 993, secure: true },
  },
];

// ---------------------------------------------------------------------------
// 1. Match by domain
// ---------------------------------------------------------------------------

function matchByDomain(domain: string): DiscoveredSettings | null {
  const provider = KNOWN_PROVIDERS.find((p) => p.domains.includes(domain));
  if (!provider) return null;
  return {
    smtpHost: provider.smtp.host,
    smtpPort: provider.smtp.port,
    smtpSecure: provider.smtp.secure,
    imapHost: provider.imap.host,
    imapPort: provider.imap.port,
    imapSecure: provider.imap.secure,
  };
}

// ---------------------------------------------------------------------------
// 2. Mozilla autoconfig
// ---------------------------------------------------------------------------

async function tryAutoconfig(domain: string): Promise<DiscoveredSettings | null> {
  const urls = [
    `https://autoconfig.${domain}/mail/config-v1.1.xml?emailaddress=test@${domain}`,
    `https://${domain}/.well-known/autoconfig/mail/config-v1.1.xml`,
    `https://autoconfig.thunderbird.net/v1.1/${domain}`,
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const xml = await res.text();

      const smtp = parseServerFromXml(xml, "outgoingServer");
      const imap = parseServerFromXml(xml, "incomingServer");

      if (smtp && imap) {
        return {
          smtpHost: smtp.host,
          smtpPort: smtp.port,
          smtpSecure: smtp.secure,
          imapHost: imap.host,
          imapPort: imap.port,
          imapSecure: imap.secure,
        };
      }
    } catch {
      // try next URL
    }
  }
  return null;
}

function parseServerFromXml(
  xml: string,
  tag: "incomingServer" | "outgoingServer",
): { host: string; port: number; secure: boolean } | null {
  // Simple regex parsing for autoconfig XML
  const serverRegex = new RegExp(
    `<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
    "i",
  );
  const match = xml.match(serverRegex);
  if (!match) return null;

  const block = match[1];
  const host = block.match(/<hostname>([^<]+)<\/hostname>/i)?.[1]?.trim();
  const port = block.match(/<port>([^<]+)<\/port>/i)?.[1]?.trim();
  const ssl = block.match(/<socketType>([^<]+)<\/socketType>/i)?.[1]?.trim();

  if (!host || !port) return null;

  return {
    host,
    port: parseInt(port, 10),
    secure: ssl?.toUpperCase() === "SSL" || ssl?.toUpperCase() === "TLS",
  };
}

// ---------------------------------------------------------------------------
// 3. MX records
// ---------------------------------------------------------------------------

async function matchByMx(domain: string): Promise<DiscoveredSettings | null> {
  try {
    const { resolveMx: dnsResolveMx } = await import("dns/promises");
    const records = await dnsResolveMx(domain);
    if (!records || records.length === 0) return null;

    const exchanges = records.map((r) => r.exchange.toLowerCase());

    for (const provider of KNOWN_PROVIDERS) {
      if (!provider.mxContains) continue;
      const match = exchanges.some((ex) =>
        provider.mxContains!.some((mx) => ex.includes(mx)),
      );
      if (match) {
        return {
          smtpHost: provider.smtp.host,
          smtpPort: provider.smtp.port,
          smtpSecure: provider.smtp.secure,
          imapHost: provider.imap.host,
          imapPort: provider.imap.port,
          imapSecure: provider.imap.secure,
        };
      }
    }
  } catch {
    // DNS resolution failed
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4. Common patterns with connection test
// ---------------------------------------------------------------------------

async function testPort(host: string, port: number, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: timeoutMs });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function tryCommonPatterns(domain: string): Promise<DiscoveredSettings | null> {
  const smtpCandidates = [
    { host: `mail.${domain}`, port: 465, secure: true },
    { host: `mail.${domain}`, port: 587, secure: false },
    { host: `smtp.${domain}`, port: 465, secure: true },
    { host: `smtp.${domain}`, port: 587, secure: false },
    { host: domain, port: 465, secure: true },
    { host: domain, port: 587, secure: false },
  ];

  const imapCandidates = [
    { host: `mail.${domain}`, port: 993, secure: true },
    { host: `imap.${domain}`, port: 993, secure: true },
    { host: `mail.${domain}`, port: 143, secure: false },
    { host: domain, port: 993, secure: true },
  ];

  let smtp: { host: string; port: number; secure: boolean } | null = null;
  let imap: { host: string; port: number; secure: boolean } | null = null;

  // Test SMTP candidates
  for (const candidate of smtpCandidates) {
    if (await testPort(candidate.host, candidate.port)) {
      smtp = candidate;
      break;
    }
  }

  // Test IMAP candidates
  for (const candidate of imapCandidates) {
    if (await testPort(candidate.host, candidate.port)) {
      imap = candidate;
      break;
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
    };
  }

  // If only one was found, still return partial with the other using common defaults
  if (smtp) {
    return {
      ...smtp,
      smtpHost: smtp.host,
      smtpPort: smtp.port,
      smtpSecure: smtp.secure,
      imapHost: smtp.host.replace("smtp.", "imap.").replace(/^mail\./, "mail."),
      imapPort: 993,
      imapSecure: true,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main autodiscover function
// ---------------------------------------------------------------------------

export async function autodiscover(
  email: string,
  onProgress?: (progress: DiscoverProgress) => void,
): Promise<DiscoveredSettings | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  // Step 1: Known providers
  onProgress?.({ step: "checking_known_providers", detail: domain });
  const byDomain = matchByDomain(domain);
  if (byDomain) {
    onProgress?.({ step: "done" });
    return byDomain;
  }

  // Step 2: Mozilla autoconfig
  onProgress?.({ step: "checking_autoconfig", detail: domain });
  const autoconfig = await tryAutoconfig(domain);
  if (autoconfig) {
    onProgress?.({ step: "done" });
    return autoconfig;
  }

  // Step 3: MX records
  onProgress?.({ step: "checking_mx_records", detail: domain });
  const byMx = await matchByMx(domain);
  if (byMx) {
    onProgress?.({ step: "done" });
    return byMx;
  }

  // Step 4: Common patterns
  onProgress?.({ step: "trying_common_patterns", detail: domain });
  const byPattern = await tryCommonPatterns(domain);
  if (byPattern) {
    onProgress?.({ step: "done" });
    return byPattern;
  }

  onProgress?.({ step: "failed" });
  return null;
}
