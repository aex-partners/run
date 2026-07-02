import { useState } from "react";
import { useTranslation } from "react-i18next";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { trpc } from "../../platform/trpc";
import { apiUrl } from "../../platform/api";
import { MailScreen, type MailFolder, type MailEmail, type MailAccount } from "./MailScreen/MailScreen";
import type { EmailAccountConfig } from "./EmailSetup/EmailSetup";
import type { MailAttachment } from "./MailDetail/MailDetail";
import { ColorPicker } from "../../shared/ui/ColorPicker/ColorPicker";
import { Button } from "../../shared/ui/Button/Button";

export function MailPage() {
  const { t } = useTranslation();
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox");
  const [activeEmailId, setActiveEmailId] = useState<string | undefined>();
  const [activeAccountId, setActiveAccountId] = useState<string | undefined>();
  const [aiDrafting, setAiDrafting] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState("#6b7280");

  const accountsQuery = trpc.emails.mailAccounts.list.useQuery();
  const accounts: MailAccount[] = (accountsQuery.data ?? []).map((a) => ({
    id: a.id,
    displayName: a.displayName,
    emailAddress: a.emailAddress,
    isShared: a.isShared,
    isOwner: a.isOwner,
  }));
  const hasAccount = accounts.length > 0;

  // Default to first account
  const selectedAccountId = activeAccountId ?? accounts[0]?.id;

  const emailsQuery = trpc.emails.list.useQuery(
    { accountId: selectedAccountId, folder: activeFolder },
    { enabled: hasAccount && !!selectedAccountId },
  );
  const countsQuery = trpc.emails.folderCounts.useQuery(
    { accountId: selectedAccountId },
    { enabled: hasAccount && !!selectedAccountId },
  );

  const createAccountMut = trpc.emails.mailAccounts.create.useMutation({
    onSuccess: () => {
      accountsQuery.refetch();
      emailsQuery.refetch();
      countsQuery.refetch();
    },
  });
  const autodiscoverMut = trpc.emails.mailAccounts.autodiscover.useMutation({
    onError: (err) => console.error("Autodiscover failed:", err),
  });
  const verifySmtpMut = trpc.emails.mailAccounts.verify.useMutation({
    onError: (err) => console.error("SMTP verification failed:", err),
  });
  const verifyImapMut = trpc.emails.mailAccounts.verifyImap.useMutation({
    onError: (err) => console.error("IMAP verification failed:", err),
  });

  const sendMut = trpc.emails.send.useMutation({
    onSuccess: () => emailsQuery.refetch(),
    onError: (err) => console.error("Send failed:", err),
  });
  const starMut = trpc.emails.star.useMutation({
    onSuccess: () => emailsQuery.refetch(),
    onError: (err) => console.error("Star failed:", err),
  });
  const markReadMut = trpc.emails.markRead.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
    onError: (err) => console.error("Mark read failed:", err),
  });
  const markUnreadMut = trpc.emails.markUnread.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
    onError: (err) => console.error("Mark unread failed:", err),
  });
  const archiveMut = trpc.emails.archive.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
    onError: (err) => console.error("Archive failed:", err),
  });
  const deleteMut = trpc.emails.delete.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
    onError: (err) => console.error("Delete failed:", err),
  });
  const snoozeMut = trpc.emails.snooze.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
    onError: (err) => console.error("Snooze failed:", err),
  });
  const labelToggleMut = trpc.emails.labelToggle.useMutation({
    onSuccess: () => emailsQuery.refetch(),
    onError: (err) => console.error("Label toggle failed:", err),
  });
  const moveToSpamMut = trpc.emails.moveToSpam.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
    onError: (err) => console.error("Move to spam failed:", err),
  });
  const aiDraftMut = trpc.emails.aiDraft.useMutation({
    onSuccess: () => emailsQuery.refetch(),
    onSettled: () => setAiDrafting(false),
    onError: (err) => console.error("AI draft failed:", err),
  });

  const aiEnabledQuery = trpc.emails.aiEnabled.useQuery();

  const labelsQuery = trpc.emails.labels.list.useQuery(
    { accountId: selectedAccountId! },
    { enabled: hasAccount && !!selectedAccountId },
  );
  const createLabelMut = trpc.emails.labels.create.useMutation({
    onSuccess: () => labelsQuery.refetch(),
    onError: (err) => console.error("Create label failed:", err),
  });
  const deleteLabelMut = trpc.emails.labels.delete.useMutation({
    onSuccess: () => labelsQuery.refetch(),
    onError: (err) => console.error("Delete label failed:", err),
  });

  const emailDetailQuery = trpc.emails.getById.useQuery(
    { id: activeEmailId! },
    { enabled: !!activeEmailId },
  );
  const emailDetail = emailDetailQuery.data;

  const emailsList: MailEmail[] = (emailsQuery.data ?? []).map((row) => {
    const base: MailEmail = {
      id: row.id,
      from: row.from,
      fromEmail: row.fromEmail,
      subject: row.subject,
      preview: row.preview,
      timestamp: row.timestamp,
      read: row.read,
      starred: row.starred,
      hasAttachment: row.hasAttachment,
      labels: row.labels as { name: string; color: string }[],
      folder: row.folder as MailFolder,
      aiSummary: row.aiSummary ?? undefined,
      aiDraft: row.aiDraft ?? undefined,
    };

    if (row.id === activeEmailId && emailDetail) {
      const content = emailDetail.bodyHtml ?? emailDetail.bodyText ?? row.preview;
      // Enrich active email with detail fields used to build replies/forwards
      base.to = Array.isArray(emailDetail.to) ? emailDetail.to : undefined;
      base.cc = Array.isArray(emailDetail.cc) ? emailDetail.cc : undefined;
      base.externalId = emailDetail.externalId ?? undefined;
      base.threadId = emailDetail.threadId ?? undefined;
      base.bodyText = emailDetail.bodyText ?? (emailDetail.bodyHtml ? emailDetail.bodyHtml.replace(/<[^>]+>/g, '') : undefined);
      base.rawDate = emailDetail.date ? new Date(emailDetail.date).toISOString() : undefined;
      base.thread = [{
        id: row.id,
        from: row.from,
        fromEmail: row.fromEmail,
        to: Array.isArray(emailDetail.to) ? emailDetail.to : ['me'],
        cc: Array.isArray(emailDetail.cc) ? emailDetail.cc : undefined,
        date: row.timestamp,
        content,
        attachments: emailDetail.attachments?.map((a) => ({
          name: a.name,
          size: a.size ? `${Math.round(a.size / 1024)} KB` : '',
          type: a.mimeType,
          fileId: a.fileId ?? undefined,
          externalId: a.externalId ?? undefined,
        })),
      }];
    }

    return base;
  });

  const handleAccountSubmit = (config: EmailAccountConfig) => {
    const namePart = config.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    createAccountMut.mutate({
      displayName: namePart,
      emailAddress: config.email,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: config.smtpUser,
      smtpPass: config.smtpPass,
      smtpSecure: config.smtpSecure,
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      imapUser: config.imapUser,
      imapPass: config.imapPass,
      imapSecure: config.imapSecure,
    });
  };

  const handleDiscover = async (email: string) => {
    const result = await autodiscoverMut.mutateAsync({ email });
    return result;
  };

  const handleVerifySmtp = async (config: { host: string; port: number; user: string; pass: string; from: string; secure: boolean }) => {
    return verifySmtpMut.mutateAsync(config);
  };

  const handleVerifyImap = async (config: { host: string; port: number; user: string; pass: string; secure: boolean }) => {
    return verifyImapMut.mutateAsync(config);
  };

  const handleCreateLabel = () => {
    if (!selectedAccountId) return;
    setLabelName("");
    setLabelColor("#6b7280");
    setLabelDialogOpen(true);
  };

  const handleSubmitLabel = () => {
    if (!selectedAccountId || !labelName.trim()) return;
    createLabelMut.mutate({
      accountId: selectedAccountId,
      name: labelName.trim(),
      color: labelColor,
    });
    setLabelDialogOpen(false);
    setLabelName("");
    setLabelColor("#6b7280");
  };

  const handleDeleteLabel = (labelId: string) => {
    if (!window.confirm(t("mail.deleteLabelConfirm"))) return;
    deleteLabelMut.mutate({ id: labelId });
  };

  const handleDownloadAttachment = (attachment: MailAttachment) => {
    if (attachment.fileId) {
      window.open(apiUrl(`/api/files/${attachment.fileId}/download`), "_blank");
    }
  };

  return (
    <>
    <MailScreen
      emails={emailsList}
      accounts={accounts}
      activeAccountId={selectedAccountId}
      activeFolder={activeFolder}
      activeEmailId={activeEmailId}
      folderCounts={countsQuery.data}
      hasAccount={hasAccount}
      loading={emailsQuery.isLoading}
      emailDetailLoading={emailDetailQuery.isLoading}
      aiDrafting={aiDrafting}
      onAccountChange={setActiveAccountId}
      onAddAccount={undefined}
      onAddAccountV2={{
        onAccountSubmit: handleAccountSubmit,
        onDiscover: handleDiscover,
        onVerifySmtp: handleVerifySmtp,
        onVerifyImap: handleVerifyImap,
      }}
      onFolderChange={(folder) => {
        setActiveFolder(folder);
        setActiveEmailId(undefined);
      }}
      onEmailClick={setActiveEmailId}
      onEmailStar={(id) => starMut.mutate({ id })}
      onSend={(data) => {
        if (!selectedAccountId) return;
        sendMut.mutate({
          accountId: selectedAccountId,
          to: data.to,
          cc: data.cc || undefined,
          subject: data.subject,
          body: data.body,
          attachments: data.attachments,
          inReplyTo: data.inReplyTo,
          threadId: data.threadId,
        });
      }}
      labels={(labelsQuery.data ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color }))}
      onCreateLabel={handleCreateLabel}
      onDeleteLabel={handleDeleteLabel}
      onDownloadAttachment={handleDownloadAttachment}
      onArchive={(ids) => archiveMut.mutate({ ids })}
      onDelete={(ids) => deleteMut.mutate({ ids })}
      onMarkRead={(ids) => markReadMut.mutate({ ids })}
      onMarkUnread={(ids) => markUnreadMut.mutate({ ids })}
      onSnooze={(emailId, until) => snoozeMut.mutate({ id: emailId, until })}
      onLabelToggle={(emailId, labelName) => labelToggleMut.mutate({ id: emailId, labelName })}
      onMoveToSpam={(ids) => moveToSpamMut.mutate({ ids })}
      onLabelClick={(labelId) => {
        console.log("Filter by label:", labelId);
        // TODO: implement label filtering
      }}
      onRefresh={() => {
        emailsQuery.refetch();
        countsQuery.refetch();
      }}
      aiEnabled={aiEnabledQuery.data?.enabled ?? true}
      onAiDraft={(prompt) => {
        if (activeEmailId) {
          setAiDrafting(true);
          aiDraftMut.mutate({ id: activeEmailId, prompt });
        }
      }}
    />

    {/* Create Label Dialog */}
    <Dialog.Root open={labelDialogOpen} onOpenChange={setLabelDialogOpen}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
        <Dialog.Content
          style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 380, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
            padding: 24, zIndex: 201,
          }}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Dialog.Title style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
              {t('mail.createLabel')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                aria-label={t('close')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="label-name"
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'block', marginBottom: 6 }}
              >
                {t('name')}
              </label>
              <input
                id="label-name"
                type="text"
                value={labelName}
                onChange={(e) => setLabelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitLabel(); }}
                placeholder={t('mail.createLabelPrompt')}
                autoFocus
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 8,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <ColorPicker
              value={labelColor}
              onChange={setLabelColor}
              label={t('mail.createLabelColorPrompt')}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button variant="secondary" size="sm" onClick={() => setLabelDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSubmitLabel}
                disabled={!labelName.trim() || createLabelMut.isPending}
                loading={createLabelMut.isPending}
              >
                {t('mail.createLabel')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    </>
  );
}
