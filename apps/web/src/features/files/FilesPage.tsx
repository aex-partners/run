import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../../platform/trpc";
import { apiUrl, API_BASE } from "../../platform/api";
import { FilesScreen, type FilesCategory } from "./FilesScreen/FilesScreen";
import type { FileSource, FileItemData } from "./FileItem/FileItem";
import type { Section } from "../workspace/AppShell/AppShell";

export interface FilesPageProps {
  onNavigate?: (section: Section) => void;
}

export function FilesPage({ onNavigate }: FilesPageProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<FilesCategory>("all");
  const [activeFileId, setActiveFileId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string | null>(null);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const filesQuery = trpc.files.list.useQuery({
    parentId: activeCategory === "all" ? parentId : undefined,
    category: activeCategory,
  });
  const countsQuery = trpc.files.categoryCounts.useQuery();

  // Drive the share dialog's contents from the backend for the open file.
  const shareDataQuery = trpc.files.share.getData.useQuery(
    { id: shareFileId ?? "" },
    { enabled: !!shareFileId },
  );

  // Refetch the share data after any share mutation so the dialog reflects truth.
  const invalidateShareData = () => {
    utils.files.share.getData.invalidate();
  };

  // On failure, refetch to revert any optimistic UI back to server truth and
  // surface the error to the user.
  const onMutationError = (action: string) => (err: { message?: string }) => {
    filesQuery.refetch();
    countsQuery.refetch();
    window.alert(t('filesPage.actionFailed', { action, message: err?.message ?? t('filesPage.unknownError') }));
  };

  const starMut = trpc.files.star.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('filesPage.favorite')),
  });
  const deleteMut = trpc.files.delete.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('delete')),
  });
  const restoreMut = trpc.files.restore.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('filesPage.restore')),
  });
  const createFolderMut = trpc.files.createFolder.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('filesPage.createFolder')),
  });
  const toggleAiIndexMut = trpc.files.toggleAiIndex.useMutation({
    onSuccess: () => filesQuery.refetch(),
    onError: onMutationError(t('filesPage.aiIndexing')),
  });
  const renameMut = trpc.files.rename.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('filesPage.rename')),
  });
  const moveMut = trpc.files.move.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('filesPage.move')),
  });
  const emptyTrashMut = trpc.files.emptyTrash.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
    onError: onMutationError(t('filesPage.emptyTrash')),
  });
  const togglePublicMut = trpc.files.share.togglePublic.useMutation({
    onSuccess: () => { filesQuery.refetch(); invalidateShareData(); },
    onError: onMutationError(t('filesPage.publicLink')),
  });
  const addShareUserMut = trpc.files.share.addUser.useMutation({
    onSuccess: invalidateShareData,
    onError: onMutationError(t('share')),
  });
  const removeShareUserMut = trpc.files.share.removeUser.useMutation({
    onSuccess: invalidateShareData,
    onError: onMutationError(t('filesPage.removeShare')),
  });
  const changeAccessMut = trpc.files.share.changeAccess.useMutation({
    onSuccess: invalidateShareData,
    onError: onMutationError(t('filesPage.changeAccess')),
  });

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (parentId) formData.append("parentId", parentId);

    await fetch(apiUrl("/api/upload/file"), {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    filesQuery.refetch();
    countsQuery.refetch();
    e.target.value = "";
  };

  const handleFileDoubleClick = (id: string) => {
    const file = filesQuery.data?.find((f) => f.id === id);
    if (file?.isFolder) {
      setParentId(id);
      setActiveCategory("all");
    }
  };

  const handleDownload = (ids: string[]) => {
    for (const id of ids) {
      window.open(apiUrl(`/api/files/${id}/download`), "_blank");
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <FilesScreen
        files={(filesQuery.data ?? []).map((f) => ({
          ...f,
          source: f.source as FileSource,
        })) as FileItemData[]}
        activeCategory={activeCategory}
        activeFileId={activeFileId}
        categoryCounts={countsQuery.data}
        loading={filesQuery.isLoading}
        onCategoryChange={(cat) => {
          setActiveCategory(cat);
          if (cat !== "all") setParentId(null);
        }}
        onFileClick={setActiveFileId}
        onFileDoubleClick={handleFileDoubleClick}
        onFileStar={(id) => starMut.mutate({ id })}
        onUpload={handleUpload}
        onNewFolder={(name) => {
          createFolderMut.mutate({ name, parentId });
        }}
        onRename={(id, name) => renameMut.mutate({ id, name })}
        onMove={(id, parentId) => moveMut.mutate({ id, parentId })}
        onEmptyTrash={() => emptyTrashMut.mutate()}
        onRestore={(id: string) => restoreMut.mutate({ id })}
        onDelete={(ids) => {
          for (const id of ids) deleteMut.mutate({ id });
        }}
        onDownload={handleDownload}
        onRefresh={() => { filesQuery.refetch(); countsQuery.refetch(); }}
        onToggleAiIndex={(id, enabled) => toggleAiIndexMut.mutate({ id, enabled })}
        onTogglePublicLink={(id, enabled) => togglePublicMut.mutate({ id, enabled })}
        onCopyShareLink={(id) => {
          const link = id === shareFileId ? shareDataQuery.data?.publicLink : null;
          if (link) {
            navigator.clipboard.writeText(`${API_BASE || window.location.origin}${link}`);
          }
        }}
        onAddShareUser={(id, email, access) => addShareUserMut.mutate({ fileId: id, email, access })}
        onRemoveShareUser={(id, userId) => removeShareUserMut.mutate({ fileId: id, userId })}
        onChangeShareAccess={(id, userId, access) => changeAccessMut.mutate({ fileId: id, userId, access })}
        onShareDialogIdChange={setShareFileId}
        onAiAction={(query) => {
          window.history.pushState(null, "", "/?q=" + encodeURIComponent(query));
          onNavigate?.("chat");
        }}
        getShareData={(id) => {
          if (id === shareFileId && shareDataQuery.data) return shareDataQuery.data;
          return { publicLink: null, publicEnabled: false, sharedWith: [] };
        }}
      />
    </>
  );
}
