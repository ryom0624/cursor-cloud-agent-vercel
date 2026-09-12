"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  analyzeFloat,
  calculatePercent,
  convertRadix,
  convertUnitValue,
  evaluateExpression,
  formatFloatBitsGrouped,
  formatUnitNumber,
  type BitWidth,
  type FloatPrecision,
  type PercentMode,
  type Radix,
  type UnitCategory,
  unitCategories,
} from "@/lib/number-utils";

type NumberTab = "radix" | "unit" | "expression" | "float" | "percent";

const radixTabs: { id: NumberTab; label: string }[] = [
  { id: "radix", label: "基数変換" },
  { id: "unit", label: "単位・スケール" },
  { id: "expression", label: "式・計算" },
  { id: "float", label: "浮動小数点" },
  { id: "percent", label: "パーセント" },
];

const bitWidths: BitWidth[] = [8, 16, 32, 64];
const radixBases: Radix[] = [2, 8, 10, 16];

const expressionSamples = [
  "(128 + 0xFF) * 2",
  "pow(2, 10)",
  "0xFFFFFFFFFFFFFFFF",
  "sqrt(2) * 100",
];

export function NumberSuite() {
  const [tab, setTab] = useState<NumberTab>("radix");

  const [radixInput, setRadixInput] = useState("255");
  const [fromBase, setFromBase] = useState<Radix>(10);
  const [signed, setSigned] = useState(false);
  const [bits, setBits] = useState<BitWidth>(8);

  const [unitCategory, setUnitCategory] = useState<UnitCategory>("bytes");
  const [unitValue, setUnitValue] = useState("1048576");
  const [unitFrom, setUnitFrom] = useState("b");
  const [unitTo, setUnitTo] = useState("mib");

  const [expression, setExpression] = useState(expressionSamples[0]);

  const [floatInput, setFloatInput] = useState("3.14");
  const [floatPrecision, setFloatPrecision] = useState<FloatPrecision>(64);

  const [percentMode, setPercentMode] = useState<PercentMode>("change");
  const [percentA, setPercentA] = useState("100");
  const [percentB, setPercentB] = useState("125");

  const radixResult = useMemo(
    () => convertRadix(radixInput, fromBase, signed, bits),
    [bits, fromBase, radixInput, signed],
  );

  const unitUnits = unitCategories[unitCategory].units;

  const unitResult = useMemo(() => {
    const numeric = Number(unitValue);
    return convertUnitValue(numeric, unitFrom, unitTo, unitCategory);
  }, [unitCategory, unitFrom, unitTo, unitValue]);

  const expressionResult = useMemo(() => evaluateExpression(expression), [expression]);

  const floatResult = useMemo(
    () => analyzeFloat(floatInput, floatPrecision),
    [floatInput, floatPrecision],
  );

  const percentResult = useMemo(() => {
    const a = Number(percentA);
    const b = Number(percentB);
    return calculatePercent(percentMode, a, b);
  }, [percentA, percentB, percentMode]);

  const switchUnitCategory = (category: UnitCategory) => {
    setUnitCategory(category);
    const defaults = unitCategories[category].units;
    setUnitFrom(defaults[0].id);
    setUnitTo(defaults[Math.min(2, defaults.length - 1)].id);
  };

  return (
    <ToolShell
      slug="number"
      category="数値"
      title="Number Tools"
      description="基数変換、単位換算、式の評価、IEEE 754の確認、パーセント計算をブラウザ内で行います。"
      functionCount={5}
      tabs={radixTabs}
      activeTab={tab}
      onTabChange={(value) => setTab(value as NumberTab)}
    >
      {tab === "radix" ? (
        <>
          <div className="number-controls">
            <label className="control-label grow">
              入力（{fromBase}進）
              <input
                value={radixInput}
                onChange={(event) => setRadixInput(event.target.value)}
                spellCheck={false}
                autoComplete="off"
                name="radix-input"
              />
            </label>
            <label className="control-label">
              入力の基数
              <select
                value={fromBase}
                onChange={(event) => setFromBase(Number(event.target.value) as Radix)}
              >
                {radixBases.map((base) => (
                  <option key={base} value={base}>{base}進</option>
                ))}
              </select>
            </label>
            <label className="control-label">
              ビット幅
              <select
                value={bits}
                onChange={(event) => setBits(Number(event.target.value) as BitWidth)}
              >
                {bitWidths.map((width) => (
                  <option key={width} value={width}>{width} bit</option>
                ))}
              </select>
            </label>
            <label className="control-label checkbox-inline">
              <input
                type="checkbox"
                checked={signed}
                onChange={(event) => setSigned(event.target.checked)}
              />
              符号付き（2の補数）
            </label>
          </div>
          {radixResult.error ? (
            <div className="empty-result">{radixResult.error}</div>
          ) : (
            <div className="date-results number-radix-results">
              {radixBases.map((base) => (
                <div key={base}>
                  <span>{base}進</span>
                  <strong>{radixResult.outputs[base]}</strong>
                  <CopyButton value={radixResult.outputs[base]} />
                </div>
              ))}
              <div>
                <span>2進（{bits}bit）</span>
                <strong className="bit-string">{radixResult.binaryBits}</strong>
                <CopyButton value={radixResult.binaryBits} />
              </div>
              <div>
                <span>16進（ゼロ埋め）</span>
                <strong>0x{radixResult.hexPadded}</strong>
                <CopyButton value={`0x${radixResult.hexPadded}`} />
              </div>
              {signed && radixResult.signedValue !== null ? (
                <div>
                  <span>符号付き10進</span>
                  <strong>{radixResult.signedValue.toString()}</strong>
                </div>
              ) : null}
            </div>
          )}
          <ToolStatus error={radixResult.error}>
            マイナス値は10進入力時に2の補数へ変換します
          </ToolStatus>
        </>
      ) : null}

      {tab === "unit" ? (
        <>
          <div className="segmented-control" aria-label="単位カテゴリ">
            {(Object.keys(unitCategories) as UnitCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                className={unitCategory === category ? "active" : ""}
                onClick={() => switchUnitCategory(category)}
              >
                {unitCategories[category].label}
              </button>
            ))}
          </div>
          <div className="number-controls">
            <label className="control-label grow">
              値
              <input
                value={unitValue}
                onChange={(event) => setUnitValue(event.target.value)}
                inputMode="decimal"
                name="unit-value"
              />
            </label>
            <label className="control-label">
              変換元
              <select value={unitFrom} onChange={(event) => setUnitFrom(event.target.value)}>
                {unitUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.label}</option>
                ))}
              </select>
            </label>
            <label className="control-label">
              変換先
              <select value={unitTo} onChange={(event) => setUnitTo(event.target.value)}>
                {unitUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.label}</option>
                ))}
              </select>
            </label>
          </div>
          {unitResult.error ? (
            <div className="empty-result">{unitResult.error}</div>
          ) : (
            <div className="timestamp-output">
              <span>
                {unitCategories[unitCategory].label} ·{" "}
                {unitUnits.find((unit) => unit.id === unitTo)?.label}
              </span>
              <strong>{formatUnitNumber(unitResult.result ?? 0)}</strong>
              <CopyButton value={String(unitResult.result ?? "")} />
            </div>
          )}
          <div className="unit-conversion-grid">
            {unitUnits.map((unit) => {
              const converted = convertUnitValue(
                Number(unitValue),
                unitFrom,
                unit.id,
                unitCategory,
              );
              return (
                <div key={unit.id}>
                  <span>{unit.label}</span>
                  <strong>{formatUnitNumber(converted.result ?? 0)}</strong>
                </div>
              );
            })}
          </div>
          <ToolStatus error={unitResult.error}>
            バイトは1024（KiB）と1000（KB）の両系統を用意しています
          </ToolStatus>
        </>
      ) : null}

      {tab === "expression" ? (
        <>
          <div className="single-input-bar">
            <label htmlFor="expression-input">EXPRESSION</label>
            <input
              id="expression-input"
              name="expression-input"
              value={expression}
              onChange={(event) => setExpression(event.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="expression-samples">
            {expressionSamples.map((sample) => (
              <button key={sample} type="button" onClick={() => setExpression(sample)}>
                {sample}
              </button>
            ))}
          </div>
          {expressionResult.error ? (
            <div className="empty-result">{expressionResult.error}</div>
          ) : expressionResult.value ? (
            <div className="timestamp-output">
              <span>
                RESULT · {expressionResult.kind === "bigint" ? "BIGINT" : "NUMBER"}
              </span>
              <strong>{expressionResult.value}</strong>
              <CopyButton value={expressionResult.value} />
            </div>
          ) : (
            <div className="empty-result">式を入力してください</div>
          )}
          <ToolStatus>
            + − × ÷ % ^、0x / 0b リテラル、sqrt / pow / min / max などに対応
          </ToolStatus>
        </>
      ) : null}

      {tab === "float" ? (
        <>
          <div className="number-controls">
            <label className="control-label grow">
              10進数
              <input
                value={floatInput}
                onChange={(event) => setFloatInput(event.target.value)}
                name="float-input"
              />
            </label>
            <label className="control-label">
              精度
              <select
                value={floatPrecision}
                onChange={(event) => setFloatPrecision(Number(event.target.value) as FloatPrecision)}
              >
                <option value={32}>32 bit（単精度）</option>
                <option value={64}>64 bit（倍精度）</option>
              </select>
            </label>
          </div>
          {floatResult.error ? (
            <div className="empty-result">{floatResult.error}</div>
          ) : floatInput.trim() ? (
            <>
              <div className="timestamp-output">
                <span>格納される値</span>
                <strong>{String(floatResult.value)}</strong>
                <CopyButton value={String(floatResult.value)} />
              </div>
              <div className="date-results">
                <div><span>符号</span><strong>{floatResult.signLabel}</strong></div>
                <div><span>指数（実数）</span><strong>{floatResult.exponent}</strong></div>
                <div><span>指数ビット</span><strong className="bit-string">{floatResult.exponentBits}</strong></div>
                <div><span>仮数ビット</span><strong className="bit-string">{floatResult.fractionBits}</strong></div>
                <div><span>ビット列</span><strong className="bit-string">{formatFloatBitsGrouped(floatResult.bits)}</strong></div>
                <div><span>HEX</span><strong>0x{floatResult.hex}</strong></div>
                <div><span>10進との差</span><strong>{floatResult.decimalError}</strong></div>
                <div><span>次に大きい値</span><strong>{floatResult.nextUp}</strong></div>
                <div><span>次に小さい値</span><strong>{floatResult.nextDown}</strong></div>
              </div>
              <ToolStatus>{floatResult.note}</ToolStatus>
            </>
          ) : (
            <div className="empty-result">数値を入力してください</div>
          )}
        </>
      ) : null}

      {tab === "percent" ? (
        <>
          <div className="segmented-control" aria-label="パーセント計算の種類">
            <button
              type="button"
              className={percentMode === "change" ? "active" : ""}
              onClick={() => setPercentMode("change")}
            >
              増減率
            </button>
            <button
              type="button"
              className={percentMode === "ratio" ? "active" : ""}
              onClick={() => setPercentMode("ratio")}
            >
              割合
            </button>
            <button
              type="button"
              className={percentMode === "diff" ? "active" : ""}
              onClick={() => setPercentMode("diff")}
            >
              A/B差分
            </button>
            <button
              type="button"
              className={percentMode === "reverse" ? "active" : ""}
              onClick={() => setPercentMode("reverse")}
            >
              逆算
            </button>
          </div>
          <div className="number-controls percent-inputs">
            <label className="control-label grow">
              {percentMode === "ratio" ? "部分" : percentMode === "reverse" ? "現在値" : "基準（A / 以前）"}
              <input
                value={percentA}
                onChange={(event) => setPercentA(event.target.value)}
                inputMode="decimal"
                name="percent-a"
              />
            </label>
            <label className="control-label grow">
              {percentMode === "ratio"
                ? "全体"
                : percentMode === "reverse"
                  ? "目標値"
                  : percentMode === "change"
                    ? "新しい値"
                    : "比較値 B"}
              <input
                value={percentB}
                onChange={(event) => setPercentB(event.target.value)}
                inputMode="decimal"
                name="percent-b"
              />
            </label>
          </div>
          {percentResult.error ? (
            <div className="empty-result">{percentResult.error}</div>
          ) : (
            <>
              <div className="timestamp-output">
                <span>RESULT</span>
                <strong>{percentResult.primary}</strong>
                <CopyButton value={percentResult.primary} />
              </div>
              <div className="date-results">
                {percentResult.lines.map((line) => (
                  <div key={line.label}>
                    <span>{line.label}</span>
                    <strong>{line.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
          <ToolStatus error={percentResult.error}>
            {percentMode === "reverse"
              ? "現在値から目標値へ到達するために必要な変化率を求めます"
              : "ダッシュボードやリリースノート向けの即席計算です"}
          </ToolStatus>
        </>
      ) : null}
    </ToolShell>
  );
}
