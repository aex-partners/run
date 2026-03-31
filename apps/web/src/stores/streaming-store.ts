import { create } from "zustand";

export interface StreamingToolInvocation {
  id: string;
  toolName: string;
  state: "input-available" | "output-available" | "output-error" | "approval-requested";
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
}

export interface StreamingMessage {
  text: string;
  thinkingText: string;
  toolInvocations: StreamingToolInvocation[];
  isStreaming: boolean;
  messageId: string | null;
  reasoningStart: number | null;
  agentName: string;
  userMessages: Array<{ id: string; content: string; author: string }>;
  sessionId: string | null;
}

function createEmptyStream(): StreamingMessage {
  return {
    text: "",
    thinkingText: "",
    toolInvocations: [],
    isStreaming: false,
    messageId: null,
    reasoningStart: null,
    agentName: "Eric",
    userMessages: [],
    sessionId: null,
  };
}

interface StreamingStore {
  streams: Map<string, StreamingMessage>;
  updateStream: (conversationId: string, update: Partial<StreamingMessage>) => void;
  clearStream: (conversationId: string) => void;
  getStream: (conversationId: string) => StreamingMessage | undefined;
  hasActiveStream: (conversationId: string) => boolean;
}

export const useStreamingStore = create<StreamingStore>((set, get) => ({
  streams: new Map(),

  updateStream: (conversationId, update) => {
    set((state) => {
      const newStreams = new Map(state.streams);
      const existing = newStreams.get(conversationId) ?? createEmptyStream();
      newStreams.set(conversationId, { ...existing, ...update });
      return { streams: newStreams };
    });
  },

  clearStream: (conversationId) => {
    set((state) => {
      const newStreams = new Map(state.streams);
      newStreams.delete(conversationId);
      return { streams: newStreams };
    });
  },

  getStream: (conversationId) => {
    return get().streams.get(conversationId);
  },

  hasActiveStream: (conversationId) => {
    const stream = get().streams.get(conversationId);
    return stream?.isStreaming ?? false;
  },
}));
