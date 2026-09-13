"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { generateHttpCode, type HttpCodeTarget } from "@/lib/http/codegen";
import type { HttpRequestModel } from "@/lib/http/request-model";

const labels: Record<HttpCodeTarget, string> = {
  curl: "cURL",
  fetch: "Fetch",
  axios: "Axios",
  python: "Python",
  go: "Go",
};

export function GeneratedRequestPanel({
  model,
  targets = ["curl", "fetch", "axios", "python", "go"],
}: {
  model: HttpRequestModel;
  targets?: HttpCodeTarget[];
}) {
  const [target, setTarget] = useState<HttpCodeTarget>(targets[0]);
  const generated = useMemo(() => {
    try {
      return { code: generateHttpCode(model, target), error: "" };
    } catch (error) {
      return {
        code: "",
        error: error instanceof Error ? error.message : "コードを生成できません。",
      };
    }
  }, [model, target]);

  return (
    <section className="generated-request">
      <header>
        <span>GENERATED REQUEST</span>
        <CopyButton value={generated.code} />
      </header>
      <div className="segmented-control wrap" role="tablist" aria-label="生成言語">
        {targets.map((item) => (
          <button
            key={item}
            type="button"
            className={target === item ? "active" : ""}
            onClick={() => setTarget(item)}
          >
            {labels[item]}
          </button>
        ))}
      </div>
      <textarea
        readOnly
        value={generated.error || generated.code}
        spellCheck={false}
        aria-label={`${labels[target]}の生成結果`}
      />
      <p className="generated-request-note">HTTPリクエストは送信しません。生成だけを行います。</p>
    </section>
  );
}
