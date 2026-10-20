"use client";

import { useState, useEffect, useRef } from "react";
import { Card, Button } from "@/shared/components";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config";

const LOG_LEVEL_COLORS = {
  LOG: "text-[#e8ebed]",
  INFO: "text-[#9aa3ab]",
  WARN: "text-white font-medium",
  ERROR: "text-white font-semibold",
  DEBUG: "text-[#7d858e]",
};

function colorLine(line) {
  const match = line.match(/\[(\w+)\]/g);
  const levelTag = match ? match[1]?.replace(/\[|\]/g, "") : null;
  const color = LOG_LEVEL_COLORS[levelTag] || "text-text-main";
  return <span className={color}>{line}</span>;
}

export default function ConsoleLogClient() {
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);
  const logRef = useRef(null);

  const handleClear = async () => {
    try {
      await fetch("/api/translator/console-logs", { method: "DELETE" });
      // UI cleared via SSE "clear" event
    } catch (err) {
      console.error("Failed to clear console logs:", err);
    }
  };

  useEffect(() => {
    const es = new EventSource("/api/translator/console-logs/stream");

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "init") {
        setLogs(msg.logs.slice(-CONSOLE_LOG_CONFIG.maxLines));
      } else if (msg.type === "line") {
        setLogs((prev) => {
          const next = [...prev, msg.line];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "lines") {
        setLogs((prev) => {
          const next = [...prev, ...msg.lines];
          return next.length > CONSOLE_LOG_CONFIG.maxLines ? next.slice(-CONSOLE_LOG_CONFIG.maxLines) : next;
        });
      } else if (msg.type === "clear") {
        setLogs([]);
      }
    };

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, []);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Page head */}
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-text-main">Console Log</h2>
        <p className="mt-1 text-[13.5px] text-text-muted max-w-[640px]">Live server console output from this Bansur Router instance.</p>
      </div>
      <Card padding="none">
        <div className="flex items-center gap-2.5 px-[18px] py-3 border-b border-border">
          {connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-on-brand">
              <span className="size-1.5 rounded-full bg-on-brand" />
              Streaming
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-muted">
              <span className="size-1.5 rounded-full bg-transparent border border-[#a7afb6]" />
              Disconnected
            </span>
          )}
          <div className="flex-1" />
          <Button size="sm" variant="secondary" icon="delete" onClick={handleClear}>
            Clear
          </Button>
        </div>
        <div
          ref={logRef}
          className="bg-[#0b0e11] rounded-b-brand p-4 font-mono text-[12.5px] leading-[1.65] h-[calc(100vh-250px)] overflow-y-auto"
        >
          {logs.length === 0 ? (
            <span className="text-[#7d858e]">No console logs yet.</span>
          ) : (
            <div className="space-y-0.5">
              {logs.map((line, i) => (
                <div key={i}>{colorLine(line)}</div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
