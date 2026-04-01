import { useState, useRef } from "react";
import { trpc } from "../lib/trpc";
import { FilesScreen, type FilesCategory } from "../components/screens/FilesScreen/FilesScreen";
import type { FileSource } from "../components/molecules/FileItem/FileItem";

export function FilesPage() {
  const [activeCategory, setActiveCategory] = useState<FilesCategory>("all");
  const [activeFileId, setActiveFileId] = useState<string | undefined>();
  const [parentId, setParentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filesQuery = trpc.files.list.useQuery({
    parentId: activeCategory === "all" ? parentId : undefined,
    category: activeCategory,
  });
  const countsQuery = trpc.files.categoryCounts.useQuery();

  const starMut = trpc.files.star.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const deleteMut = trpc.files.delete.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const restoreMut = trpc.files.restore.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const createFolderMut = trpc.files.createFolder.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const toggleAiIndexMut = trpc.files.toggleAiIndex.useMutation({
    onSuccess: () => filesQuery.refetch(),
  });
  const renameMut = trpc.files.rename.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const moveMut = trpc.files.move.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const emptyTrashMut = trpc.files.emptyTrash.useMutation({
    onSuccess: () => { filesQuery.refetch(); countsQuery.refetch(); },
  });
  const togglePublicMut = trpc.files.share.togglePublic.useMutation({
    onSuccess: () => filesQuery.refetch(),
  });
  const addShareUserMut = trpc.files.share.addUser.useMutation();
  const removeShareUserMut = trpc.files.share.removeUser.useMutation();
  const changeAccessMut = trpc.files.share.changeAccess.useMutation();

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    if (parentId) formData.append("parentId", parentId);

    await fetch("/api/upload/file", {
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
      window.open(`/api/files/${id}/download`, "_blank");
    }
  };

  const shareDataCache = new Map<string, { publicLink?: string | null; publicEnabled?: boolean; sharedWith?: { id: string; name: string; email: string; access: "viewer" | "editor" }[] }>();

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
        }))}
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
        onNewFolder={() => {
          const name = window.prompt("Folder name:");
          if (name) createFolderMut.mutate({ name, parentId });
        }}
        onRename={(id, name) => renameMut.mutate({ id, name })}
        onMove={(id, parentId) => moveMut.mutate({ id, parentId })}
        onEmptyTrash={() => emptyTrashMut.mutate()}
        onRestore={(id) => restoreMut.mutate({ id })}
        onDelete={(ids) => {
          for (const id of ids) deleteMut.mutate({ id });
        }}
        onDownload={handleDownload}
        onRefresh={() => { filesQuery.refetch(); countsQuery.refetch(); }}
        onToggleAiIndex={(id, enabled) => toggleAiIndexMut.mutate({ id, enabled })}
        onTogglePublicLink={(id, enabled) => togglePublicMut.mutate({ id, enabled })}
        onCopyShareLink={(id) => {
          const file = filesQuery.data?.find((f) => f.id === id);
          if (file) {
            navigator.clipboard.writeText(`${window.location.origin}/api/files/public/${id}`);
          }
        }}
        onAddShareUser={(id, email, access) => addShareUserMut.mutate({ fileId: id, email, access })}
        onRemoveShareUser={(id, userId) => removeShareUserMut.mutate({ fileId: id, userId })}
        onChangeShareAccess={(id, userId, access) => changeAccessMut.mutate({ fileId: id, userId, access })}
        getShareData={(id) => {
          const cached = shareDataCache.get(id);
          if (cached) return cached;
          return { publicLink: null, publicEnabled: false, sharedWith: [] };
        }}
      />
    </>
  );
}
