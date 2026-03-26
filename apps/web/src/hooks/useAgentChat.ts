import { useState, useRef, useCallback, useEffect } from "react";

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
  // Create a human-readable label from tool name and key input params
  const name = toolName.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim();
  if (input) {
    // Show the most relevant input param as context
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

export function useAgentChat({ conversationId, agentName = "Eric" }: UseAgentChatOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingTextRef = useRef("");
  const toolInvocationsRef = useRef<ToolInvocation[]>([]);
  const streamingMsgIdRef = useRef<string | null>(null);
  const reasoningStartRef = useRef<number | null>(null);

  // Reset when conversation changes
  useEffect(() => {
    setMessages([]);
    setSessionId(null);
    streamingTextRef.current = "";
    toolInvocationsRef.current = [];
    streamingMsgIdRef.current = null;
    reasoningStartRef.current = null;
    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, [conversationId]);

  const buildQueueAndReasoning = useCallback(() => {
    const tools = toolInvocationsRef.current;
    const approvalTools = tools.filter((t) => t.state === "approval-requested");
    const workTools = tools.filter((t) => t.state !== "approval-requested");

    if (workTools.length === 0) {
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
    const elapsed = reasoningStartRef.current
      ? Math.floor((Date.now() - reasoningStartRef.current) / 1000)
      : 0;

    const reasoning = {
      content: isToolsRunning
        ? `Searching and processing... (${completedCount}/${workTools.length} steps)`
        : `Completed ${workTools.length} steps in ${elapsed}s`,
      isStreaming: isToolsRunning,
    };

    return { reasoning, queue, approvalTools };
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
                // Only pass approval-required tools as toolInvocations
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
      streamingTextRef.current = "";
      toolInvocationsRef.current = [];
      reasoningStartRef.current = null;
      const aiMsgId = crypto.randomUUID();
      streamingMsgIdRef.current = aiMsgId;

      // Add empty AI message that will be updated via streaming
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, role: "ai", content: "", author: agentName },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt: prompt.trim(), conversationId }),
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
              handleSSEEvent(event, aiMsgId);
            } catch {
              // Skip malformed events
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Agent chat error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: "An error occurred. Please try again." }
              : m,
          ),
        );
      } finally {
        abortRef.current = null;
        streamingMsgIdRef.current = null;
        setIsStreaming(false);
      }
    },
    [conversationId, isStreaming, agentName],
  );

  const handleSSEEvent = useCallback(
    (event: SSEEvent, aiMsgId: string) => {
      switch (event.type) {
        case "session_init":
          setSessionId(event.sessionId as string);
          break;

        case "text_delta":
          streamingTextRef.current += event.delta as string;
          updateMessage(aiMsgId);
          break;

        case "tool_start":
          // Start reasoning timer on first tool
          if (reasoningStartRef.current === null) {
            reasoningStartRef.current = Date.now();
          }
          toolInvocationsRef.current.push({
            id: event.toolUseId as string,
            toolName: event.toolName as string,
            state: "input-available",
            input: event.input as Record<string, unknown>,
          });
          updateMessage(aiMsgId);
          break;

        case "tool_result": {
          const idx = toolInvocationsRef.current.findIndex(
            (t) => t.id === event.toolUseId,
          );
          if (idx >= 0) {
            toolInvocationsRef.current[idx] = {
              ...toolInvocationsRef.current[idx],
              state: (event.isError as boolean) ? "output-error" : "output-available",
              output: typeof event.result === "string" ? event.result : JSON.stringify(event.result),
            };
            updateMessage(aiMsgId);
          }
          break;
        }

        case "tool_confirmation_required":
          toolInvocationsRef.current.push({
            id: event.toolUseId as string,
            toolName: event.toolName as string,
            state: "approval-requested",
            input: event.input as Record<string, unknown>,
          });
          updateMessage(aiMsgId);
          break;

        case "error":
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, content: m.content || `Error: ${event.message}` }
                : m,
            ),
          );
          break;
      }
    },
    [updateMessage],
  );

  const approveToolCall = useCallback(
    async (toolUseId: string, allow: boolean) => {
      try {
        await fetch("/api/chat/confirm", {
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
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

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
