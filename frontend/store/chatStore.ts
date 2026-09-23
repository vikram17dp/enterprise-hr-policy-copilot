"use client";

/**
 * Chat store — a dependency-free external store (useSyncExternalStore) that
 * holds the active conversation so it survives navigation between the
 * dashboard and /ask within a session.
 */

import { useSyncExternalStore } from "react";
import type { ChatMessage } from "@/types/chat";

export interface ChatStoreState {
  messages: ChatMessage[];
  conversationId: string | null;
  isPending: boolean;
}

let state: ChatStoreState = {
  messages: [],
  conversationId: null,
  isPending: false,
};

const listeners = new Set<() => void>();

function setState(patch: Partial<ChatStoreState>): void {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ChatStoreState {
  return state;
}

export const chatStore = {
  addMessage(message: ChatMessage): void {
    setState({ messages: [...state.messages, message] });
  },

  updateMessage(id: string, patch: Partial<ChatMessage>): void {
    setState({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...patch } : m
      ),
    });
  },

  setPending(isPending: boolean): void {
    setState({ isPending });
  },

  setConversationId(id: string | null): void {
    setState({ conversationId: id });
  },

  reset(): void {
    setState({ messages: [], conversationId: null, isPending: false });
  },
};

export function useChatStore(): ChatStoreState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
