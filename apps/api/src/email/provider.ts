export interface RawEmail {
  id: string;
  threadId?: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  subject: string;
  preview: string;
  date: Date;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
  labels: string[];
}

export interface RawEmailFull extends RawEmail {
  bodyHtml?: string;
  bodyText?: string;
  attachments: RawAttachment[];
}

export interface RawAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ComposeMessage {
  from: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  inReplyTo?: string;
}

export interface EmailProvider {
  listMessages(token: string, folder: string, cursor?: string): Promise<{ messages: RawEmail[]; nextCursor?: string }>;
  getMessage(token: string, messageId: string): Promise<RawEmailFull>;
  sendMessage(token: string, msg: ComposeMessage): Promise<{ id: string }>;
  modifyMessage(token: string, messageId: string, changes: { read?: boolean; starred?: boolean; folder?: string }): Promise<void>;
  getAttachment(token: string, messageId: string, attachmentId: string): Promise<Buffer>;
}

export function getProvider(provider: "gmail" | "outlook"): EmailProvider {
  if (provider === "gmail") {
    return new GmailProvider();
  }
  return new OutlookProvider();
}

// --- Gmail Implementation ---

class GmailProvider implements EmailProvider {
  private baseUrl = "https://gmail.googleapis.com/gmail/v1/users/me";

  private async request(token: string, path: string, options?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Gmail API error: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }

  private folderToLabel(folder: string): string {
    const map: Record<string, string> = {
      inbox: "INBOX",
      sent: "SENT",
      drafts: "DRAFT",
      spam: "SPAM",
      trash: "TRASH",
      starred: "STARRED",
    };
    return map[folder] || "INBOX";
  }

  async listMessages(token: string, folder: string, cursor?: string): Promise<{ messages: RawEmail[]; nextCursor?: string }> {
    const label = this.folderToLabel(folder);
    const params = new URLSearchParams({ labelIds: label, maxResults: "50" });
    if (cursor) params.set("pageToken", cursor);

    const data = await this.request(token, `/messages?${params}`) as {
      messages?: { id: string }[];
      nextPageToken?: string;
    };

    if (!data.messages?.length) return { messages: [] };

    const emailPromises = data.messages.map((msg) =>
      this.request(token, `/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`) as Promise<GmailMessage>,
    );
    const rawMessages = await Promise.all(emailPromises);

    return {
      messages: rawMessages.map((msg) => this.parseGmailMessage(msg)),
      nextCursor: data.nextPageToken,
    };
  }

  async getMessage(token: string, messageId: string): Promise<RawEmailFull> {
    const msg = await this.request(token, `/messages/${messageId}?format=full`) as GmailMessage;
    const base = this.parseGmailMessage(msg);
    const { bodyHtml, bodyText } = this.extractBody(msg.payload);
    const attachments = this.extractAttachments(msg.payload, messageId);

    return { ...base, bodyHtml, bodyText, attachments };
  }

  async sendMessage(token: string, msg: ComposeMessage): Promise<{ id: string }> {
    const mimeMessage = this.buildMimeMessage(msg);
    const encoded = Buffer.from(mimeMessage).toString("base64url");

    const result = await this.request(token, "/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw: encoded }),
    }) as { id: string };

    return { id: result.id };
  }

  async modifyMessage(token: string, messageId: string, changes: { read?: boolean; starred?: boolean }): Promise<void> {
    const addLabels: string[] = [];
    const removeLabels: string[] = [];

    if (changes.read === true) removeLabels.push("UNREAD");
    if (changes.read === false) addLabels.push("UNREAD");
    if (changes.starred === true) addLabels.push("STARRED");
    if (changes.starred === false) removeLabels.push("STARRED");

    await this.request(token, `/messages/${messageId}/modify`, {
      method: "POST",
      body: JSON.stringify({ addLabelIds: addLabels, removeLabelIds: removeLabels }),
    });
  }

  async getAttachment(token: string, messageId: string, attachmentId: string): Promise<Buffer> {
    const data = await this.request(token, `/messages/${messageId}/attachments/${attachmentId}`) as { data: string };
    return Buffer.from(data.data, "base64url");
  }

  private parseGmailMessage(msg: GmailMessage): RawEmail {
    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const fromStr = getHeader("From");
    const { name: fromName, email: fromEmail } = parseEmailAddress(fromStr);

    return {
      id: msg.id,
      threadId: msg.threadId,
      fromName,
      fromEmail,
      to: parseEmailList(getHeader("To")),
      cc: parseEmailList(getHeader("Cc")),
      subject: getHeader("Subject"),
      preview: msg.snippet || "",
      date: new Date(parseInt(msg.internalDate || "0")),
      read: !msg.labelIds?.includes("UNREAD"),
      starred: msg.labelIds?.includes("STARRED") || false,
      hasAttachment: this.hasAttachments(msg.payload),
      labels: msg.labelIds || [],
    };
  }

  private extractBody(payload: GmailPayload): { bodyHtml?: string; bodyText?: string } {
    let bodyHtml: string | undefined;
    let bodyText: string | undefined;

    function walk(part: GmailPayload) {
      if (part.mimeType === "text/html" && part.body?.data) {
        bodyHtml = Buffer.from(part.body.data, "base64url").toString("utf8");
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        bodyText = Buffer.from(part.body.data, "base64url").toString("utf8");
      }
      if (part.parts) part.parts.forEach(walk);
    }

    if (payload) walk(payload);
    return { bodyHtml, bodyText };
  }

  private extractAttachments(payload: GmailPayload, messageId: string): RawAttachment[] {
    const attachments: RawAttachment[] = [];

    function walk(part: GmailPayload) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          name: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
        });
      }
      if (part.parts) part.parts.forEach(walk);
    }

    if (payload) walk(payload);
    return attachments;
  }

  private hasAttachments(payload: GmailPayload): boolean {
    let found = false;
    function walk(part: GmailPayload) {
      if (part.filename && part.body?.attachmentId) found = true;
      if (part.parts) part.parts.forEach(walk);
    }
    if (payload) walk(payload);
    return found;
  }

  private buildMimeMessage(msg: ComposeMessage): string {
    const boundary = `boundary_${crypto.randomUUID()}`;
    const lines = [
      `From: ${msg.fromName ? `${msg.fromName} <${msg.from}>` : msg.from}`,
      `To: ${msg.to.join(", ")}`,
    ];
    if (msg.cc?.length) lines.push(`Cc: ${msg.cc.join(", ")}`);
    lines.push(`Subject: ${msg.subject}`);
    if (msg.inReplyTo) lines.push(`In-Reply-To: ${msg.inReplyTo}`);
    lines.push(`MIME-Version: 1.0`);
    lines.push(`Content-Type: text/html; charset=utf-8`);
    lines.push("");
    lines.push(msg.bodyHtml);
    return lines.join("\r\n");
  }
}

// --- Outlook Implementation ---

class OutlookProvider implements EmailProvider {
  private baseUrl = "https://graph.microsoft.com/v1.0/me";

  private async request(token: string, path: string, options?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options?.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Graph API error: ${response.status} ${await response.text()}`);
    }
    return response.json();
  }

  private folderToPath(folder: string): string {
    const map: Record<string, string> = {
      inbox: "inbox",
      sent: "sentitems",
      drafts: "drafts",
      spam: "junkemail",
      trash: "deleteditems",
    };
    return map[folder] || "inbox";
  }

  async listMessages(token: string, folder: string, cursor?: string): Promise<{ messages: RawEmail[]; nextCursor?: string }> {
    let url: string;
    if (cursor) {
      url = cursor;
    } else if (folder === "starred") {
      url = `/messages?$filter=flag/flagStatus eq 'flagged'&$top=50&$select=id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,receivedDateTime,isRead,flag,hasAttachments,categories`;
    } else {
      const folderPath = this.folderToPath(folder);
      url = `/mailFolders/${folderPath}/messages?$top=50&$select=id,conversationId,from,toRecipients,ccRecipients,subject,bodyPreview,receivedDateTime,isRead,flag,hasAttachments,categories`;
    }

    const data = await this.request(token, url) as OutlookMessageList;

    return {
      messages: (data.value || []).map((msg) => this.parseOutlookMessage(msg)),
      nextCursor: data["@odata.nextLink"],
    };
  }

  async getMessage(token: string, messageId: string): Promise<RawEmailFull> {
    const msg = await this.request(token, `/messages/${messageId}`) as OutlookMessage;
    const base = this.parseOutlookMessage(msg);

    const attachmentsData = await this.request(token, `/messages/${messageId}/attachments`) as { value: OutlookAttachment[] };

    return {
      ...base,
      bodyHtml: msg.body?.contentType === "html" ? msg.body.content : undefined,
      bodyText: msg.body?.contentType === "text" ? msg.body.content : undefined,
      attachments: (attachmentsData.value || [])
        .filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment")
        .map((a) => ({
          id: a.id,
          name: a.name,
          mimeType: a.contentType || "application/octet-stream",
          size: a.size || 0,
        })),
    };
  }

  async sendMessage(token: string, msg: ComposeMessage): Promise<{ id: string }> {
    const message = {
      subject: msg.subject,
      body: { contentType: "html", content: msg.bodyHtml },
      toRecipients: msg.to.map((email) => ({ emailAddress: { address: email } })),
      ccRecipients: msg.cc?.map((email) => ({ emailAddress: { address: email } })) || [],
    };

    await this.request(token, "/sendMail", {
      method: "POST",
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    return { id: crypto.randomUUID() };
  }

  async modifyMessage(token: string, messageId: string, changes: { read?: boolean; starred?: boolean }): Promise<void> {
    const patch: Record<string, unknown> = {};
    if (changes.read !== undefined) patch.isRead = changes.read;
    if (changes.starred !== undefined) {
      patch.flag = { flagStatus: changes.starred ? "flagged" : "notFlagged" };
    }

    await this.request(token, `/messages/${messageId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  async getAttachment(token: string, messageId: string, attachmentId: string): Promise<Buffer> {
    const data = await this.request(token, `/messages/${messageId}/attachments/${attachmentId}`) as { contentBytes: string };
    return Buffer.from(data.contentBytes, "base64");
  }

  private parseOutlookMessage(msg: OutlookMessage): RawEmail {
    return {
      id: msg.id,
      threadId: msg.conversationId,
      fromName: msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "",
      fromEmail: msg.from?.emailAddress?.address || "",
      to: (msg.toRecipients || []).map((r) => r.emailAddress?.address || ""),
      cc: (msg.ccRecipients || []).map((r) => r.emailAddress?.address || ""),
      subject: msg.subject || "",
      preview: msg.bodyPreview || "",
      date: new Date(msg.receivedDateTime || 0),
      read: msg.isRead || false,
      starred: msg.flag?.flagStatus === "flagged",
      hasAttachment: msg.hasAttachments || false,
      labels: msg.categories || [],
    };
  }
}

// --- Helpers ---

function parseEmailAddress(str: string): { name: string; email: string } {
  const match = /^(.+?)\s*<(.+?)>$/.exec(str);
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2] };
  return { name: str, email: str };
}

function parseEmailList(str: string): string[] {
  if (!str) return [];
  return str.split(",").map((s) => {
    const { email } = parseEmailAddress(s.trim());
    return email;
  }).filter(Boolean);
}

// --- Gmail types ---

interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload: GmailPayload;
}

interface GmailPayload {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number; attachmentId?: string };
  filename?: string;
  parts?: GmailPayload[];
}

// --- Outlook types ---

interface OutlookMessage {
  id: string;
  conversationId?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  ccRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  receivedDateTime?: string;
  isRead?: boolean;
  flag?: { flagStatus?: string };
  hasAttachments?: boolean;
  categories?: string[];
}

interface OutlookMessageList {
  value: OutlookMessage[];
  "@odata.nextLink"?: string;
}

interface OutlookAttachment {
  "@odata.type": string;
  id: string;
  name: string;
  contentType?: string;
  size?: number;
  contentBytes?: string;
}
