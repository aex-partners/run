import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "../lib/trpc";
import { Plus, Search, X, Trash2 } from "lucide-react";

type Scope = "company" | "personal";

const CATEGORY_OPTIONS = [
  "company-info",
  "client",
  "supplier",
  "product",
  "process",
  "policy",
  "preference",
];

interface KnowledgeEntry {
  id: string;
  scope: string;
  category: string;
  title: string;
  content: string;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  sourceFileId: string | null;
}

interface SearchResult {
  id: string;
  scope: string;
  category: string;
  title: string;
  content: string;
  createdAt: Date;
  similarity: number | null;
}

export function KnowledgePage() {
  const { t } = useTranslation();
  const [scopeFilter, setScopeFilter] = useState<Scope | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<(KnowledgeEntry | SearchResult) | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("company-info");
  const [formScope, setFormScope] = useState<Scope>("company");

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  const listQuery = trpc.knowledge.list.useQuery({
    scope: scopeFilter === "all" ? undefined : scopeFilter,
    category: categoryFilter ?? undefined,
  });

  const categoriesQuery = trpc.knowledge.categories.useQuery();
  const searchMutation = trpc.knowledge.search.useMutation();
  const createMutation = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      categoriesQuery.refetch();
      closeEditor();
    },
  });
  const updateMutation = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      closeEditor();
    },
  });
  const deleteMutation = trpc.knowledge.delete.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      categoriesQuery.refetch();
      setDeleteConfirmId(null);
    },
  });

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (query.length < 3) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await searchMutation.mutateAsync({ query });
          setSearchResults(results);
        } catch {
          setSearchResults(null);
        } finally {
          setIsSearching(false);
        }
      }, 300);
    },
    [searchMutation],
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  const openNewEntry = () => {
    setEditingEntry(null);
    setFormTitle("");
    setFormContent("");
    setFormCategory("company-info");
    setFormScope("company");
    setEditorOpen(true);
  };

  const openEditEntry = (entry: KnowledgeEntry | SearchResult) => {
    setEditingEntry(entry);
    setFormTitle(entry.title);
    setFormContent(entry.content);
    setFormCategory(entry.category);
    setFormScope(entry.scope as Scope);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingEntry(null);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formContent.trim()) return;

    if (editingEntry) {
      updateMutation.mutate({
        id: editingEntry.id,
        title: formTitle,
        content: formContent,
        category: formCategory,
        scope: formScope,
      });
    } else {
      createMutation.mutate({
        title: formTitle,
        content: formContent,
        category: formCategory,
        scope: formScope,
      });
    }
  };

  const entries = searchResults ?? listQuery.data ?? [];
  const allCategories = categoriesQuery.data ?? [];

  return (
    <div style={{ display: "flex", flex: 1, height: "100%", overflow: "hidden" }}>
      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", margin: 0 }}>
            {t("knowledge.title")}
          </h1>
          <button
            onClick={openNewEntry}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={15} />
            {t("knowledge.newEntry")}
          </button>
        </div>

        {/* Search bar */}
        <div style={{ padding: "12px 24px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--surface-2)",
              borderRadius: 8,
              border: "1px solid var(--border)",
            }}
          >
            <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={t("knowledge.searchPlaceholder")}
              style={{
                flex: 1,
                border: "none",
                background: "transparent",
                outline: "none",
                fontSize: 13,
                color: "var(--text)",
                fontFamily: "inherit",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => handleSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 2,
                  display: "flex",
                  color: "var(--text-muted)",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          {/* Scope toggles */}
          {(["all", "company", "personal"] as const).map((scope) => (
            <button
              key={scope}
              onClick={() => setScopeFilter(scope)}
              style={{
                padding: "4px 12px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: scopeFilter === scope ? "var(--primary)" : "transparent",
                color: scopeFilter === scope ? "#fff" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {scope === "all"
                ? t("knowledge.scopeAll")
                : scope === "company"
                  ? t("knowledge.scopeCompany")
                  : t("knowledge.scopePersonal")}
            </button>
          ))}

          <div
            style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }}
          />

          {/* Category pills */}
          <button
            onClick={() => setCategoryFilter(null)}
            style={{
              padding: "4px 12px",
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: categoryFilter === null ? "var(--primary)" : "transparent",
              color: categoryFilter === null ? "#fff" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t("knowledge.categoryAll")}
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: "4px 12px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: categoryFilter === cat ? "var(--primary)" : "transparent",
                color: categoryFilter === cat ? "#fff" : "var(--text-muted)",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {(t(`knowledge.categories.${cat}`, { defaultValue: cat }) as string)}
            </button>
          ))}
        </div>

        {/* Entries list */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 24px 24px" }}>
          {isSearching && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Searching...
            </div>
          )}

          {!isSearching && entries.length === 0 && (
            <div style={{ padding: 48, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
              {t("knowledge.noEntries")}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((entry: KnowledgeEntry | SearchResult) => (
              <div
                key={entry.id}
                onClick={() => openEditEntry(entry)}
                style={{
                  padding: "14px 16px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
                    {entry.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: entry.scope === "company" ? "#dbeafe" : "#fef3c7",
                        color: entry.scope === "company" ? "#1e40af" : "#92400e",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {entry.scope === "company"
                        ? t("knowledge.scopeCompany")
                        : t("knowledge.scopePersonal")}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--surface-2)",
                        color: "var(--text-muted)",
                        fontSize: 11,
                        fontWeight: 500,
                      }}
                    >
                      {(t(`knowledge.categories.${entry.category}`, {
                        defaultValue: entry.category,
                      }) as string)}
                    </span>
                    {"similarity" in entry && entry.similarity !== null && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: "#ecfdf5",
                          color: "#065f46",
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {Math.round(entry.similarity * 100)}%
                      </span>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-muted)",
                    lineHeight: 1.5,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {entry.content.slice(0, 200)}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  {new Date(entry.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slide-in editor panel */}
      {editorOpen && (
        <div
          style={{
            width: 420,
            minWidth: 420,
            borderLeft: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", margin: 0 }}>
              {editingEntry ? t("knowledge.editEntry") : t("knowledge.newEntry")}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {editingEntry && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(editingEntry.id);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 6,
                    color: "var(--text-muted)",
                    display: "flex",
                    borderRadius: 4,
                  }}
                  title={t("knowledge.deleteEntry")}
                >
                  <Trash2 size={15} />
                </button>
              )}
              <button
                onClick={closeEditor}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 6,
                  color: "var(--text-muted)",
                  display: "flex",
                  borderRadius: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Title */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                {t("knowledge.entryTitle")}
              </label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text)",
                  background: "var(--background)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                {t("knowledge.entryContent")}
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                style={{
                  flex: 1,
                  minHeight: 160,
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text)",
                  background: "var(--background)",
                  fontFamily: "inherit",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                {t("knowledge.entryCategory")}
              </label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--text)",
                  background: "var(--background)",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat} value={cat}>
                    {(t(`knowledge.categories.${cat}`, { defaultValue: cat }) as string)}
                  </option>
                ))}
              </select>
            </div>

            {/* Scope */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>
                {t("knowledge.entryScope")}
              </label>
              <div style={{ display: "flex", gap: 12 }}>
                {(["company", "personal"] as const).map((s) => (
                  <label
                    key={s}
                    style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)", cursor: "pointer" }}
                  >
                    <input
                      type="radio"
                      name="scope"
                      value={s}
                      checked={formScope === s}
                      onChange={() => setFormScope(s)}
                    />
                    {s === "company" ? t("knowledge.scopeCompany") : t("knowledge.scopePersonal")}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
          >
            <button
              onClick={closeEditor}
              style={{
                padding: "7px 16px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--text)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {t("knowledge.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!formTitle.trim() || !formContent.trim()}
              style={{
                padding: "7px 16px",
                borderRadius: 6,
                border: "none",
                background: formTitle.trim() && formContent.trim() ? "var(--primary)" : "var(--surface-2)",
                color: formTitle.trim() && formContent.trim() ? "#fff" : "var(--text-muted)",
                fontSize: 13,
                fontWeight: 500,
                cursor: formTitle.trim() && formContent.trim() ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {t("knowledge.save")}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--surface)",
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: "90%",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
              {t("knowledge.deleteEntry")}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.5 }}>
              {t("knowledge.deleteConfirm")}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("knowledge.cancel")}
              </button>
              <button
                onClick={() => {
                  deleteMutation.mutate({ id: deleteConfirmId });
                  closeEditor();
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("knowledge.deleteEntry")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
