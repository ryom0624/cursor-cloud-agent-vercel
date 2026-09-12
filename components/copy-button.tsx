"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

const copyEvent = "devsmith-copy-success";

export async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
  window.dispatchEvent(new CustomEvent(copyEvent));
}

export function CopyButton({
  value,
  label = "コピー",
  iconOnly = false,
  className,
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      className={className}
      onClick={copy}
      disabled={!value}
      aria-label={copied ? "コピーしました" : label}
      title={copied ? "コピーしました" : label}
    >
      {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      {!iconOnly && (copied ? "コピーしました" : label)}
    </button>
  );
}

export function CopyToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeout: number | undefined;
    const show = () => {
      window.clearTimeout(timeout);
      setVisible(true);
      timeout = window.setTimeout(() => setVisible(false), 1800);
    };
    window.addEventListener(copyEvent, show);
    return () => {
      window.removeEventListener(copyEvent, show);
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <div className={`copy-toast ${visible ? "visible" : ""}`} role="status" aria-live="polite">
      <Check size={16} aria-hidden="true" />
      コピーしました
    </div>
  );
}
