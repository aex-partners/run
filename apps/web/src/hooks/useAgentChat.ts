import { useState, useRef, useCallback, useEffect } from "react";
import { useStreamingStore } from "../stores/streaming-store";
import { apiUrl } from "../lib/api";

interface SSEEvent {
  type: string;
  [key: string]: unknown;
}

interface ToolInvocation {
  id: string;
  toolName: string;
  state: "input-available" | "output-available" | "output-error" | "approval-requested";
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
}

interface QueueItem {
  id: string;
  content: string;
  completed: boolean;
}

interface QueueSection {
  title: string;
  items: QueueItem[];
}

interface AgentMessage {
  id: string;
  role: "user" | "ai";
  content: string;
  author: string;
  toolInvocations?: ToolInvocation[];
  reasoning?: {
    content: string;
    isStreaming: boolean;
  };
  queue?: {
    sections: QueueSection[];
  };
}

interface UseAgentChatOptions {
  conversationId: string;
  agentName?: string;
}

function formatToolLabel(toolName: string, input?: Record<string, unknown>): string {
  const name = toolName.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
  if (input) {
    const contextKey = Object.keys(input).find((k) =>
      ["query", "url", "search", "name", "title", "keyword", "term", "q"].includes(k.toLowerCase()),
    );
    if (contextKey && typeof input[contextKey] === "string") {
      const val = input[contextKey] as string;
      return `${name}: ${val.length > 60 ? val.slice(0, 57) + "..." : val}`;
    }
  }
  return name;
}

function buildQueueAndReasoningFromRefs(
  tools: ToolInvocation[],
  thinkingText: string,
  currentlyStreaming: boolean,
  reasoningStart: number | null,
) {
  const approvalTools = tools.filter((t) => t.state === "approval-requested");
  const workTools = tools.filter((t) => t.state !== "approval-requested");

  if (workTools.length === 0) {
    if (thinkingText || currentlyStreaming) {
      return {
        reasoning: { content: thinkingText, isStreaming: currentlyStreaming },
        queue: undefined,
        approvalTools,
      };
    }
    return { reasoning: undefined, queue: undefined, approvalTools };
  }

  const completedCount = workTools.filter(
    (t) => t.state === "output-available" || t.state === "output-error",
  ).length;
  const allDone = completedCount === workTools.length;

  const items: QueueItem[] = workTools.map((t) => ({
    id: t.id,
    content: formatToolLabel(t.toolName, t.input),
    completed: t.state === "output-available" || t.state === "output-error",
  }));

  const queue: { sections: QueueSection[] } = {
    sections: [
      {
        title: `Executing${allDone ? ` (${completedCount}/${workTools.length} done)` : ` (${completedCount}/${workTools.length})`}`,
        items,
      },
    ],
  };

  const isToolsRunning = !allDone;
  const elapsed = reasoningStart
    ? Math.floor((Date.now() - reasoningStart) / 1000)
    : 0;

  const reasoning = {
    content: thinkingText
      || (isToolsRunning
        ? `Searching and processing... (${completedCount}/${workTools.length} steps)`
        : `Completed ${workTools.length} steps in ${elapsed}s`),
    isStreaming: isToolsRunning,
  };

  return { reasoning, queue, approvalTools };
}

// Track active SSE connections by conversationId so they survive conversation switches
const activeConnections = new Map<string, AbortController>();

export function useAgentChat({ conversationId, agentName = "Eric" }: UseAgentChatOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const streamingTextRef = useRef("");
  const toolInvocationsRef = useRef<ToolInvocation[]>([]);
  const streamingMsgIdRef = useRef<string | null>(null);
  const reasoningStartRef = useRef<number | null>(null);
  const thinkingTextRef = useRef("");
  const isStreamingRef = useRef(false);

  // Track which conversationId this hook instance is currently viewing
  const activeConvIdRef = useRef(conversationId);
  activeConvIdRef.current = conversationId;

  const store = useStreamingStore;

  // When conversationId changes: restore from global store or reset
  useEffect(() => {
    const stream = store.getState().getStream(conversationId);
    if (stream && stream.isStreaming) {
      // Active background stream exists, restore to local state
      streamingTextRef.current = stream.text;
      toolInvocationsRef.current = [...stream.toolInvocations] as ToolInvocation[];
      streamingMsgIdRef.current = stream.messageId;
      reasoningStartRef.current = stream.reasoningStart;
      thinkingTextRef.current = stream.thinkingText;
      isStreamingRef.current = true;
      setIsStreaming(true);
      setSessionId(stream.sessionId);

      // Rebuild messages from store
      const restored: AgentMessage[] = stream.userMessages.map((m) => ({
        id: m.id,
        role: "user" as const,
        content: m.content,
        author: m.author,
      }));

      if (stream.messageId) {
        const { reasoning, queue, approvalTools } = buildQueueAndReasoningFromRefs(
          stream.toolInvocations as ToolInvocation[],
          stream.thinkingText,
          true,
          stream.reasoningStart,
        );
        restored.push({
          id: stream.messageId,
          role: "ai",
          content: stream.text,
          author: stream.agentName,
          reasoning,
          queue,
          toolInvocations: approvalTools.length > 0 ? approvalTools : undefined,
        });
      }

      setMessages(restored);
    } else {
      // No active stream, reset
      setMessages([]);
      setSessionId(null);
      streamingTextRef.current = "";
      toolInvocationsRef.current = [];
      streamingMsgIdRef.current = null;
      reasoningStartRef.current = null;
      thinkingTextRef.current = "";
      isStreamingRef.current = false;
      setIsStreaming(false);
    }
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to global store changes to update local state when background streams progress
  useEffect(() => {
    const unsub = store.subscribe((state, prevState) => {
      const currentConvId = activeConvIdRef.current;
      const stream = state.streams.get(currentConvId);
      const prevStream = prevState.streams.get(currentConvId);

      // Only react if the stream for our active conversation changed
      if (stream === prevStream) return;

      if (stream && stream.isStreaming) {
        // Update local refs
        streamingTextRef.current = stream.text;
        toolInvocationsRef.current = [...stream.toolInvocations] as ToolInvocation[];
        thinkingTextRef.current = stream.thinkingText;
        reasoningStartRef.current = stream.reasoningStart;

        if (!isStreamingRef.current) {
          isStreamingRef.current = true;
          setIsStreaming(true);
        }

        // Update the AI message content
        if (stream.messageId) {
          const { reasoning, queue, approvalTools } = buildQueueAndReasoningFromRefs(
            stream.toolInvocations as ToolInvocation[],
            stream.thinkingText,
            true,
            stream.reasoningStart,
          );
          setMessages((prev) =>
            prev.map((m) =>
              m.id === stream.messageId
                ? {
                    ...m,
                    content: stream.text,
                    reasoning,
                    queue,
                    toolInvocations: approvalTools.length > 0 ? approvalTools : undefined,
                  }
                : m,
            ),
          );
        }
      } else if (!stream && prevStream?.isStreaming) {
        // Stream was cleared (completed), stop local streaming state
        isStreamingRef.current = false;
        setIsStreaming(false);
        streamingMsgIdRef.current = null;
      }
    });

    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildQueueAndReasoning = useCallback(() => {
    return buildQueueAndReasoningFromRefs(
      toolInvocationsRef.current,
      thinkingTextRef.current,
      isStreamingRef.current,
      reasoningStartRef.current,
    );
  }, []);

  const updateMessage = useCallback(
    (aiMsgId: string) => {
      const { reasoning, queue, approvalTools } = buildQueueAndReasoning();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content: streamingTextRef.current,
                reasoning,
                queue,
                toolInvocations: approvalTools.length > 0 ? approvalTools : undefined,
              }
            : m,
        ),
      );
    },
    [buildQueueAndReasoning],
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!conversationId || !prompt.trim() || isStreaming) return;

      // Capture conversationId at send time for the entire SSE lifecycle
      const targetConvId = conversationId;

      // Add user message optimistically
      const userMsgId = crypto.randomUUID();
      const userMsg: AgentMessage = {
        id: userMsgId,
        role: "user",
        content: prompt.trim(),
        author: "You",
      };
      setMessages((prev) => [...prev, userMsg]);

      // Start streaming
      setIsStreaming(true);
      isStreamingRef.current = true;
      streamingTextRef.current = "";
      toolInvocationsRef.current = [];
      reasoningStartRef.current = null;
      thinkingTextRef.current = "";
      const aiMsgId = crypto.randomUUID();
      streamingMsgIdRef.current = aiMsgId;

      // Collect all user messages for store persistence
      const allUserMessages: Array<{ id: string; content: string; author: string }> = [];
      setMessages((prev) => {
        for (const m of prev) {
          if (m.role === "user") {
            allUserMessages.push({ id: m.id, content: m.content, author: m.author });
          }
        }
        return prev;
      });

      // Initialize global store for this conversation
      store.getState().updateStream(targetConvId, {
        text: "",
        thinkingText: "",
        toolInvocations: [],
        isStreaming: true,
        messageId: aiMsgId,
        reasoningStart: null,
        agentName,
        userMessages: allUserMessages,
        sessionId: null,
      });

      // Add empty AI message
      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "ai",
          content: "",
          author: agentName,
          reasoning: { content: "", isStreaming: true },
        },
      ]);

      // Abort existing connection for this conversation if any
      const existingController = activeConnections.get(targetConvId);
      if (existingController) {
        existingController.abort();
        activeConnections.delete(targetConvId);
      }

      const controller = new AbortController();
      activeConnections.set(targetConvId, controller);

      // Local refs for the SSE handler closure (independent of hook re-renders)
      let localText = "";
      let localThinking = "";
      const localTools: ToolInvocation[] = [];
      let localReasoningStart: number | null = null;
      let localSessionId: string | null = null;

      const syncToStoreLocal = () => {
        store.getState().updateStream(targetConvId, {
          text: localText,
          thinkingText: localThinking,
          toolInvocations: [...localTools],
          isStreaming: true,
          messageId: aiMsgId,
          reasoningStart: localReasoningStart,
          sessionId: localSessionId,
        });
      };

      const isActiveConversation = () => activeConvIdRef.current === targetConvId;

      const updateLocalMessage = () => {
        if (!isActiveConversation()) return;
        // Sync closure locals to refs
        streamingTextRef.current = localText;
        toolInvocationsRef.current = localTools;
        thinkingTextRef.current = localThinking;
        reasoningStartRef.current = localReasoningStart;
        updateMessage(aiMsgId);
      };

      const processEvent = (event: SSEEvent) => {
        switch (event.type) {
          case "session_init":
            localSessionId = event.sessionId as string;
            if (isActiveConversation()) {
              setSessionId(localSessionId);
            }
            syncToStoreLocal();
            break;

          case "text_delta":
            localText += event.delta as string;
            updateLocalMessage();
            syncToStoreLocal();
            break;

          case "thinking_delta":
            localThinking += event.delta as string;
            updateLocalMessage();
            syncToStoreLocal();
            break;

          case "tool_start":
            if (localReasoningStart === null) {
              localReasoningStart = Date.now();
            }
            localTools.push({
              id: event.toolUseId as string,
              toolName: event.toolName as string,
              state: "input-available",
              input: event.input as Record<string, unknown>,
            });
            updateLocalMessage();
            syncToStoreLocal();
            break;

          case "tool_result": {
            const idx = localTools.findIndex((t) => t.id === event.toolUseId);
            if (idx >= 0) {
              localTools[idx] = {
                ...localTools[idx],
                state: (event.isError as boolean) ? "output-error" : "output-available",
                output: typeof event.result === "string" ? event.result : JSON.stringify(event.result),
              };
              updateLocalMessage();
              syncToStoreLocal();
            }
            break;
          }

          case "tool_confirmation_required":
            localTools.push({
              id: event.toolUseId as string,
              toolName: event.toolName as string,
              state: "approval-requested",
              input: event.input as Record<string, unknown>,
            });
            updateLocalMessage();
            syncToStoreLocal();
            break;

          case "error":
            if (isActiveConversation()) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: m.content || `Error: ${event.message}` }
                    : m,
                ),
              );
            }
            break;
        }
      };

      try {
        const response = await fetch(apiUrl("/api/chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt: prompt.trim(), conversationId: targetConvId }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event: SSEEvent = JSON.parse(data);
              processEvent(event);
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Agent chat error:", err);
        if (isActiveConversation()) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: "An error occurred. Please try again." }
                : m,
            ),
          );
        }
        store.getState().clearStream(targetConvId);
      } finally {
        activeConnections.delete(targetConvId);

        if (isActiveConversation()) {
          isStreamingRef.current = false;
          // Sync final state to local refs
          streamingTextRef.current = localText;
          toolInvocationsRef.current = localTools;
          thinkingTextRef.current = localThinking;
          reasoningStartRef.current = localReasoningStart;
          if (streamingMsgIdRef.current) {
            updateMessage(streamingMsgIdRef.current);
          }
          streamingMsgIdRef.current = null;
          setIsStreaming(false);
        }

        // Clear from global store since streaming is complete
        store.getState().clearStream(targetConvId);
      }
    },
    [conversationId, isStreaming, agentName, updateMessage], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const approveToolCall = useCallback(
    async (toolUseId: string, allow: boolean) => {
      try {
        await fetch(apiUrl("/api/chat/confirm"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ toolUseId, allow }),
        });

        // Update tool state
        const idx = toolInvocationsRef.current.findIndex((t) => t.id === toolUseId);
        if (idx >= 0) {
          toolInvocationsRef.current[idx] = {
            ...toolInvocationsRef.current[idx],
            state: allow ? "input-available" : "output-error",
            error: allow ? undefined : "User rejected",
          };
          if (streamingMsgIdRef.current) {
            updateMessage(streamingMsgIdRef.current);
          }
        }
      } catch (err) {
        console.error("Tool approval error:", err);
      }
    },
    [updateMessage],
  );

  const stop = useCallback(() => {
    const controller = activeConnections.get(conversationId);
    if (controller) {
      controller.abort();
      activeConnections.delete(conversationId);
    }
    store.getState().clearStream(conversationId);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    isStreaming,
    sessionId,
    sendMessage,
    approveToolCall,
    stop,
    setMessages,
  };
}
