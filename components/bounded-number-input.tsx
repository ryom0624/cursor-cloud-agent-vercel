"use client";

import { useState } from "react";

type BoundedNumberInputProps = {
  id?: string;
  name?: string;
  value: number;
  min?: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
  onCommit: (value: number) => void;
};

export function BoundedNumberInput({
  id,
  name,
  value,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  className,
  ariaLabel,
  onCommit,
}: BoundedNumberInputProps) {
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const numeric = Number(draft);
    const next = Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
    setDraft(String(next));
    onCommit(next);
  };

  return (
    <input
      id={id}
      name={name ?? id}
      className={className}
      type="number"
      inputMode="numeric"
      value={draft}
      aria-label={ariaLabel}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
