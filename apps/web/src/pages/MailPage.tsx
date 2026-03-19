import { useState } from "react";
import { trpc } from "../lib/trpc";
import { MailScreen, type MailFolder, type MailEmail } from "../components/screens/MailScreen/MailScreen";

export function MailPage() {
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox");
  const [activeEmailId, setActiveEmailId] = useState<string | undefined>();
  const [aiDrafting, setAiDrafting] = useState(false);

  const accountsQuery = trpc.emails.accounts.list.useQuery();
  const hasAccount = (accountsQuery.data?.length ?? 0) > 0;
  const accountId = accountsQuery.data?.[0]?.id;

  const emailsQuery = trpc.emails.list.useQuery(
    { accountId, folder: activeFolder },
    { enabled: hasAccount },
  );
  const countsQuery = trpc.emails.folderCounts.useQuery(
    { accountId },
    { enabled: hasAccount },
  );
  const labelsQuery = trpc.emails.labels.list.useQuery(
    { accountId: accountId! },
    { enabled: !!accountId },
  );

  const connectMut = trpc.emails.accounts.connect.useMutation({
    onSuccess: (data) => {
      if (data.authUrl) window.location.href = data.authUrl;
    },
  });
  const syncMut = trpc.emails.accounts.sync.useMutation({
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
  const sendMut = trpc.emails.send.useMutation({
    onSuccess: () => emailsQuery.refetch(),
  });
  const aiDraftMut = trpc.emails.aiDraft.useMutation({
    onSettled: () => setAiDrafting(false),
  });

  const emailsList: MailEmail[] = (emailsQuery.data ?? []).map((row) => ({
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
  }));

  return (
    <MailScreen
      emails={emailsList}
      labels={(labelsQuery.data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        color: l.color,
      }))}
      activeFolder={activeFolder}
      activeEmailId={activeEmailId}
      folderCounts={countsQuery.data}
      loading={emailsQuery.isLoading}
      aiDrafting={aiDrafting}
      onFolderChange={(folder) => {
        setActiveFolder(folder);
        setActiveEmailId(undefined);
      }}
      onEmailClick={setActiveEmailId}
      onEmailStar={(id) => starMut.mutate({ id })}
      onCompose={() => {
        if (!hasAccount) {
          connectMut.mutate({ provider: "gmail" });
        }
      }}
      onSend={(data) => {
        if (!accountId) return;
        sendMut.mutate({
          accountId,
          to: data.to,
          cc: data.cc || undefined,
          subject: data.subject,
          body: data.body,
        });
      }}
      onArchive={(ids) => archiveMut.mutate({ ids })}
      onDelete={(ids) => deleteMut.mutate({ ids })}
      onMarkRead={(ids) => markReadMut.mutate({ ids })}
      onMarkUnread={(ids) => markUnreadMut.mutate({ ids })}
      onRefresh={() => {
        if (accountId) syncMut.mutate({ accountId });
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
