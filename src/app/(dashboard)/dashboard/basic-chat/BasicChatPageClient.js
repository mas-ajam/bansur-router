"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Input, Select } from "@/shared/components";
import { getModelsByProviderId } from "@/shared/constants/models";
import { isAnthropicCompatibleProvider, isOpenAICompatibleProvider } from "@/shared/constants/providers";

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `chat_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function textValue(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(" ");
  if (typeof value === "object") {
    if (typeof value.message === "string") return value.message;
    if (typeof value.error === "string") return value.error;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function humanize(value = "") {
  return String(value)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Unknown";
}

function getProviderLabel(connection) {
  return connection?.name || humanize(connection?.provider || connection?.id || "provider");
}

function normalizeStaticModel(model, connection) {
  if (!model?.id) return null;
  return {
    id: `${connection.provider}/${model.id}`,
    requestModel: `${connection.provider}/${model.id}`,
    name: model.name || model.id,
    providerId: connection.provider,
    providerName: getProviderLabel(connection),
    source: "static",
  };
}

function normalizeLiveModel(model, connection) {
  const rawId = typeof model === "string" ? model : model?.id || model?.name || model?.model || "";
  if (!rawId) return null;

  const displayName = typeof model === "string"
    ? model
    : model?.name || model?.displayName || rawId;

  let requestModel = rawId;
  const isCompatible = isOpenAICompatibleProvider(connection.provider) || isAnthropicCompatibleProvider(connection.provider);
  if (isCompatible && !rawId.includes("/")) {
    requestModel = `${connection.provider}/${rawId}`;
  }

  return {
    id: requestModel,
    requestModel,
    name: displayName,
    providerId: connection.provider,
    providerName: getProviderLabel(connection),
    source: "live",
  };
}

function parseProviderModelsPayload(data) {
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function dedupeModels(models) {
  const map = new Map();
  for (const model of models) {
    if (!model?.id) continue;
    if (!map.has(model.id)) map.set(model.id, model);
  }
  return Array.from(map.values());
}

function readAssistantText(chunk) {
  if (!chunk || typeof chunk !== "object") return "";
  const choice = chunk.choices?.[0];
  const delta = choice?.delta || {};
  const pieces = [delta.content, choice?.message?.content, chunk.output_text, chunk.text]
    .map(textValue)
    .filter(Boolean);
  return pieces[0] || "";
}

/* Attachments + history — restored (Option 2 batch 5, BC-06), ported from
   the pre-removal Basic Chat (ea40b73^): same localStorage keys, same
   session shape, same image_url content building for the send path. */
const STORAGE_KEYS = {
  sessions: "basic-chat.sessions",
  activeSessionId: "basic-chat.activeSessionId",
  activeProviderId: "basic-chat.activeProviderId",
  draft: "basic-chat.draft",
};

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function formatRelativeTime(value) {
  if (!value) return "Now";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "Now";
  const diffMinutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return `${Math.round(diffHours / 24)}d`;
}

function makeSessionTitle(text = "") {
  const normalized = textValue(text).replace(/\s+/g, " ").trim();
  if (!normalized) return "New chat";
  return normalized.length > 52 ? `${normalized.slice(0, 52).trimEnd()}…` : normalized;
}

function buildUserContent(message) {
  const text = textValue(message.content).trim();
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];

  if (attachments.length === 0) return text;

  const content = [];
  if (text) content.push({ type: "text", text });

  for (const attachment of attachments) {
    if (attachment?.dataUrl) {
      content.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
    }
  }

  return content.length > 0 ? content : text;
}

async function fileToDataUrl(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function cloneSession(session) {
  return {
    ...session,
    messages: Array.isArray(session.messages) ? session.messages.map((message) => ({ ...message })) : [],
  };
}

export default function BasicChatPageClient() {
  const [providerGroups, setProviderGroups] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeProviderId, setActiveProviderId] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return globalThis.localStorage.getItem(STORAGE_KEYS.activeProviderId) || ""; } catch { return ""; }
  });
  const [activeModelId, setActiveModelId] = useState("");
  // Sessions (BC-06): the conversation lives in the active session and is
  // persisted to localStorage exactly as pre-removal. A fresh install with
  // no saved sessions starts empty — the artifact's sample conversation is
  // mock data (BC note).
  const [sessions, setSessions] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = safeParse(globalThis.localStorage.getItem(STORAGE_KEYS.sessions), []);
      return Array.isArray(saved) ? saved.map((session) => ({
        ...session,
        messages: Array.isArray(session.messages) ? session.messages : [],
      })) : [];
    } catch { return []; }
  });
  const [activeSessionId, setActiveSessionId] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return globalThis.localStorage.getItem(STORAGE_KEYS.activeSessionId) || ""; } catch { return ""; }
  });
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return "";
    try { return globalThis.localStorage.getItem(STORAGE_KEYS.draft) || ""; } catch { return ""; }
  });
  const [attachments, setAttachments] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [origin, setOrigin] = useState("http://localhost:667");
  const abortRef = useRef(null);
  const messagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoadingData(true);
      setLoadError("");

      try {
        const providersRes = await fetch("/api/providers", { cache: "no-store" });
        const providersData = await providersRes.json().catch(() => ({}));
        const connections = Array.isArray(providersData.connections)
          ? providersData.connections.filter((connection) => connection?.isActive !== false)
          : [];

        if (connections.length === 0) {
          if (!cancelled) {
            setProviderGroups([]);
            setLoadError("No providers connected yet.");
          }
          return;
        }

        const providerMap = new Map();

        for (const connection of connections) {
          const providerId = connection.provider || connection.id;
          const providerName = getProviderLabel(connection);
          const providerType = isOpenAICompatibleProvider(providerId)
            ? "openai-compatible"
            : isAnthropicCompatibleProvider(providerId)
              ? "anthropic-compatible"
              : providerId;

          if (!providerMap.has(providerId)) {
            providerMap.set(providerId, {
              providerId,
              providerName,
              providerType,
              connections: [],
              models: [],
            });
          }

          const group = providerMap.get(providerId);
          group.providerName = group.providerName || providerName;
          group.providerType = group.providerType || providerType;
          group.connections.push(connection);

          const staticModels = getModelsByProviderId(providerId)
            .map((model) => normalizeStaticModel(model, connection))
            .filter(Boolean);
          group.models.push(...staticModels);
        }

        const liveResults = await Promise.all(
          connections.map(async (connection) => {
            try {
              const response = await fetch(`/api/providers/${connection.id}/models`, { cache: "no-store" });
              const data = await response.json().catch(() => ({}));
              if (!response.ok) return { connection, models: [] };
              const models = parseProviderModelsPayload(data)
                .map((model) => normalizeLiveModel(model, connection))
                .filter(Boolean);
              return { connection, models };
            } catch {
              return { connection, models: [] };
            }
          })
        );

        for (const result of liveResults) {
          const providerId = result.connection.provider || result.connection.id;
          const group = providerMap.get(providerId);
          if (!group) continue;
          group.models.push(...result.models);
        }

        const normalized = Array.from(providerMap.values())
          .map((group) => ({
            ...group,
            models: dedupeModels(group.models).sort((a, b) => a.name.localeCompare(b.name)),
          }))
          .filter((group) => group.models.length > 0)
          .sort((a, b) => a.providerName.localeCompare(b.providerName));

        if (!cancelled) {
          setProviderGroups(normalized);
          if (normalized.length === 0) {
            setLoadError("Providers connected but no models available.");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(textValue(error?.message) || "Failed to load providers/models.");
          setProviderGroups([]);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelIndex = useMemo(() => {
    const map = new Map();
    for (const group of providerGroups) {
      for (const model of group.models) {
        map.set(model.id, {
          ...model,
          providerId: group.providerId,
          providerName: group.providerName,
        });
      }
    }
    return map;
  }, [providerGroups]);

  const activeModel = useMemo(() => {
    if (activeModelId && modelIndex.has(activeModelId)) return modelIndex.get(activeModelId);
    if (activeSessionId) {
      const session = sessions.find((item) => item.id === activeSessionId);
      if (session?.modelId && modelIndex.has(session.modelId)) return modelIndex.get(session.modelId);
    }
    return providerGroups[0]?.models?.[0] || null;
  }, [activeModelId, modelIndex, providerGroups, sessions, activeSessionId]);

  const currentSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) || null,
    [sessions, activeSessionId]
  );
  const messages = currentSession?.messages || [];
  const sessionItems = useMemo(
    () => [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [sessions]
  );

  // Persist sessions + pointers exactly as pre-removal (BC-06).
  useEffect(() => {
    if (!isHydrated) return;
    try {
      globalThis.localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(sessions));
      globalThis.localStorage.setItem(STORAGE_KEYS.activeSessionId, activeSessionId);
      globalThis.localStorage.setItem(STORAGE_KEYS.activeProviderId, activeProviderId);
      globalThis.localStorage.setItem(STORAGE_KEYS.draft, draft);
    } catch {
      // Ignore storage errors.
    }
  }, [isHydrated, sessions, activeSessionId, activeProviderId, draft]);

  // Once models land: reopen the saved session, or create the first one.
  useEffect(() => {
    if (!isHydrated || loadingData || initializedRef.current) return;
    if (providerGroups.length === 0) return;

    const savedProvider = providerGroups.find((group) => group.providerId === activeProviderId) || providerGroups[0];
    const savedModel = activeModelId && modelIndex.has(activeModelId)
      ? modelIndex.get(activeModelId)
      : savedProvider.models[0];
    if (!savedModel) return;

    if (sessions.length > 0) {
      const session = sessions.find((item) => item.id === activeSessionId) || sessions[0];
      const sessionModel = session?.modelId && modelIndex.has(session.modelId)
        ? modelIndex.get(session.modelId)
        : savedModel;
      initializedRef.current = true;
      setActiveSessionId(session.id);
      setActiveProviderId(sessionModel?.providerId || savedProvider.providerId);
      setActiveModelId(sessionModel?.id || savedModel.id);
      return;
    }

    const session = {
      id: createId(),
      title: "New chat",
      providerId: savedProvider.providerId,
      providerName: savedProvider.providerName,
      modelId: savedModel.id,
      modelName: savedModel.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };

    initializedRef.current = true;
    setSessions([session]);
    setActiveSessionId(session.id);
    setActiveProviderId(savedProvider.providerId);
    setActiveModelId(savedModel.id);
  }, [isHydrated, loadingData, providerGroups, modelIndex, sessions, activeSessionId, activeProviderId, activeModelId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  const canSend = !isSending && !!activeModel && (draft.trim().length > 0 || attachments.length > 0);

  const updateSession = (sessionId, updater) => {
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? updater(cloneSession(session)) : session)));
  };

  const ensureSessionForModel = (model) => {
    if (!model) return null;
    return {
      id: createId(),
      title: "New chat",
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
  };

  const handleSelectModel = (e) => {
    const model = modelIndex.get(e.target.value);
    if (!model) return;
    // Pre-removal semantics: switching model mid-conversation starts a new
    // session for that model; an empty session is simply retargeted.
    const current = sessions.find((session) => session.id === activeSessionId);
    if (current && current.messages.length > 0) {
      const session = ensureSessionForModel(model);
      if (!session) return;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
    } else if (current) {
      setSessions((prev) => prev.map((item) => (item.id === current.id ? {
        ...item,
        providerId: model.providerId,
        providerName: model.providerName,
        modelId: model.id,
        modelName: model.name,
      } : item)));
    }
    setActiveModelId(model.id);
    setActiveProviderId(model.providerId);
  };

  const handleNewChat = () => {
    if (!activeModel) return;
    const session = ensureSessionForModel(activeModel);
    if (!session) return;
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setActiveProviderId(session.providerId);
    setActiveModelId(session.modelId);
    setDraft("");
    setAttachments([]);
    setStreamingMessageId("");
    setStreamingText("");
    setHistoryOpen(false);
  };

  const handleSelectSession = (sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(sessionId);
    setActiveProviderId(session.providerId || activeProviderId);
    setActiveModelId(session.modelId || activeModelId);
    setHistoryOpen(false);
  };

  const handleDeleteSession = (sessionId) => {
    const nextSessions = sessions.filter((session) => session.id !== sessionId);
    setSessions(nextSessions);
    if (sessionId === activeSessionId) {
      const fallback = nextSessions[0] || null;
      if (fallback) {
        setActiveSessionId(fallback.id);
        setActiveProviderId(fallback.providerId);
        setActiveModelId(fallback.modelId);
      } else {
        setActiveSessionId("");
      }
    }
  };

  const handleAttachFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const images = files.filter((file) => file.type.startsWith("image/"));
    if (images.length === 0) {
      event.target.value = "";
      return;
    }

    const converted = await Promise.all(images.map(async (file) => ({
      id: createId(),
      name: file.name,
      type: file.type,
      size: file.size,
      dataUrl: await fileToDataUrl(file),
    })));

    setAttachments((prev) => [...prev, ...converted]);
    event.target.value = "";
  };

  const removeAttachment = (attachmentId) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const updateMessage = (sessionId, messageId, patch) => {
    updateSession(sessionId, (session) => ({
      ...session,
      messages: session.messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
      updatedAt: new Date().toISOString(),
    }));
  };

  const sendMessage = async () => {
    const model = activeModel;
    if (!model || !canSend) return;

    const userText = draft.trim();

    let sessionId = activeSessionId;
    let session = sessions.find((item) => item.id === sessionId);
    if (!session) {
      session = ensureSessionForModel(model);
      if (!session) return;
      sessionId = session.id;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(sessionId);
    }

    const userMessage = {
      id: createId(),
      role: "user",
      content: userText,
      attachments: attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        type: attachment.type,
        dataUrl: attachment.dataUrl,
      })),
      createdAt: new Date().toISOString(),
    };
    const assistantMessageId = createId();
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: new Date().toISOString(),
      // The completions stream carries no provider identity, so the who line
      // uses the model/provider the request was sent with.
      who: `${model.id} · ${model.providerName}`,
    };

    const nextMessages = [...(session.messages || []), userMessage, assistantMessage];
    setSessions((prev) => prev.map((item) => (item.id === sessionId ? {
      ...item,
      providerId: model.providerId,
      providerName: model.providerName,
      modelId: model.id,
      modelName: model.name,
      messages: nextMessages,
      updatedAt: new Date().toISOString(),
      title: item.title === "New chat" ? makeSessionTitle(userText) : item.title,
    } : item)));
    setDraft("");
    setAttachments([]);
    setIsSending(true);
    setStreamingMessageId(assistantMessageId);
    setStreamingText("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const requestMessages = nextMessages
      .filter((message) => message.id !== assistantMessageId)
      .map((message) => ({
        role: message.role,
        content: message.role === "user" ? buildUserContent(message) : message.content,
      }));

    try {
      const response = await fetch("/api/dashboard/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: model.requestModel || model.id,
          messages: requestMessages,
          stream: true,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(textValue(errorData.error || errorData.message || `Request failed (${response.status})`));
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const data = await response.json().catch(() => ({}));
        const fallbackText = textValue(data?.choices?.[0]?.message?.content || data?.output_text || data?.error || data?.message || "");
        updateMessage(sessionId, assistantMessageId, { content: fallbackText, status: "done" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const chunk = JSON.parse(payload);
            const text = readAssistantText(chunk);
            if (!text) continue;

            assistantText += text;
            setStreamingText(assistantText);
            updateMessage(sessionId, assistantMessageId, { content: assistantText, status: "streaming" });
          } catch {
            // Ignore malformed chunks.
          }
        }
      }

      updateMessage(sessionId, assistantMessageId, { content: assistantText || "", status: "done" });
    } catch (error) {
      if (error.name !== "AbortError") {
        const errorText = textValue(error?.message || error);
        updateSession(sessionId, (currentSession) => ({
          ...currentSession,
          messages: currentSession.messages.map((message) => (message.id === assistantMessageId ? { ...message, content: message.content || `Error: ${errorText}`, status: "error" } : message)),
          updatedAt: new Date().toISOString(),
        }));
        setLoadError(errorText || "Failed to send message.");
      }
    } finally {
      setIsSending(false);
      setStreamingMessageId("");
      setStreamingText("");
      abortRef.current = null;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canSend) sendMessage();
  };

  const modelOptions = useMemo(
    () =>
      providerGroups.flatMap((group) =>
        group.models.map((model) => ({ value: model.id, label: model.id }))
      ),
    [providerGroups]
  );

  return (
    <div className="flex flex-col">
      {/* Page head */}
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-[-0.01em]">Basic Chat</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">A quick smoke test for the endpoint — sends a real request through the router with the model you pick.</p>
      </div>

      {loadError && <p className="text-xs text-text-muted mb-3.5">{loadError}</p>}

      <Card padding="none" className="h-[520px] flex flex-col">
        {/* Chat head */}
        <div className="flex items-center gap-2.5 px-[18px] py-[14px] border-b border-border">
          <span className="text-xs text-text-muted">Model</span>
          <div className="w-full max-w-[280px]">
            <Select
              options={modelOptions}
              value={activeModel?.id || ""}
              onChange={handleSelectModel}
              placeholder={loadingData ? "Loading models…" : "Select model"}
              disabled={loadingData || modelOptions.length === 0}
            />
          </div>
          <div className="flex-1" />
          <Badge>
            <span className="size-2 rounded-full bg-brand-500 shrink-0" />
            via {origin}/v1
          </Badge>
          {/* History + New chat — restored (BC-06) */}
          <Button variant="secondary" size="sm" onClick={() => setHistoryOpen((v) => !v)}>
            History
          </Button>
          <Button variant="secondary" size="sm" onClick={handleNewChat} disabled={!activeModel || loadingData}>
            New chat
          </Button>
        </div>

        {/* History panel — collapsible session list (BC-06) */}
        {historyOpen && (
          <div className="border-b border-border px-[18px] py-3 max-h-[240px] overflow-y-auto">
            <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-subtle mb-2">Recent chats</div>
            {sessionItems.length === 0 ? (
              <div className="text-[13px] text-text-muted border border-dashed border-border rounded-md px-3 py-2.5">
                No conversations yet.
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sessionItems.map((session) => {
                  const isActive = session.id === activeSessionId;
                  const latestMessage = [...(session.messages || [])].reverse().find((m) => m.role === "user") || session.messages?.[0];
                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${isActive ? "border-border-strong bg-surface-2" : "border-border hover:bg-surface-2"}`}
                    >
                      <button type="button" onClick={() => handleSelectSession(session.id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13px] font-medium">{session.title}</span>
                        <span className="block truncate text-xs text-text-muted">{textValue(latestMessage?.content) || "Empty chat"}</span>
                      </button>
                      <span className="text-[10px] text-text-subtle shrink-0">{formatRelativeTime(session.updatedAt)}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteSession(session.id)}
                        className="shrink-0 rounded p-1 text-text-muted hover:text-text-main hover:bg-surface"
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto p-[18px] flex flex-col gap-3.5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isStreaming = !isUser && message.id === streamingMessageId && message.status === "streaming";
            const content = textValue(message.content) || (isStreaming ? streamingText : "");
            return isUser ? (
              <div
                key={message.id}
                className="self-end bg-brand-500 text-on-brand rounded-[10px] rounded-br-[3px] max-w-[78%] px-3.5 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-subtle mb-1">You</div>
                {message.attachments?.length ? (
                  <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {message.attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-border bg-surface-2">
                        <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover" loading="lazy" decoding="async" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {content}
              </div>
            ) : (
              <div
                key={message.id}
                className="self-start bg-surface-2 border border-border rounded-[10px] rounded-bl-[3px] max-w-[78%] px-3.5 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-subtle mb-1">
                  {message.who || `${activeModel?.id || "Assistant"} · via router`}
                </div>
                {content}
                {isStreaming && !content ? <span className="inline-block animate-pulse">▋</span> : null}
              </div>
            );
          })}
        </div>

        {/* Composer — attach button + file chips restored (BC-06) */}
        <div className="border-t border-border">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3.5 pt-3">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5">
                  <span className="text-xs max-w-[12rem] truncate">{attachment.name}</span>
                  <button type="button" onClick={() => removeAttachment(attachment.id)} className="text-text-muted hover:text-text-main" aria-label="Remove attachment">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2.5 p-3.5 items-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!activeModel || loadingData}
              className="shrink-0 rounded-full p-2 text-text-muted hover:text-text-main hover:bg-surface-2 transition disabled:opacity-50"
              title="Attach images"
              aria-label="Attach images"
            >
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAttachFiles} />
            <Input
              className="flex-1 min-w-0"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Send a test message…"
              disabled={!activeModel || loadingData}
            />
            {isSending && (
              <Button variant="secondary" type="button" onClick={handleStop}>
                Stop
              </Button>
            )}
            <Button variant="primary" type="submit" disabled={!canSend} loading={isSending}>
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
