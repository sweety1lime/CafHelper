import { useState } from "react";
import { copyText } from "../lib/clipboard";

export function CopyButton({ text, title }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      title={title ?? "Скопировать"}
      className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-white/10 hover:text-white"
      onClick={async (e) => {
        e.stopPropagation();
        await copyText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "✓" : "⧉"}
    </button>
  );
}
