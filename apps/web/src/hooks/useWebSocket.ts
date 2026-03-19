import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export interface StreamEntry {
  messageId: string;
  content: string;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const backoffRef = useRef(1000);
  const disposed = useRef(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Use refs + a counter to force re-renders on stream updates
  const streamsRef = useRef<Map<string, StreamEntry>>(new Map());
  const typingRef = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);
  const tick = useCallback(() => setTick((n) => n + 1), []);

  const connect = useCallback(() => {
    if (disposed.current) return;
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      backoffRef.current = 1000;
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Only reconnect if this is still the active connection and not disposed
      if (wsRef.current === ws && !disposed.current) {
        wsRef.current = null;
        reconnectTimeout.current = setTimeout(() => {
          backoffRef.current = Math.min(backoffRef.current * 2, 30000);
          connect();
        }, backoffRef.current);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "new_message": {
            if (data.message) {
              // For AI messages (authorId null) or other users, invalidate
              if (data.message.authorId === null || data.message.authorId !== user.id) {
                queryClient.invalidateQueries({
                  queryKey: [["messages", "list"], { input: { conversationId: data.message.conversationId } }],
                });
                queryClient.invalidateQueries({
                  queryKey: [["conversations", "list"]],
                });
              }
            }
            break;
          }

          case "ai_typing": {
            if (data.isTyping) {
              typingRef.current.add(data.conversationId);
            } else {
              typingRef.current.delete(data.conversationId);
            }
            tick();
            break;
          }

          case "ai_stream_start": {
            streamsRef.current.set(data.conversationId, {
              messageId: data.messageId,
              content: "",
            });
            // Clear typing when stream starts
            typingRef.current.delete(data.conversationId);
            tick();
            break;
          }

          case "ai_stream_chunk": {
            const entry = streamsRef.current.get(data.conversationId);
            if (entry) {
              entry.content += data.content;
              tick();
            }
            break;
          }

          case "ai_stream_end": {
            streamsRef.current.delete(data.conversationId);
            tick();
            break;
          }

          case "message_updated":
          case "message_deleted": {
            if (data.conversationId) {
              queryClient.invalidateQueries({
                queryKey: [["messages", "list"], { input: { conversationId: data.conversationId } }],
              });
            }
            break;
          }

          case "conversation_renamed": {
            queryClient.invalidateQueries({
              queryKey: [["conversations", "list"]],
            });
            break;
          }

          case "task_updated": {
            queryClient.invalidateQueries({ queryKey: [["tasks", "list"]] });
            queryClient.invalidateQueries({ queryKey: [["tasks", "stats"]] });
            queryClient.invalidateQueries({ queryKey: [["tasks", "getById"]] });
            break;
          }

          case "task_log": {
            queryClient.invalidateQueries({ queryKey: [["tasks", "getLogs"]] });
            break;
          }

          case "entity_updated": {
            queryClient.invalidateQueries({ queryKey: [["entities", "list"]] });
            queryClient.invalidateQueries({ queryKey: [["entities", "getById"]] });
            break;
          }

          case "record_updated": {
            queryClient.invalidateQueries({ queryKey: [["entities", "records"]] });
            queryClient.invalidateQueries({ queryKey: [["entities", "list"]] });
            break;
          }

          case "workflow_updated": {
            queryClient.invalidateQueries({ queryKey: [["workflows", "list"]] });
            queryClient.invalidateQueries({ queryKey: [["workflows", "getById"]] });
            break;
          }

          case "workflow_execution_started":
          case "workflow_execution_step":
          case "workflow_execution_completed":
          case "workflow_execution_failed": {
            queryClient.invalidateQueries({ queryKey: [["workflows", "executionHistory"]] });
            queryClient.invalidateQueries({ queryKey: [["workflows", "list"]] });
            break;
          }

          case "file_updated": {
            queryClient.invalidateQueries({ queryKey: [["files", "list"]] });
            queryClient.invalidateQueries({ queryKey: [["files", "categoryCounts"]] });
            queryClient.invalidateQueries({ queryKey: [["files", "getById"]] });
            break;
          }

          case "email_sync_complete":
          case "email_sent":
          case "email_account_disconnected": {
            queryClient.invalidateQueries({ queryKey: [["emails", "list"]] });
            queryClient.invalidateQueries({ queryKey: [["emails", "folderCounts"]] });
            queryClient.invalidateQueries({ queryKey: [["emails", "accounts"]] });
            break;
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };
  }, [queryClient, user.id, tick]);

  useEffect(() => {
    disposed.current = false;
    connect();
    return () => {
      disposed.current = true;
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return {
    isConnected,
    streams: streamsRef.current,
    typingConversations: typingRef.current,
  };
}
