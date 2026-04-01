import { useState, useMemo, useEffect, useCallback } from "react";
import { X, ArrowLeft, Search, Bot, Check, ImagePlus } from "lucide-react";
import { trpc } from "../lib/trpc";
import { apiUrl } from "../lib/api";
import { formatRelativeTime, formatTime } from "../lib/formatTime";
import { ChatScreen } from "../components/screens/ChatScreen/ChatScreen";
import { useWS } from "../providers/WebSocketProvider";
import { useAuth } from "../hooks/useAuth";
import { useAgentChat } from "../hooks/useAgentChat";
import { Avatar } from "../components/atoms/Avatar/Avatar";
import type { Section } from "../components/layout/AppShell/AppShell";
import type { Conversation } from "../components/organisms/ConversationList/ConversationList";
import type { ThreadMessage } from "../components/organisms/MessageThread/MessageThread";
import type { PromptInputAttachment } from "../components/organisms/PromptInput/PromptInput";
import type { Task } from "../components/organisms/TaskList/TaskList";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: string;
  mimeType: string;
  path: string;
}

interface AgentOption {
  id: string;
  name: string;
}

interface GroupMember {
  id: string;
  name: string;
  type: "user" | "agent";
}

function formatDuration(startedAt: string | Date | null, completedAt: string | Date | null): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffS = Math.floor((end - start) / 1000);
  if (diffS < 60) return `${diffS}s`;
  const min = Math.floor(diffS / 60);
  const sec = diffS % 60;
  return `${min}m ${sec}s`;
}

export function ChatPage({ onNavigate }: { onNavigate?: (section: Section) => void }) {
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [groupStep, setGroupStep] = useState<null | "members" | "details">(null);
  const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [attachments, setAttachments] = useState<(PromptInputAttachment & { fileRef: UploadedFile })[]>([]);

  const utils = trpc.useUtils();
  const { streams, typingConversations } = useWS();
  const { user } = useAuth();
  const currentUserId = user.id;

  // Fetch org name for workspace header
  const { data: orgName } = trpc.settings.get.useQuery({ key: "company.orgName" });
  const workspaceName = typeof orgName === "string" ? orgName : undefined;

  const { data: serverConversations = [] } = trpc.conversations.list.useQuery();

  // Agents
  const { data: serverAgents = [] } = trpc.agents.list.useQuery();
  const { data: serverUsers = [] } = trpc.users.list.useQuery(undefined, {
    enabled: groupStep === "members",
  });
  const setAgentMut = trpc.conversations.setAgent.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
    },
  });

  const agentOptions: AgentOption[] = serverAgents.map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const { data: serverMessages } = trpc.messages.list.useQuery(
    { conversationId: activeConversationId! },
    { enabled: !!activeConversationId },
  );

  // Tasks
  const { data: serverTasks = [] } = trpc.tasks.list.useQuery();
  const cancelTask = trpc.tasks.cancel.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });
  const retryTask = trpc.tasks.retry.useMutation({
    onSuccess: () => utils.tasks.list.invalidate(),
  });

  const tasks: Task[] = serverTasks.map((t) => {
    const agentName = t.agentId
      ? serverAgents.find((a) => a.id === t.agentId)?.name ?? "Agent"
      : "System";
    return {
      id: t.id,
      title: t.title,
      description: t.description ?? undefined,
      status: t.status as Task["status"],
      agent: agentName,
      progress: t.progress ?? undefined,
      conversationId: t.conversationId ?? undefined,
      taskType: t.type as "inference" | "structured",
      startTime: t.startedAt ? formatRelativeTime(new Date(t.startedAt).toISOString()) : "Pending",
      duration: t.completedAt ? formatDuration(t.startedAt, t.completedAt) : undefined,
    };
  });

  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ conversationId: activeConversationId! });
      utils.conversations.list.invalidate();
    },
  });

  const markRead = trpc.conversations.markRead.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
    },
  });

  const pinConversation = trpc.conversations.pin.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const favoriteConversation = trpc.conversations.favorite.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const muteConversation = trpc.conversations.mute.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });

  const createConversation = trpc.conversations.create.useMutation({
    onSuccess: (data) => {
      utils.conversations.list.invalidate();
      setActiveConversationId(data.id);
    },
  });

  const confirmAction = trpc.ai.confirmAction.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      if (activeConversationId) {
        utils.messages.list.invalidate({ conversationId: activeConversationId });
      }
    },
  });

  // Message actions
  const pinMessage = trpc.messages.pin.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
    },
  });
  const starMessage = trpc.messages.star.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
    },
  });
  const deleteForEveryone = trpc.messages.deleteForEveryone.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
    },
  });
  const deleteForMe = trpc.messages.deleteForMe.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
    },
  });
  const reactMessage = trpc.messages.react.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
    },
  });
  const forwardMessages = trpc.messages.forward.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const editTranscription = trpc.messages.editTranscription.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
    },
  });

  const conversations: Conversation[] = useMemo(
    () =>
      serverConversations.map((c) => {
        const agentId = (c as Record<string, unknown>).agentId as string | null | undefined;
        const agent = agentId ? serverAgents.find((a) => a.id === agentId) : null;
        return {
          id: c.id,
          name: c.name ?? "Untitled",
          type: c.type as Conversation["type"],
          lastMessage: c.lastMessage ?? "",
          timestamp: formatRelativeTime(c.lastMessageAt),
          unreadCount: c.unreadCount,
          agentName: agent?.name,
          pinned: (c as Record<string, unknown>).pinned as boolean | undefined,
          favorite: (c as Record<string, unknown>).favorite as boolean | undefined,
          muted: (c as Record<string, unknown>).muted as boolean | undefined,
        };
      }),
    [serverConversations, serverAgents],
  );

  // Auto-select first conversation (Eric) if none is active
  useEffect(() => {
    if (!activeConversationId && serverConversations.length > 0) {
      const first = serverConversations[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional auto-select
      setActiveConversationId(first.id);
      markRead.mutate({ id: first.id });
    }
  }, [serverConversations]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeAgent: AgentOption | null = useMemo(() => {
    if (!activeConversationId) return null;
    const conv = serverConversations.find((c) => c.id === activeConversationId);
    if (!conv) return null;
    const agentId = (conv as Record<string, unknown>).agentId as string | null | undefined;
    if (!agentId) return null;
    const agent = serverAgents.find((a) => a.id === agentId);
    return agent ? { id: agent.id, name: agent.name } : null;
  }, [activeConversationId, serverConversations, serverAgents]);

  // Determine if active conversation is AI
  const activeConvType = useMemo(() => {
    if (!activeConversationId) return null;
    const conv = serverConversations.find((c) => c.id === activeConversationId);
    return conv?.type ?? null;
  }, [activeConversationId, serverConversations]);
  const isAIConversation = activeConvType === "ai";

  // Agent chat for AI conversations
  const agentChat = useAgentChat({
    conversationId: activeConversationId ?? "",
    agentName: activeAgent?.name ?? "Eric",
  });

  // Load initial messages from DB into agent chat when conversation changes
  useEffect(() => {
    if (!isAIConversation || !serverMessages?.items) return;
    const dbMessages = [...serverMessages.items].reverse().map((m) => ({
      id: m.id,
      role: m.role as "user" | "ai",
      content: m.content,
      author: m.authorName ?? (m.role === "user" ? "You" : activeAgent?.name ?? "Eric"),
    }));
    if (dbMessages.length > 0 && agentChat.messages.length === 0) {
      agentChat.setMessages(dbMessages);
    }
  }, [isAIConversation, serverMessages, activeConversationId]);

  /* eslint-disable react-hooks/preserve-manual-memoization */
  const messages: ThreadMessage[] = useMemo(() => {
    // AI conversation: use agent chat messages
    if (isAIConversation && agentChat.messages.length > 0) {
      return agentChat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        author: m.author,
        reasoning: m.reasoning,
        queue: m.queue,
        // Only pass approval-required tool invocations (shown as Confirmation cards)
        toolInvocations: m.toolInvocations?.map((t) => ({
          id: t.id,
          toolName: t.toolName,
          state: t.state,
          input: t.input,
          output: t.output,
          error: t.error,
        })),
        onApproveToolCall: agentChat.approveToolCall,
      }));
    }

    // DM/channel: use DB messages
    if (!serverMessages?.items) return [];
    const mapped = [...serverMessages.items].reverse().map((m) => {
      const raw = m as typeof m & { metadata?: string | null };
      let metadata: {
        actionCard?: { actionId: string; question: string; description?: string; resolved?: boolean; result?: string };
        quickReplies?: { options: string[]; answered?: boolean };
        toolExecution?: { toolName: string; summary: string; detail?: string };
        forwardedFrom?: { messageId: string; authorName: string };
      } | undefined;
      if (raw.metadata) {
        try {
          metadata = JSON.parse(raw.metadata as string);
        } catch {
          // skip
        }
      }

      const msg: ThreadMessage = {
        id: m.id,
        role: m.role as ThreadMessage["role"],
        content: m.content,
        author: m.authorName ?? "System",
        timestamp: formatTime(typeof m.createdAt === "string" ? m.createdAt : (m.createdAt as unknown as Date).toISOString()),
        pinned: m.pinned === 1,
        starred: m.starred === 1,
      };

      if (m.reactions) {
        try {
          const raw: { emoji: string; userId: string }[] = JSON.parse(m.reactions as string);
          const grouped = new Map<string, { count: number; reacted: boolean }>();
          for (const r of raw) {
            const existing = grouped.get(r.emoji);
            if (existing) {
              existing.count++;
              if (r.userId === currentUserId) existing.reacted = true;
            } else {
              grouped.set(r.emoji, { count: 1, reacted: r.userId === currentUserId });
            }
          }
          msg.reactions = Array.from(grouped.entries()).map(([emoji, data]) => ({
            emoji,
            count: data.count,
            reacted: data.reacted,
          }));
        } catch {
          // skip
        }
      }

      if (m.audioUrl) {
        msg.audio = {
          url: m.audioUrl as string,
          duration: m.audioDuration as string,
          waveform: m.audioWaveform ? JSON.parse(m.audioWaveform as string) : undefined,
          transcription: m.audioTranscription as string | undefined,
          transcriptionEdited: m.audioTranscriptionEdited === 1,
        };
      }

      if (metadata?.actionCard && !metadata.actionCard.resolved) {
        msg.actionCard = {
          question: metadata.actionCard.question,
          description: metadata.actionCard.description,
          onConfirm: () => confirmAction.mutate({ actionId: metadata!.actionCard!.actionId, confirmed: true }),
          onDeny: () => confirmAction.mutate({ actionId: metadata!.actionCard!.actionId, confirmed: false }),
        };
      }

      if (metadata?.quickReplies && !metadata.quickReplies.answered) {
        msg.quickReplies = {
          options: metadata.quickReplies.options,
          onSelect: (option: string) => handleQuickReply(m.id, option),
        };
      }

      if (metadata?.toolExecution) {
        msg.toolExecution = {
          summary: metadata.toolExecution.summary,
          detail: metadata.toolExecution.detail,
        };
      }

      return msg;
    });

    // Append streaming message for DM/channel (WebSocket-based)
    const activeStream = activeConversationId ? streams.current.get(activeConversationId) : null;
    if (activeStream && activeStream.content) {
      mapped.push({
        id: activeStream.messageId,
        role: "ai" as const,
        content: activeStream.content,
        author: activeAgent?.name ?? "Eric",
      });
    }

    return mapped;
  }, [isAIConversation, agentChat.messages, serverMessages, activeConversationId, streams, confirmAction]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const isTyping = isAIConversation
    ? agentChat.isStreaming
    : activeConversationId
      ? typingConversations.current.has(activeConversationId)
      : false;

  const handleAttachmentAdd = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(apiUrl("/api/upload/file"), {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!res.ok) continue;

        const uploaded: UploadedFile = await res.json();
        const attachment: PromptInputAttachment & { fileRef: UploadedFile } = {
          id: uploaded.id,
          fileName: uploaded.name,
          fileSize: uploaded.size,
          fileType: uploaded.type,
          fileRef: uploaded,
        };
        setAttachments((prev) => [...prev, attachment]);
      } catch {
        // upload failed silently
      }
    }
  }, []);

  const handleAttachmentRemove = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSendMessage = (content: string) => {
    if (!activeConversationId) return;

    // Append file references as markdown links if there are attachments
    let finalContent = content;
    if (attachments.length > 0) {
      const links = attachments.map(
        (a) => `[${a.fileRef.name}](${apiUrl(`/api/files/${a.fileRef.id}/download`)})`,
      );
      finalContent = finalContent + "\n\n" + links.join("\n");
      setAttachments([]);
    }

    if (isAIConversation) {
      agentChat.sendMessage(finalContent);
    } else {
      sendMessage.mutate({ conversationId: activeConversationId, content: finalContent });
    }
  };

  const markQuickReplyAnswered = trpc.messages.markQuickReplyAnswered.useMutation({
    onSuccess: () => {
      if (activeConversationId) {
        utils.messages.list.invalidate({ conversationId: activeConversationId });
      }
    },
  });

  const handleQuickReply = (messageId: string, option: string) => {
    if (!activeConversationId) return;
    markQuickReplyAnswered.mutate({ messageId });
    sendMessage.mutate({ conversationId: activeConversationId, content: option });
  };

  const handleConversationSelect = (id: string) => {
    setActiveConversationId(id);
    markRead.mutate({ id });
  };

  const handleSetAgent = (agentId: string | null) => {
    if (!activeConversationId) return;
    setAgentMut.mutate({ conversationId: activeConversationId, agentId });
  };

  return (
    <>
    <ChatScreen
      conversations={conversations}
      messages={messages}
      activeConversationId={activeConversationId}
      workspaceName={workspaceName}
      onConversationSelect={handleConversationSelect}
      onSendMessage={handleSendMessage}
      isTyping={isTyping}
      agents={agentOptions}
      activeAgent={activeAgent}
      onSetAgent={handleSetAgent}
      tasks={tasks}
      onCancelTask={(id) => cancelTask.mutate({ id })}
      onRetryTask={(id) => retryTask.mutate({ id })}
      onViewTaskLogs={() => onNavigate?.("tasks")}
      onTaskClick={() => onNavigate?.("tasks")}
      onPinMessage={(id) => pinMessage.mutate({ messageId: id })}
      onStarMessage={(id) => starMessage.mutate({ messageId: id })}
      onDeleteForEveryone={(ids) => deleteForEveryone.mutate({ messageIds: ids })}
      onDeleteForMe={(ids) => deleteForMe.mutate({ messageIds: ids })}
      onReact={(messageId, emoji) => reactMessage.mutate({ messageId, emoji })}
      onForwardMessages={(ids, recipientIds) => forwardMessages.mutate({ messageIds: ids, recipientConversationIds: recipientIds })}
      onTranscriptionEdit={(messageId, newText) => editTranscription.mutate({ messageId, transcription: newText })}
      onPin={(id) => pinConversation.mutate({ id })}
      onFavorite={(id) => favoriteConversation.mutate({ id })}
      onMute={(id) => muteConversation.mutate({ id })}
      onNewGroup={() => {
        setSelectedMembers([]);
        setGroupName("");
        setMemberSearch("");
        setGroupStep("members");
      }}
      promptAttachments={attachments}
      onAttachmentAdd={handleAttachmentAdd}
      onAttachmentRemove={handleAttachmentRemove}
      onInviteMember={() => onNavigate?.("settings")}
    />

    {/* Group Creation Dialog */}
    {groupStep && (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
        onClick={() => setGroupStep(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            width: 400,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {groupStep === "members" && (
            <>
              {/* Header */}
              <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setGroupStep(null)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--text-muted)" }}>
                  <X size={20} />
                </button>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Add group members</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {selectedMembers.length > 0 ? `${selectedMembers.length} selected` : "Select users and agents"}
                  </div>
                </div>
              </div>

              {/* Selected chips */}
              {selectedMembers.length > 0 && (
                <div style={{ padding: "8px 16px", display: "flex", flexWrap: "wrap", gap: 6, borderBottom: "1px solid var(--border)" }}>
                  {selectedMembers.map((m) => (
                    <span
                      key={m.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px 3px 4px",
                        background: "var(--accent-light)",
                        border: "1px solid var(--accent-border)",
                        borderRadius: 16,
                        fontSize: 12,
                        color: "var(--accent)",
                      }}
                    >
                      <Avatar name={m.name} size="sm" />
                      {m.name}
                      <button
                        onClick={() => setSelectedMembers((prev) => prev.filter((x) => x.id !== m.id))}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--accent)" }}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search */}
              <div style={{ padding: "8px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface-2)", borderRadius: 6, padding: "6px 10px", border: "1px solid var(--border)" }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input
                    autoFocus
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search name..."
                    style={{ background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 13, width: "100%", fontFamily: "inherit" }}
                  />
                </div>
              </div>

              {/* Member list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 0 8px" }}>
                {/* Agents section */}
                {serverAgents.length > 0 && (
                  <>
                    <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Agents
                    </div>
                    {serverAgents
                      .filter((a) => !memberSearch || a.name.toLowerCase().includes(memberSearch.toLowerCase()))
                      .map((agent) => {
                        const isSelected = selectedMembers.some((m) => m.id === agent.id);
                        return (
                          <button
                            key={agent.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedMembers((prev) => prev.filter((m) => m.id !== agent.id));
                              } else {
                                setSelectedMembers((prev) => [...prev, { id: agent.id, name: agent.name, type: "agent" }]);
                              }
                            }}
                            style={{
                              width: "100%",
                              padding: "8px 16px",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              textAlign: "left",
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)" }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none" }}
                          >
                            <div style={{
                              width: 36, height: 36, borderRadius: "50%",
                              background: "linear-gradient(135deg, #EA580C, #C4490A)",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <Bot size={16} color="#fff" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{agent.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>AI Agent</div>
                            </div>
                            {isSelected && (
                              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Check size={14} color="#fff" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                  </>
                )}

                {/* Users section */}
                <div style={{ padding: "8px 16px 4px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Members
                </div>
                {serverUsers
                  .filter((u) => u.id !== currentUserId)
                  .filter((u) => !memberSearch || u.name.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((u) => {
                    const isSelected = selectedMembers.some((m) => m.id === u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedMembers((prev) => prev.filter((m) => m.id !== u.id));
                          } else {
                            setSelectedMembers((prev) => [...prev, { id: u.id, name: u.name, type: "user" }]);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 16px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)" }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "none" }}
                      >
                        <Avatar name={u.name} size="sm" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{u.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</div>
                        </div>
                        {isSelected && (
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Check size={14} color="#fff" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                {serverUsers.filter((u) => u.id !== currentUserId).length === 0 && (
                  <div style={{ padding: "16px", textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                    No other members yet. Invite members first.
                  </div>
                )}
              </div>

              {/* Next button */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setGroupStep("details")}
                  disabled={selectedMembers.length === 0}
                  style={{
                    padding: "8px 20px",
                    background: selectedMembers.length > 0 ? "var(--accent)" : "var(--surface-2)",
                    color: selectedMembers.length > 0 ? "#fff" : "var(--text-muted)",
                    border: "none",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: selectedMembers.length > 0 ? "pointer" : "default",
                    fontFamily: "inherit",
                  }}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {groupStep === "details" && (
            <>
              {/* Header */}
              <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setGroupStep("members")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--text-muted)" }}>
                  <ArrowLeft size={20} />
                </button>
                <div style={{ fontWeight: 600, fontSize: 15 }}>New group</div>
              </div>

              {/* Group icon placeholder */}
              <div style={{ display: "flex", justifyContent: "center", padding: "24px 0 16px" }}>
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "var(--surface-2)", border: "2px dashed var(--border)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  color: "var(--text-muted)", fontSize: 10, gap: 4, cursor: "pointer",
                }}>
                  <ImagePlus size={20} />
                  Group icon
                </div>
              </div>

              {/* Group name input */}
              <div style={{ padding: "0 24px 16px" }}>
                <input
                  autoFocus
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && groupName.trim()) {
                      createConversation.mutate({
                        name: groupName.trim(),
                        type: "channel",
                        memberIds: selectedMembers.filter((m) => m.type === "user").map((m) => m.id),
                      });
                      setGroupStep(null);
                    }
                  }}
                  placeholder="Group name"
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    border: "none",
                    borderBottom: "2px solid var(--accent)",
                    fontSize: 15,
                    fontFamily: "inherit",
                    color: "var(--text)",
                    background: "none",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Selected members preview */}
              <div style={{ padding: "0 24px 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {selectedMembers.length} member{selectedMembers.length !== 1 ? "s" : ""}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 16px", display: "flex", flexWrap: "wrap", gap: 12 }}>
                {selectedMembers.map((m) => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 56 }}>
                    {m.type === "agent" ? (
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "linear-gradient(135deg, #EA580C, #C4490A)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Bot size={18} color="#fff" />
                      </div>
                    ) : (
                      <Avatar name={m.name} size="md" />
                    )}
                    <span style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", width: "100%", whiteSpace: "nowrap" }}>
                      {m.name.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Create button */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "center" }}>
                <button
                  onClick={() => {
                    const name = groupName.trim() || selectedMembers.map((m) => m.name.split(" ")[0]).join(", ");
                    createConversation.mutate({
                      name,
                      type: "channel",
                      memberIds: selectedMembers.filter((m) => m.type === "user").map((m) => m.id),
                    });
                    setGroupStep(null);
                  }}
                  style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "var(--accent)",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(234,88,12,0.3)",
                  }}
                >
                  <Check size={24} color="#fff" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    )}
    </>
  );
}
