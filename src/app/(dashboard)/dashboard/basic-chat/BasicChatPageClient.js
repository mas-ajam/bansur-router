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

export default function BasicChatPageClient() {
  const [providerGroups, setProviderGroups] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeProviderId, setActiveProviderId] = useState("");
  const [activeModelId, setActiveModelId] = useState("");
  // Starts empty — the artifact's sample conversation is mock data (BC note).
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [origin, setOrigin] = useState("http://localhost:667");
  const abortRef = useRef(null);
  const messagesRef = useRef(null);

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
    return providerGroups[0]?.models?.[0] || null;
  }, [activeModelId, modelIndex, providerGroups]);

  // Default the picker to the first available model once data lands.
  useEffect(() => {
    if (!activeModelId && activeModel) {
      setActiveModelId(activeModel.id);
      setActiveProviderId(activeModel.providerId);
    }
  }, [activeModel, activeModelId]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  const canSend = !isSending && !!activeModel && draft.trim().length > 0;

  const handleSelectModel = (e) => {
    const model = modelIndex.get(e.target.value);
    if (!model) return;
    setActiveModelId(model.id);
    setActiveProviderId(model.providerId);
  };

  const updateMessage = (messageId, patch) => {
    setMessages((prev) => prev.map((message) => (message.id === messageId ? { ...message, ...patch } : message)));
  };

  const sendMessage = async () => {
    const model = activeModel;
    if (!model || !canSend) return;

    const userText = draft.trim();
    const userMessage = { id: createId(), role: "user", content: userText };
    const assistantMessageId = createId();
    const assistantMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "streaming",
      // The completions stream carries no provider identity, so the who line
      // uses the model/provider the request was sent with.
      who: `${model.id} · ${model.providerName}`,
    };

    const nextMessages = [...messages, userMessage, assistantMessage];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);
    setStreamingMessageId(assistantMessageId);
    setStreamingText("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const requestMessages = nextMessages
      .filter((message) => message.id !== assistantMessageId)
      .map((message) => ({ role: message.role, content: message.content }));

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
        updateMessage(assistantMessageId, { content: fallbackText, status: "done" });
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
            updateMessage(assistantMessageId, { content: assistantText, status: "streaming" });
          } catch {
            // Ignore malformed chunks.
          }
        }
      }

      updateMessage(assistantMessageId, { content: assistantText, status: "done" });
    } catch (error) {
      if (error.name !== "AbortError") {
        const errorText = textValue(error?.message || error);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: message.content || `Error: ${errorText}`, status: "error" }
              : message
          )
        );
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
        </div>

        {/* Messages */}
        <div ref={messagesRef} className="flex-1 overflow-y-auto p-[18px] flex flex-col gap-3.5">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const isStreaming = !isUser && message.id === streamingMessageId && message.status === "streaming";
            const content = textValue(message.content) || (isStreaming ? streamingText : "");
            return isUser ? (
              <div
                key={message.id}
                className="self-end bg-brand-500 text-white rounded-[10px] rounded-br-[3px] max-w-[78%] px-3.5 py-2.5 text-[13.5px] leading-[1.55] whitespace-pre-wrap"
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#9aa3ab] mb-1">You</div>
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

        {/* Composer */}
        <form onSubmit={handleSubmit} className="flex gap-2.5 p-3.5 border-t border-border">
          <Input
            className="flex-1 min-w-0"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Send a test message…"
            disabled={!activeModel || loadingData}
          />
          <Button variant="primary" type="submit" disabled={!canSend} loading={isSending}>
            Send
          </Button>
        </form>
      </Card>
    </div>
  );
}
