import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { MailScreen, type MailFolder, type MailEmail, type MailAccount } from "../components/screens/MailScreen/MailScreen";
import type { EmailAccountConfig } from "../components/organisms/EmailSetup/EmailSetup";
import type { MailAttachment } from "../components/organisms/MailDetail/MailDetail";

export function MailPage() {
  const { t } = useTranslation();
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox");
  const [activeEmailId, setActiveEmailId] = useState<string | undefined>();
  const [activeAccountId, setActiveAccountId] = useState<string | undefined>();
  const [aiDrafting, setAiDrafting] = useState(false);

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
  const autodiscoverMut = trpc.emails.mailAccounts.autodiscover.useMutation();
  const verifySmtpMut = trpc.emails.mailAccounts.verify.useMutation();
  const verifyImapMut = trpc.emails.mailAccounts.verifyImap.useMutation();

  const sendMut = trpc.emails.send.useMutation({
    onSuccess: () => emailsQuery.refetch(),
  });
  const starMut = trpc.emails.star.useMutation({
    onSuccess: () => emailsQuery.refetch(),
  });
  const markReadMut = trpc.emails.markRead.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
  });
  const markUnreadMut = trpc.emails.markUnread.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
  });
  const archiveMut = trpc.emails.archive.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
  });
  const deleteMut = trpc.emails.delete.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
  });
  const snoozeMut = trpc.emails.snooze.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
  });
  const labelToggleMut = trpc.emails.labelToggle.useMutation({
    onSuccess: () => emailsQuery.refetch(),
  });
  const moveToSpamMut = trpc.emails.moveToSpam.useMutation({
    onSuccess: () => { emailsQuery.refetch(); countsQuery.refetch(); },
  });
  const aiDraftMut = trpc.emails.aiDraft.useMutation({
    onSettled: () => setAiDrafting(false),
  });

  const labelsQuery = trpc.emails.labels.list.useQuery(
    { accountId: selectedAccountId! },
    { enabled: hasAccount && !!selectedAccountId },
  );
  const createLabelMut = trpc.emails.labels.create.useMutation({
    onSuccess: () => labelsQuery.refetch(),
  });
  const deleteLabelMut = trpc.emails.labels.delete.useMutation({
    onSuccess: () => labelsQuery.refetch(),
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
      const content = emailDetail.bodyHtml || emailDetail.bodyText || row.preview;
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
    const name = window.prompt(t("mail.createLabelPrompt"));
    if (!name?.trim()) return;
    const color = window.prompt(t("mail.createLabelColorPrompt"), "#6b7280");
    createLabelMut.mutate({ accountId: selectedAccountId, name: name.trim(), color: color || "#6b7280" });
  };

  const handleDeleteLabel = (labelId: string) => {
    if (!window.confirm(t("mail.deleteLabelConfirm"))) return;
    deleteLabelMut.mutate({ id: labelId });
  };

  const handleDownloadAttachment = (attachment: MailAttachment) => {
    if (attachment.fileId) {
      window.open(`/api/files/${attachment.fileId}/download`, "_blank");
    }
  };

  return (
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
      onRefresh={() => {
        emailsQuery.refetch();
        countsQuery.refetch();
      }}
      onAiDraft={(prompt) => {
        if (activeEmailId) {
          setAiDrafting(true);
          aiDraftMut.mutate({ id: activeEmailId, prompt });
        }
      }}
    />
  );
}
