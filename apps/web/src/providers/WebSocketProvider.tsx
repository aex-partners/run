import { createContext, useContext } from "react";
import { useWebSocket as useWebSocketHook, type StreamEntry } from "../hooks/useWebSocket";

interface WebSocketContextValue {
  isConnected: boolean;
  streams: Map<string, StreamEntry>;
  typingConversations: Set<string>;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocketHook();
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWS(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error("useWS must be used within WebSocketProvider");
  return ctx;
}
