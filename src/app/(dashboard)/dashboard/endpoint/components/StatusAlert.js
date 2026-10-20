"use client";

/** Reusable status alert */
export default function StatusAlert({ status, className = "" }) {
  const renderMessage = (msg) => {
    const parts = msg.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline font-medium">{part}</a>
        : part
    );
  };

  return (
    <div className={`p-2 rounded text-sm ${className} ${status.type === "success" ? "bg-surface-2 text-text-main dark:text-text-main" :
        status.type === "warning" ? "bg-surface-2 text-text-muted dark:text-text-muted" :
        status.type === "info" ? "bg-surface-2 text-text-muted dark:text-text-muted" :
          "bg-surface-2 text-text-main dark:text-text-main"
      }`}>
      {renderMessage(status.message)}
    </div>
  );
}
