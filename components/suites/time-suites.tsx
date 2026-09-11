"use client";

import { CronExpressionParser } from "cron-parser";
import { useMemo, useState } from "react";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import { describeCron } from "@/lib/tool-utils";

type DateMode = "timestamp" | "timezone";

const zones = [
  "Asia/Tokyo",
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function DateTimeSuite() {
  const [mode, setMode] = useState<DateMode>("timestamp");
  const [timestamp, setTimestamp] = useState("1789099200");
  const [dateInput, setDateInput] = useState("2026-09-11T12:00");
  const [zone, setZone] = useState("Asia/Tokyo");

  const timestampResult = useMemo(() => {
    const numeric = Number(timestamp);
    if (!Number.isFinite(numeric)) return null;
    const milliseconds = Math.abs(numeric) < 100_000_000_000 ? numeric * 1000 : numeric;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [timestamp]);

  const timezoneResult = useMemo(() => {
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: zone,
      dateStyle: "full",
      timeStyle: "long",
    }).format(date);
  }, [dateInput, zone]);

  return (
    <ToolShell
      slug="date-time"
      category="日時"
      title="Date & Time"
      description="Unix Timestampと、主要タイムゾーンの日時をすぐに変換します。"
      functionCount={2}
      tabs={[
        { id: "timestamp", label: "Unix Timestamp" },
        { id: "timezone", label: "Timezone" },
      ]}
      activeTab={mode}
      onTabChange={(tab) => setMode(tab as DateMode)}
    >
      {mode === "timestamp" ? (
        <>
          <div className="single-input-bar">
            <label htmlFor="timestamp-value">TIMESTAMP</label>
            <input
              id="timestamp-value"
              name="timestamp-value"
              value={timestamp}
              onChange={(event) => setTimestamp(event.target.value)}
              inputMode="numeric"
            />
            <button
              type="button"
              onClick={() => setTimestamp(String(Math.floor(Date.now() / 1000)))}
            >
              現在時刻
            </button>
          </div>
          {timestampResult ? (
            <div className="date-results">
              <div><span>LOCAL</span><strong>{timestampResult.toLocaleString("ja-JP")}</strong></div>
              <div><span>UTC</span><strong>{timestampResult.toUTCString()}</strong></div>
              <div><span>ISO 8601</span><strong>{timestampResult.toISOString()}</strong></div>
              <div><span>MILLISECONDS</span><strong>{timestampResult.getTime()}</strong></div>
            </div>
          ) : (
            <div className="empty-result">有効なTimestampを入力してください</div>
          )}
          <ToolStatus error={timestampResult ? "" : "日時へ変換できません"}>
            秒・ミリ秒を自動判定します
          </ToolStatus>
        </>
      ) : (
        <>
          <div className="timezone-controls">
            <label className="control-label grow">
              入力日時（端末のローカル時刻）
              <input
                type="datetime-local"
                value={dateInput}
                onChange={(event) => setDateInput(event.target.value)}
                name="timezone-date"
              />
            </label>
            <label className="control-label grow">
              変換先
              <select value={zone} onChange={(event) => setZone(event.target.value)}>
                {zones.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
          </div>
          <div className="timezone-output">
            <span>{zone}</span>
            <strong>{timezoneResult || "日時を入力してください"}</strong>
          </div>
          <div className="timezone-list">
            {zones.slice(0, 4).map((item) => (
              <div key={item}>
                <span>{item}</span>
                <strong>
                  {dateInput
                    ? new Intl.DateTimeFormat("ja-JP", {
                        timeZone: item,
                        dateStyle: "medium",
                        timeStyle: "medium",
                      }).format(new Date(dateInput))
                    : "—"}
                </strong>
              </div>
            ))}
          </div>
          <ToolStatus>Intl APIを使って端末内で変換しています</ToolStatus>
        </>
      )}
    </ToolShell>
  );
}

type CronMode = "parser" | "builder";

export function CronSuite() {
  const [mode, setMode] = useState<CronMode>("parser");
  const [expression, setExpression] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState("Asia/Tokyo");
  const [builder, setBuilder] = useState({
    minute: "0",
    hour: "9",
    day: "*",
    month: "*",
    week: "1-5",
  });

  const result = useMemo(() => {
    try {
      const interval = CronExpressionParser.parse(expression, { tz: timezone });
      return {
        next: interval.take(5).map((date) => date.toDate()),
        error: "",
      };
    } catch (error) {
      return {
        next: [] as Date[],
        error:
          error instanceof Error ? error.message : "Cron式を解析できません。",
      };
    }
  }, [expression, timezone]);

  const updateBuilder = (key: keyof typeof builder, value: string) => {
    const next = { ...builder, [key]: value };
    setBuilder(next);
    setExpression(`${next.minute} ${next.hour} ${next.day} ${next.month} ${next.week}`);
  };

  return (
    <ToolShell
      slug="cron"
      category="日時"
      title="Cron Tools"
      description="Cron式を読み解き、次回実行日時を確認しながら組み立てます。"
      functionCount={2}
      tabs={[
        { id: "parser", label: "Parser" },
        { id: "builder", label: "Builder" },
      ]}
      activeTab={mode}
      onTabChange={(tab) => setMode(tab as CronMode)}
    >
      <div className="cron-expression">
        <span>CRON</span>
        <input
          value={expression}
          onChange={(event) => setExpression(event.target.value)}
          name="cron-expression"
          aria-label="Cron式"
        />
        <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
          {zones.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>

      {mode === "builder" && (
        <div className="cron-builder">
          {[
            ["minute", "分", "0–59"],
            ["hour", "時", "0–23"],
            ["day", "日", "1–31"],
            ["month", "月", "1–12"],
            ["week", "曜日", "0–7"],
          ].map(([key, label, hint]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                value={builder[key as keyof typeof builder]}
                onChange={(event) =>
                  updateBuilder(key as keyof typeof builder, event.target.value)
                }
              />
              <small>{hint}</small>
            </label>
          ))}
        </div>
      )}

      <div className="cron-summary">
        <span>このCron式は</span>
        <strong>{describeCron(expression)}</strong>
        <small>として実行されます</small>
      </div>

      <div className="next-runs">
        <header><span>NEXT 5 RUNS</span><small>{timezone}</small></header>
        {result.next.map((date, index) => (
          <div key={date.toISOString()}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{date.toLocaleString("ja-JP", { timeZone: timezone })}</strong>
            <small>{date.toISOString()}</small>
          </div>
        ))}
      </div>
      <ToolStatus error={result.error}>
        {result.next.length ? "Cron式は有効です" : undefined}
      </ToolStatus>
    </ToolShell>
  );
}
