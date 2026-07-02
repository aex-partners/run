import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, ArrowLeft, Search, Bot, Check, ImagePlus } from "lucide-react";
import { useIsMobile } from "../../shared/hooks/useIsMobile";
import { trpc } from "../../platform/trpc";
import { apiUrl } from "../../platform/api";
import { formatRelativeTime, formatTime } from "../../shared/lib/formatTime";
import { ChatScreen } from "./ChatScreen/ChatScreen";
import { useWS } from "../../app/providers/WebSocketProvider";
import { useAuth } from "../auth/useAuth";
import { useAgentChat } from "./useAgentChat";
import { Avatar } from "../../shared/ui/Avatar/Avatar";
import { DEFAULT_AGENT_NAME } from "@aex/shared";
import type { Section } from "../workspace/AppShell/AppShell";
import type { Conversation, Contact } from "./ConversationList/ConversationList";
import type { ThreadMessage } from "./MessageThread/MessageThread";
import type { PromptInputAttachment } from "./PromptInput/PromptInput";
import type { Task } from "../tasks/TaskList/TaskList";

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

/** Format milliseconds as "m:ss" (matches AudioPlayer's duration string). */
function formatClock(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Decode a recorded blob into ~40 normalized (0..1) RMS bars for the waveform UI. */
async function computeWaveform(blob: Blob): Promise<number[]> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const raw = audioBuffer.getChannelData(0);
    const BARS = 40;
    const block = Math.floor(raw.length / BARS) || 1;
    const bars: number[] = [];
    let max = 0;
    for (let i = 0; i < BARS; i++) {
      let sum = 0;
      const start = i * block;
      for (let j = 0; j < block; j++) {
        const v = raw[start + j] || 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / block);
      bars.push(rms);
      if (rms > max) max = rms;
    }
    return bars.map((b) => (max > 0 ? Math.min(1, b / max) : 0));
  } finally {
    void ctx.close();
  }
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
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConversationId = searchParams.get("c") ?? undefined;
  const setActiveConversationId = useCallback(
    (id: string | undefined) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("c", id);
          else next.delete("c");
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );
  const [groupStep, setGroupStep] = useState<null | "members" | "details">(null);
  const [selectedMembers, setSelectedMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [attachments, setAttachments] = useState<(PromptInputAttachment & { fileRef: UploadedFile })[]>([]);
  const [micState, setMicState] = useState<"idle" | "recording" | "processing">("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  // Mic capture refs. micStreamRef holds the live getUserMedia stream so a
  // cancel-during-warmup can stop it; micArmedRef tracks "session active"
  // (warming up OR recording) so the toggle works before the icon flips;
  // micWarmupRef holds the warmup timer so an early click cancels cleanly.
  const micStreamRef = useRef<MediaStream | null>(null);
  const micArmedRef = useRef(false);
  const micWarmupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handles the "Ask AI about files..." input from the Files sidebar, which
  // navigates here with a ?q=<question> param. We create a fresh AI conversation
  // and send the question as its first message once that conversation is active.
  const aiQueryFiredRef = useRef(false);
  const pendingAiQueryRef = useRef<string | null>(null);
  const createdAiConvIdRef = useRef<string | null>(null);

  const utils = trpc.useUtils();
  const { typingConversations } = useWS();
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
  const { data: members = [] } = trpc.users.listAssignable.useQuery();
  const ensureDm = trpc.conversations.ensureDm.useMutation({
    onSuccess: (data) => {
      utils.conversations.list.invalidate();
      setActiveConversationId(data.id);
    },
  });
  const ensureEric = trpc.conversations.ensureEric.useMutation({
    onSuccess: (data) => {
      utils.conversations.list.invalidate();
      setActiveConversationId(data.id);
    },
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

  const contacts = useMemo<Contact[]>(() => {
    const people: Contact[] = members
      .filter((m) => m.id !== currentUserId)
      .map((m) => ({
        kind: "user" as const,
        id: m.id,
        name: m.name ?? m.email,
        subtitle: m.email,
        image: m.image ?? undefined,
      }));
    return [
      ...people,
      { kind: "eric" as const, id: "eric", name: "Eric", subtitle: "AI assistant" },
    ];
  }, [members, currentUserId]);

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
  const deleteConversation = trpc.conversations.delete.useMutation({
    onSuccess: (_data, vars) => {
      utils.conversations.list.invalidate();
      if (activeConversationId === vars.id) setActiveConversationId(undefined);
    },
  });
  const sendAudio = trpc.messages.sendAudio.useMutation({
    onSuccess: () => {
      if (activeConversationId) utils.messages.list.invalidate({ conversationId: activeConversationId });
      utils.conversations.list.invalidate();
    },
  });

  const createConversation = trpc.conversations.create.useMutation({
    onSuccess: (data) => {
      utils.conversations.list.invalidate();
      setActiveConversationId(data.id);
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
        // An AI conversation is a DM with the agent (no other users). When it has
        // no custom title yet, show the agent's name (default "Eric") instead of a
        // placeholder, so the sidebar reads as a chat with Eric.
        const isAi = c.type === "ai";
        const displayName =
          c.name ?? (isAi ? agent?.name ?? DEFAULT_AGENT_NAME : "Untitled");
        return {
          id: c.id,
          name: displayName,
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

  // Auto-select first conversation (Eric) if none is active (desktop only).
  // On mobile we show the conversation list first, master-detail style.
  useEffect(() => {
    if (!isMobile && !activeConversationId && serverConversations.length > 0) {
      const first = serverConversations[0];
      setActiveConversationId(first.id);
      markRead.mutate({ id: first.id });
    }
  }, [serverConversations, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Read the ?q=<question> param once on mount (set by the Files sidebar AI input).
  // Create a new AI conversation; the per-call onSuccess records its id so the
  // send effect below can fire the question into the right conversation.
  useEffect(() => {
    if (aiQueryFiredRef.current) return;
    aiQueryFiredRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const query = params.get("q")?.trim();
    if (!query) return;

    // Strip the param so a refresh doesn't re-send the question.
    params.delete("q");
    const newSearch = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash,
    );

    pendingAiQueryRef.current = query;
    createConversation.mutate(
      { type: "ai", name: query.length > 60 ? query.slice(0, 60) : query },
      { onSuccess: (data) => { createdAiConvIdRef.current = data.id; } },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Once the conversation we created for the Files query is active, send the
  // pending question through the normal AI send flow, then clear the refs.
  useEffect(() => {
    if (
      !pendingAiQueryRef.current ||
      !createdAiConvIdRef.current ||
      activeConversationId !== createdAiConvIdRef.current
    ) {
      return;
    }
    const query = pendingAiQueryRef.current;
    pendingAiQueryRef.current = null;
    createdAiConvIdRef.current = null;
    agentChat.sendMessage(query);
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial messages from DB into agent chat when conversation changes
  useEffect(() => {
    if (!isAIConversation || !serverMessages?.items) return;
    const dbMessages = [...serverMessages.items].reverse().map((m) => {
      const raw = m as typeof m & { metadata?: string | null };
      let reminder: { taskId: string; title: string } | undefined;
      if (raw.metadata) {
        try {
          const meta = JSON.parse(raw.metadata) as { reminder?: { taskId: string; title: string } };
          if (meta?.reminder) reminder = { taskId: meta.reminder.taskId, title: meta.reminder.title };
        } catch {
          // skip malformed metadata
        }
      }
      return {
        id: m.id,
        role: m.role as "user" | "ai" | "system",
        content: m.content,
        author: m.authorName ?? (m.role === "user" ? "You" : activeAgent?.name ?? "Eric"),
        reminder,
      };
    });
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
        reminder: m.reminder,
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
        replyTo?: { id: string; author: string; content: string };
        attachments?: Array<{ fileId: string; name: string; mimeType: string; size: string; kind: "image" | "file" }>;
        reminder?: { taskId: string; title: string };
      } | undefined;
      if (raw.metadata) {
        try {
          metadata = JSON.parse(raw.metadata as string);
        } catch {
          // skip
        }
      }

      const isOwn = (m as typeof m & { authorId?: string | null }).authorId === currentUserId;
      const msg: ThreadMessage = {
        id: m.id,
        role: m.role as ThreadMessage["role"],
        content: m.content,
        author: m.authorName ?? "System",
        timestamp: formatTime(typeof m.createdAt === "string" ? m.createdAt : (m.createdAt as unknown as Date).toISOString()),
        pinned: (m.pinned as unknown) === 1,
        starred: (m.starred as unknown) === 1,
        isOwn,
        // Single "sent" tick on own messages (delivered/read is a later phase)
        readStatus: isOwn ? "sent" : undefined,
        replyTo: metadata?.replyTo
          ? { author: metadata.replyTo.author, content: metadata.replyTo.content }
          : undefined,
        // Structured attachments served via the authenticated file ACL.
        // Image kind renders inline; other files render as a chip.
        attachments: metadata?.attachments?.length
          ? metadata.attachments.map((a) => ({
              id: a.fileId,
              fileName: a.name,
              fileSize: a.size,
              fileType: a.mimeType,
              imageUrl:
                a.kind === "image" ? apiUrl(`/api/files/${a.fileId}/raw`) : undefined,
            }))
          : undefined,
      };

      if (m.reactions) {
        try {
          const raw: { emoji: string; userId: string }[] = JSON.parse(m.reactions as unknown as string);
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
          waveform: m.audioWaveform ? JSON.parse(m.audioWaveform as unknown as string) : undefined,
          transcription: m.audioTranscription as string | undefined,
          transcriptionEdited: (m.audioTranscriptionEdited as unknown) === 1,
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

      if (metadata?.reminder) {
        msg.reminder = { taskId: metadata.reminder.taskId, title: metadata.reminder.title };
      }

      return msg;
    });

    return mapped;
  }, [isAIConversation, agentChat.messages, serverMessages, activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const handleSendMessage = (
    content: string,
    replyTo?: { id: string; author: string; content: string },
  ) => {
    if (!activeConversationId) return;

    const pending = attachments as Array<PromptInputAttachment & { fileRef: UploadedFile }>;

    if (isAIConversation) {
      // The agent handler only sees a prompt string, so attachments must be
      // inlined as markdown links for the AI path.
      let finalContent = content;
      if (pending.length > 0) {
        const links = pending.map(
          (a) => `[${a.fileRef.name}](${apiUrl(`/api/files/${a.fileRef.id}/download`)})`,
        );
        finalContent = finalContent + "\n\n" + links.join("\n");
      }
      setAttachments([]);
      agentChat.sendMessage(finalContent);
    } else {
      // Human DM/channel: send structured attachments. The backend grants
      // each member read access via the file ACL and serves images inline.
      const structured = pending.map((a) => ({
        fileId: a.fileRef.id,
        name: a.fileRef.name,
        mimeType: a.fileRef.mimeType,
        size: a.fileRef.size,
        kind: (a.fileRef.mimeType.startsWith("image/") ? "image" : "file") as
          | "image"
          | "file",
      }));
      setAttachments([]);
      sendMessage.mutate({
        conversationId: activeConversationId,
        content,
        replyTo,
        attachments: structured.length ? structured : undefined,
      });
    }
  };

  const handleMicClick = useCallback(async () => {
    if (!activeConversationId) return;

    // A session is active (warming up or recording). Clicking again ends it.
    if (micArmedRef.current) {
      // Still in the warmup window: capture never started, so cancel cleanly
      // instead of stopping a recorder that has no data.
      if (micWarmupRef.current != null) {
        clearTimeout(micWarmupRef.current);
        micWarmupRef.current = null;
        micStreamRef.current?.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        mediaRecorderRef.current = null;
        micArmedRef.current = false;
        setMicState("idle");
        return;
      }
      mediaRecorderRef.current?.stop();
      return;
    }
    if (micState === "processing") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks: Blob[] = [];
      // Set when capture actually begins (after the warmup), so duration and
      // the recorded audio exclude the silent device ramp-up.
      let startedAt = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        micStreamRef.current = null;
        mediaRecorderRef.current = null;
        micArmedRef.current = false;
        setMicState("processing");
        try {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const durationMs = Date.now() - startedAt;
          const duration = formatClock(durationMs);
          const waveform = await computeWaveform(blob).catch(() => undefined);

          const fd = new FormData();
          fd.append("audio", blob, "voice.webm");
          fd.append("duration", String(Math.round(durationMs / 1000)));
          if (waveform) fd.append("waveform", JSON.stringify(waveform));

          // Upload the audio and transcribe it (Whisper) concurrently. A failed
          // transcription must not block sending the voice message.
          const transcribeFd = new FormData();
          transcribeFd.append("audio", blob, "voice.webm");

          const [res, transcription] = await Promise.all([
            fetch(apiUrl("/api/upload/audio"), {
              method: "POST",
              body: fd,
              credentials: "include",
            }),
            fetch(apiUrl("/api/voice/transcribe"), {
              method: "POST",
              body: transcribeFd,
              credentials: "include",
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((d: { text?: string } | null) => d?.text?.trim() || undefined)
              .catch(() => undefined),
          ]);

          if (res.ok) {
            const data: { url: string } = await res.json();
            sendAudio.mutate({
              conversationId: activeConversationId,
              audioUrl: data.url,
              duration,
              waveform,
              transcription,
            });
          }
        } finally {
          setMicState("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      micArmedRef.current = true;
      // Warm the mic before capturing: the device needs ~hundreds of ms after
      // it opens to deliver real audio (AGC ramp), so the first moments are
      // silent. Start capture and flip the icon to "recording" together once
      // warm, so the icon only changes when the mic is actually recording.
      micWarmupRef.current = setTimeout(() => {
        micWarmupRef.current = null;
        // Guard against a cancel that landed between scheduling and firing.
        if (!micArmedRef.current || mediaRecorderRef.current !== recorder) return;
        startedAt = Date.now();
        recorder.start();
        setMicState("recording");
      }, 400);
    } catch {
      // Mic permission denied or unsupported: reset to idle.
      micArmedRef.current = false;
      micStreamRef.current = null;
      setMicState("idle");
    }
  }, [activeConversationId, micState, sendAudio]);

  // Release the mic on unmount: clear a pending warmup and stop any live tracks
  // so the device doesn't stay open after leaving the page mid-recording.
  useEffect(() => {
    return () => {
      if (micWarmupRef.current != null) clearTimeout(micWarmupRef.current);
      micStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
      isMobile={isMobile}
      onBack={() => setActiveConversationId(undefined)}
      onSendMessage={handleSendMessage}
      currentUser={user.name}
      micState={micState}
      onMicClick={handleMicClick}
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
      onDeleteConversation={(id) => deleteConversation.mutate({ id })}
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
      contacts={contacts}
      onOpenDm={(peerUserId) => ensureDm.mutate({ peerUserId })}
      onOpenEric={() => ensureEric.mutate()}
      onNewConversation={() => createConversation.mutate({ type: "ai" })}
      onManageUsers={() => onNavigate?.("settings")}
      onQueryData={() => onNavigate?.("database")}
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
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{t('chatPage.group.addMembers')}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {selectedMembers.length > 0 ? t('chatPage.group.selectedCount', { count: selectedMembers.length }) : t('chatPage.group.selectUsersAndAgents')}
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
                    placeholder={t('chatPage.group.searchNamePlaceholder')}
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
                      {t('agents.title')}
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
                              background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              <Bot size={16} color="#fff" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{agent.name}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t('chatPage.group.aiAgent')}</div>
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
                  {t('chatPage.group.members')}
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
                    {t('chatPage.group.noOtherMembers')}
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
                  {t('chatPage.group.next')}
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
                <div style={{ fontWeight: 600, fontSize: 15 }}>{t('chatPage.group.newGroup')}</div>
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
                  {t('chatPage.group.groupIcon')}
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
                  placeholder={t('chatPage.group.groupNamePlaceholder')}
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
                {t('chatPage.group.memberCount', { count: selectedMembers.length })}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 16px", display: "flex", flexWrap: "wrap", gap: 12 }}>
                {selectedMembers.map((m) => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 56 }}>
                    {m.type === "agent" ? (
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "linear-gradient(135deg, var(--accent), var(--accent-hover))",
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
                    boxShadow: "0 2px 8px rgba(10,10,10,0.3)",
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
