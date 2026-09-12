export type Radix = 2 | 8 | 10 | 16;
export type BitWidth = 8 | 16 | 32 | 64;

const bitMask = (bits: BitWidth) => (BigInt(1) << BigInt(bits)) - BigInt(1);

function stripRadixPrefix(input: string, base: Radix) {
  const trimmed = input.trim();
  if (base === 16 && /^0x/i.test(trimmed)) return trimmed.slice(2);
  if (base === 2 && /^0b/i.test(trimmed)) return trimmed.slice(2);
  if (base === 8 && /^0o/i.test(trimmed)) return trimmed.slice(2);
  return trimmed;
}

function parseDigits(input: string, base: Radix): bigint | null {
  const body = stripRadixPrefix(input, base);
  if (!body) return null;
  const pattern =
    base === 2
      ? /^[01_]+$/
      : base === 8
        ? /^[0-7_]+$/
        : base === 10
          ? /^-?\d[\d_]*$/
          : /^[0-9a-fA-F_]+$/;
  const normalized = body.replaceAll("_", "");
  if (!pattern.test(normalized)) return null;
  try {
    if (base === 10 && normalized.startsWith("-")) {
      return BigInt(normalized);
    }
    return BigInt(base === 16 ? `0x${normalized}` : base === 2 ? `0b${normalized}` : normalized);
  } catch {
    return null;
  }
}

export function maskToBitWidth(value: bigint, bits: BitWidth, signed: boolean) {
  const width = BigInt(bits);
  const masked = value & bitMask(bits);
  if (!signed) return masked;
  const signBit = BigInt(1) << (width - BigInt(1));
  if ((masked & signBit) === BigInt(0)) return masked;
  return masked - (BigInt(1) << width);
}

export function toTwosComplementBits(value: bigint, bits: BitWidth) {
  const width = BigInt(bits);
  const masked = value & bitMask(bits);
  return masked.toString(2).padStart(Number(width), "0");
}

export type RadixConversion = {
  error: string;
  signedValue: bigint | null;
  unsignedRaw: bigint | null;
  outputs: Record<Radix, string>;
  binaryBits: string;
  hexPadded: string;
};

export function convertRadix(
  input: string,
  fromBase: Radix,
  signed: boolean,
  bits: BitWidth,
): RadixConversion {
  const emptyOutputs: Record<Radix, string> = { 2: "", 8: "", 10: "", 16: "" };
  const parsed = parseDigits(input, fromBase);
  if (parsed === null) {
    return {
      error: "有効な数値を入力してください。",
      signedValue: null,
      unsignedRaw: null,
      outputs: emptyOutputs,
      binaryBits: "",
      hexPadded: "",
    };
  }

  let unsignedRaw: bigint;
  if (fromBase === 10 && parsed < BigInt(0)) {
    const width = BigInt(bits);
    unsignedRaw = (parsed + (BigInt(1) << width)) & bitMask(bits);
  } else if (parsed < BigInt(0)) {
    return {
      error: "2進・8進・16進では符号付きのマイナス表記は使えません。10進で入力してください。",
      signedValue: null,
      unsignedRaw: null,
      outputs: emptyOutputs,
      binaryBits: "",
      hexPadded: "",
    };
  } else {
    unsignedRaw = parsed & bitMask(bits);
  }

  const signedValue = maskToBitWidth(unsignedRaw, bits, signed);
  const outputs: Record<Radix, string> = {
    2: unsignedRaw.toString(2),
    8: unsignedRaw.toString(8),
    10: signed ? signedValue.toString(10) : unsignedRaw.toString(10),
    16: unsignedRaw.toString(16).toUpperCase(),
  };

  const digitWidth = Math.ceil(bits / 4);
  return {
    error: "",
    signedValue,
    unsignedRaw,
    outputs,
    binaryBits: toTwosComplementBits(unsignedRaw, bits),
    hexPadded: unsignedRaw.toString(16).toUpperCase().padStart(digitWidth, "0"),
  };
}

export type UnitCategory = "bytes" | "bitrate" | "time" | "si";

type UnitDef = { id: string; label: string; factor: number };

export const unitCategories: Record<
  UnitCategory,
  { label: string; baseLabel: string; units: UnitDef[] }
> = {
  bytes: {
    label: "データサイズ",
    baseLabel: "バイト",
    units: [
      { id: "b", label: "B（バイト）", factor: 1 },
      { id: "kib", label: "KiB", factor: 1024 },
      { id: "mib", label: "MiB", factor: 1024 ** 2 },
      { id: "gib", label: "GiB", factor: 1024 ** 3 },
      { id: "tib", label: "TiB", factor: 1024 ** 4 },
      { id: "kb", label: "KB（10³）", factor: 1000 },
      { id: "mb", label: "MB（10⁶）", factor: 1000 ** 2 },
      { id: "gb", label: "GB（10⁹）", factor: 1000 ** 3 },
      { id: "tb", label: "TB（10¹²）", factor: 1000 ** 4 },
    ],
  },
  bitrate: {
    label: "転送速度",
    baseLabel: "bps",
    units: [
      { id: "bps", label: "bps", factor: 1 },
      { id: "kbps", label: "Kbps", factor: 1000 },
      { id: "mbps", label: "Mbps", factor: 1000 ** 2 },
      { id: "gbps", label: "Gbps", factor: 1000 ** 3 },
    ],
  },
  time: {
    label: "時間",
    baseLabel: "秒",
    units: [
      { id: "ns", label: "ナノ秒", factor: 1e-9 },
      { id: "us", label: "マイクロ秒", factor: 1e-6 },
      { id: "ms", label: "ミリ秒", factor: 1e-3 },
      { id: "s", label: "秒", factor: 1 },
      { id: "min", label: "分", factor: 60 },
      { id: "h", label: "時間", factor: 3600 },
    ],
  },
  si: {
    label: "SI接頭辞",
    baseLabel: "基準値",
    units: [
      { id: "y", label: "ヨタ (Y)", factor: 1e24 },
      { id: "z", label: "ゼタ (Z)", factor: 1e21 },
      { id: "e", label: "エクサ (E)", factor: 1e18 },
      { id: "p", label: "ペタ (P)", factor: 1e15 },
      { id: "t", label: "テラ (T)", factor: 1e12 },
      { id: "g", label: "ギガ (G)", factor: 1e9 },
      { id: "m", label: "メガ (M)", factor: 1e6 },
      { id: "k", label: "キロ (k)", factor: 1e3 },
      { id: "base", label: "（なし）", factor: 1 },
      { id: "milli", label: "ミリ (m)", factor: 1e-3 },
      { id: "micro", label: "マイクロ (µ)", factor: 1e-6 },
      { id: "nano", label: "ナノ (n)", factor: 1e-9 },
      { id: "pico", label: "ピコ (p)", factor: 1e-12 },
    ],
  },
};

export function convertUnitValue(
  value: number,
  fromId: string,
  toId: string,
  category: UnitCategory,
): { result: number | null; error: string } {
  if (!Number.isFinite(value)) {
    return { result: null, error: "有効な数値を入力してください。" };
  }
  const units = unitCategories[category].units;
  const from = units.find((unit) => unit.id === fromId);
  const to = units.find((unit) => unit.id === toId);
  if (!from || !to) return { result: null, error: "単位を選択してください。" };
  const base = value * from.factor;
  return { result: base / to.factor, error: "" };
}

export function formatUnitNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs === 0) return "0";
  if (abs >= 1e15 || abs < 1e-6) return value.toExponential(6);
  return value.toLocaleString("ja-JP", { maximumFractionDigits: 10 });
}

type Token =
  | { type: "number"; value: number }
  | { type: "bigint"; value: bigint }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

const IDENTIFIERS = new Set([
  "sin",
  "cos",
  "tan",
  "sqrt",
  "abs",
  "floor",
  "ceil",
  "round",
  "log",
  "log2",
  "log10",
  "pow",
  "min",
  "max",
  "PI",
  "E",
]);

function tokenizeExpression(source: string): { tokens: Token[]; error: string } {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }
    if ("()".includes(char)) {
      tokens.push({ type: "paren", value: char as "(" | ")" });
      index += 1;
      continue;
    }
    if ("+-*/%^".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }
    if (char === "0" && /^0[xX]/.test(source.slice(index, index + 2))) {
      const match = source.slice(index).match(/^0[xX][0-9a-fA-F_]+/);
      if (!match) return { tokens: [], error: "16進リテラルの形式が不正です。" };
      const digits = match[0].replace(/^0[xX]/, "").replaceAll("_", "");
      const asBig = BigInt(`0x${digits}`);
      if (asBig <= BigInt(Number.MAX_SAFE_INTEGER)) {
        tokens.push({ type: "number", value: Number(asBig) });
      } else {
        tokens.push({ type: "bigint", value: asBig });
      }
      index += match[0].length;
      continue;
    }
    if (char === "0" && /^0[bB]/.test(source.slice(index, index + 2))) {
      const match = source.slice(index).match(/^0[bB][01_]+/);
      if (!match) return { tokens: [], error: "2進リテラルの形式が不正です。" };
      const digits = match[0].replace(/^0[bB]/, "").replaceAll("_", "");
      const asBig = BigInt(`0b${digits}`);
      if (asBig <= BigInt(Number.MAX_SAFE_INTEGER)) {
        tokens.push({ type: "number", value: Number(asBig) });
      } else {
        tokens.push({ type: "bigint", value: asBig });
      }
      index += match[0].length;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = source.slice(index).match(/^[0-9][0-9_]*(?:\.[0-9_]+)?/);
      if (!match) return { tokens: [], error: "数値リテラルの形式が不正です。" };
      const normalized = match[0].replaceAll("_", "");
      if (normalized.endsWith("n")) {
        return { tokens: [], error: "整数リテラルに n サフィックスは不要です。大きい整数は16進で指定できます。" };
      }
      tokens.push({ type: "number", value: Number(normalized) });
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
      if (!match) return { tokens: [], error: "識別子の形式が不正です。" };
      const ident = match[0];
      if (!IDENTIFIERS.has(ident)) {
        return { tokens: [], error: `未対応の識別子です: ${ident}` };
      }
      tokens.push({ type: "ident", value: ident });
      index += match[0].length;
      continue;
    }
    return { tokens: [], error: `解釈できない文字です: ${char}` };
  }
  return { tokens, error: "" };
}

type NumValue = number | bigint;

class Parser {
  private tokens: Token[];
  private position = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek() {
    return this.tokens[this.position];
  }

  private consume() {
    return this.tokens[this.position++];
  }

  private expectParen(value: "(" | ")") {
    const token = this.consume();
    if (!token || token.type !== "paren" || token.value !== value) {
      throw new Error("括弧の対応が不正です。");
    }
  }

  parse(): NumValue {
    const value = this.parseExpression();
    if (this.position < this.tokens.length) {
      throw new Error("式の末尾に余分なトークンがあります。");
    }
    return value;
  }

  private parseExpression(): NumValue {
    return this.parseAddSub();
  }

  private parseAddSub(): NumValue {
    let left = this.parseMulDiv();
    while (this.peek()?.type === "op" && (this.peek() as { value: string }).value.match(/^[+-]$/)) {
      const op = (this.consume() as { type: "op"; value: string }).value;
      const right = this.parseMulDiv();
      left = this.combine(left, right, op);
    }
    return left;
  }

  private parseMulDiv(): NumValue {
    let left = this.parsePower();
    while (
      this.peek()?.type === "op"
      && (this.peek() as { value: string }).value.match(/^[\*%\/]$/)
    ) {
      const op = (this.consume() as { type: "op"; value: string }).value;
      const right = this.parsePower();
      left = this.combine(left, right, op);
    }
    return left;
  }

  private parsePower(): NumValue {
    let left = this.parseUnary();
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "^") {
      this.consume();
      const right = this.parseUnary();
      left = this.combine(left, right, "^");
    }
    return left;
  }

  private parseUnary(): NumValue {
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "-") {
      this.consume();
      const value = this.parseUnary();
      if (typeof value === "bigint") return -value;
      return -value;
    }
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "+") {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): NumValue {
    const token = this.peek();
    if (!token) throw new Error("式が途中で終わっています。");

    if (token.type === "number") {
      this.consume();
      return token.value;
    }
    if (token.type === "bigint") {
      this.consume();
      return token.value;
    }
    if (token.type === "ident") {
      this.consume();
      if (token.value === "PI") return Math.PI;
      if (token.value === "E") return Math.E;
      this.expectParen("(");
      const args: NumValue[] = [];
      if (this.peek()?.type !== "paren" || (this.peek() as { value: string }).value !== ")") {
        args.push(this.parseExpression());
        while (this.peek()?.type === "comma") {
          this.consume();
          args.push(this.parseExpression());
        }
      }
      this.expectParen(")");
      return this.callFunction(token.value, args);
    }
    if (token.type === "paren" && token.value === "(") {
      this.consume();
      const value = this.parseExpression();
      this.expectParen(")");
      return value;
    }
    throw new Error("数値・関数・括弧から始めてください。");
  }

  private combine(left: NumValue, right: NumValue, op: string): NumValue {
    if (typeof left === "bigint" || typeof right === "bigint") {
      if (op === "^") throw new Error("大きい整数ではべき乗 ^ は使えません。");
      const l = typeof left === "bigint" ? left : BigInt(left);
      const r = typeof right === "bigint" ? right : BigInt(right);
      if (op === "+") return l + r;
      if (op === "-") return l - r;
      if (op === "*") return l * r;
      if (op === "/") {
        if (r === BigInt(0)) throw new Error("0で割ることはできません。");
        return l / r;
      }
      if (op === "%") {
        if (r === BigInt(0)) throw new Error("0で割ることはできません。");
        return l % r;
      }
      throw new Error("大きい整数と小数の混在計算はできません。");
    }
    const l = left;
    const r = right;
    if (op === "+") return l + r;
    if (op === "-") return l - r;
    if (op === "*") return l * r;
    if (op === "/") {
      if (r === 0) throw new Error("0で割ることはできません。");
      return l / r;
    }
    if (op === "%") {
      if (r === 0) throw new Error("0で割ることはできません。");
      return l % r;
    }
    if (op === "^") return l ** r;
    throw new Error(`未対応の演算子: ${op}`);
  }

  private callFunction(name: string, args: NumValue[]): NumValue {
    const asNumbers = args.map((value) => {
      if (typeof value === "bigint") throw new Error(`${name} は大きい整数引数に対応していません。`);
      return value;
    });
    if (name === "min" || name === "max") {
      if (!asNumbers.length) throw new Error(`${name} には引数が必要です。`);
      return name === "min" ? Math.min(...asNumbers) : Math.max(...asNumbers);
    }
    if (asNumbers.length !== 1 && (name === "pow" ? asNumbers.length !== 2 : true)) {
      if (name === "pow" && asNumbers.length !== 2) {
        throw new Error("pow は2つの引数が必要です。");
      }
      if (name !== "pow" && asNumbers.length !== 1) {
        throw new Error(`${name} は1つの引数が必要です。`);
      }
    }
    switch (name) {
      case "sin":
        return Math.sin(asNumbers[0]);
      case "cos":
        return Math.cos(asNumbers[0]);
      case "tan":
        return Math.tan(asNumbers[0]);
      case "sqrt":
        return Math.sqrt(asNumbers[0]);
      case "abs":
        return Math.abs(asNumbers[0]);
      case "floor":
        return Math.floor(asNumbers[0]);
      case "ceil":
        return Math.ceil(asNumbers[0]);
      case "round":
        return Math.round(asNumbers[0]);
      case "log":
        return Math.log(asNumbers[0]);
      case "log2":
        return Math.log2(asNumbers[0]);
      case "log10":
        return Math.log10(asNumbers[0]);
      case "pow":
        return asNumbers[0] ** asNumbers[1];
      default:
        throw new Error(`未対応の関数: ${name}`);
    }
  }
}

export type ExpressionResult = {
  error: string;
  value: string;
  kind: "number" | "bigint" | "";
};

export function evaluateExpression(source: string): ExpressionResult {
  const trimmed = source.trim();
  if (!trimmed) return { error: "", value: "", kind: "" };
  const { tokens, error } = tokenizeExpression(trimmed);
  if (error) return { error, value: "", kind: "" };
  try {
    const parser = new Parser(tokens);
    const result = parser.parse();
    if (typeof result === "bigint") {
      return { error: "", value: result.toString(), kind: "bigint" };
    }
    if (!Number.isFinite(result)) {
      return { error: "結果が有限の数ではありません。", value: "", kind: "" };
    }
    return { error: "", value: String(result), kind: "number" };
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : "式を評価できません。",
      value: "",
      kind: "",
    };
  }
}

export type FloatPrecision = 32 | 64;

export type FloatAnalysis = {
  error: string;
  input: string;
  precision: FloatPrecision;
  sign: number;
  signLabel: string;
  exponent: number;
  exponentBits: string;
  fractionBits: string;
  bits: string;
  hex: string;
  value: number;
  decimalError: string;
  nextUp: string;
  nextDown: string;
  note: string;
};

function formatFloatBits(bits: string) {
  return `${bits.slice(0, 1)} ${bits.slice(1, 1 + (bits.length === 32 ? 8 : 11))} ${bits.slice(bits.length === 32 ? 9 : 12)}`;
}

function nextFloat64Step(value: number, direction: 1 | -1) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value);
  let bits = view.getBigUint64(0);
  if (value === 0) {
    view.setBigUint64(
      0,
      direction === 1 ? BigInt(1) : BigInt("0x8000000000000001"),
    );
    return view.getFloat64(0);
  }
  bits += BigInt(direction);
  view.setBigUint64(0, bits);
  return view.getFloat64(0);
}

function nextFloat64Up(value: number) {
  if (Number.isNaN(value)) return value;
  if (value === Infinity) return Infinity;
  if (value === -Infinity) return -Number.MAX_VALUE;
  return nextFloat64Step(value, 1);
}

function nextFloat64Down(value: number) {
  if (Number.isNaN(value)) return value;
  if (value === -Infinity) return -Infinity;
  if (value === Infinity) return Number.MAX_VALUE;
  return nextFloat64Step(value, -1);
}

function nextFloat32Step(value: number, direction: 1 | -1) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value);
  let bits = view.getUint32(0);
  if (value === 0) {
    view.setUint32(0, direction === 1 ? 1 : 0x80000001);
    return view.getFloat32(0);
  }
  bits += direction;
  view.setUint32(0, bits);
  return view.getFloat32(0);
}

function nextFloat32Up(value: number) {
  if (Number.isNaN(value)) return value;
  if (value === Infinity) return Infinity;
  if (value === -Infinity) return -3.4028235e38;
  return nextFloat32Step(value, 1);
}

function nextFloat32Down(value: number) {
  if (Number.isNaN(value)) return value;
  if (value === -Infinity) return -Infinity;
  if (value === Infinity) return 3.4028235e38;
  return nextFloat32Step(value, -1);
}

export function analyzeFloat(input: string, precision: FloatPrecision): FloatAnalysis {
  const empty: FloatAnalysis = {
    error: "",
    input,
    precision,
    sign: 0,
    signLabel: "",
    exponent: 0,
    exponentBits: "",
    fractionBits: "",
    bits: "",
    hex: "",
    value: NaN,
    decimalError: "",
    nextUp: "",
    nextDown: "",
    note: "",
  };
  const trimmed = input.trim();
  if (!trimmed) return { ...empty, error: "" };

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) && trimmed.toLowerCase() !== "nan" && trimmed.toLowerCase() !== "infinity" && trimmed.toLowerCase() !== "-infinity" && trimmed.toLowerCase() !== "inf" && trimmed.toLowerCase() !== "-inf") {
    return { ...empty, error: "有効な数値を入力してください。" };
  }

  const value =
    trimmed.toLowerCase() === "inf" || trimmed.toLowerCase() === "infinity"
      ? Infinity
      : trimmed.toLowerCase() === "-inf" || trimmed.toLowerCase() === "-infinity"
        ? -Infinity
        : trimmed.toLowerCase() === "nan"
          ? NaN
          : numeric;

  const buffer = new ArrayBuffer(precision === 32 ? 4 : 8);
  const view = new DataView(buffer);
  if (precision === 32) view.setFloat32(0, value);
  else view.setFloat64(0, value);

  const bytes = precision === 32 ? 4 : 8;
  let bits = "";
  for (let index = 0; index < bytes; index += 1) {
    bits += view.getUint8(index).toString(2).padStart(8, "0");
  }

  const sign = Number(bits[0]);
  const exponentBitsLength = precision === 32 ? 8 : 11;
  const exponentBits = bits.slice(1, 1 + exponentBitsLength);
  const fractionBits = bits.slice(1 + exponentBitsLength);
  const exponent = Number.parseInt(exponentBits, 2);
  const bias = precision === 32 ? 127 : 1023;

  let hex = "";
  for (let index = 0; index < bytes; index += 1) {
    hex += view.getUint8(index).toString(16).padStart(2, "0");
  }
  hex = hex.toUpperCase();

  const readValue = precision === 32 ? view.getFloat32(0) : view.getFloat64(0);
  const decimalError =
    Number.isFinite(numeric) && Number.isFinite(readValue)
      ? (readValue - numeric).toExponential(4)
      : "—";

  const nextUp = precision === 32 ? nextFloat32Up(readValue) : nextFloat64Up(readValue);
  const nextDown = precision === 32 ? nextFloat32Down(readValue) : nextFloat64Down(readValue);

  let note = "";
  if (Number.isNaN(value)) note = "NaN は IEEE 754 の非数表現です。";
  else if (!Number.isFinite(value)) note = "無限大は指数がすべて1・仮数が0のパターンです。";
  else if (exponent === 0) note = "非正規化数（サブノーマル）またはゼロに近い値です。";
  else note = "入力した10進数は、上記のビット列に丸められた近似値です。";

  return {
    error: "",
    input: trimmed,
    precision,
    sign,
    signLabel: sign === 0 ? "正 (0)" : "負 (1)",
    exponent: exponent - bias,
    exponentBits,
    fractionBits,
    bits,
    hex,
    value: readValue,
    decimalError,
    nextUp: Number.isFinite(nextUp) ? String(nextUp) : String(nextUp),
    nextDown: Number.isFinite(nextDown) ? String(nextDown) : String(nextDown),
    note,
  };
}

export type PercentMode = "change" | "ratio" | "diff" | "reverse";

export type PercentResult = {
  error: string;
  primary: string;
  lines: { label: string; value: string }[];
};

function percentFormat(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("ja-JP", { maximumFractionDigits: 6 })}%`;
}

export function calculatePercent(
  mode: PercentMode,
  a: number,
  b: number,
): PercentResult {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { error: "有効な数値を入力してください。", primary: "", lines: [] };
  }

  if (mode === "change") {
    if (a === 0) return { error: "基準値が0のため増減率を計算できません。", primary: "", lines: [] };
    const rate = ((b - a) / a) * 100;
    const delta = b - a;
    return {
      error: "",
      primary: percentFormat(rate),
      lines: [
        { label: "変化量", value: delta.toLocaleString("ja-JP", { maximumFractionDigits: 10 }) },
        { label: "倍率", value: (b / a).toLocaleString("ja-JP", { maximumFractionDigits: 10 }) },
        { label: "増減", value: rate >= 0 ? "増加" : "減少" },
      ],
    };
  }

  if (mode === "ratio") {
    if (b === 0) return { error: "全体が0のため割合を計算できません。", primary: "", lines: [] };
    const rate = (a / b) * 100;
    return {
      error: "",
      primary: percentFormat(rate),
      lines: [
        { label: "部分 / 全体", value: `${a} / ${b}` },
        { label: "残り", value: percentFormat(100 - rate) },
      ],
    };
  }

  if (mode === "diff") {
    if (a === 0) return { error: "基準Aが0のため差分率を計算できません。", primary: "", lines: [] };
    const delta = b - a;
    const rate = (delta / a) * 100;
    return {
      error: "",
      primary: percentFormat(rate),
      lines: [
        { label: "絶対差 (B−A)", value: delta.toLocaleString("ja-JP", { maximumFractionDigits: 10 }) },
        { label: "BはAの", value: percentFormat((b / a) * 100) },
      ],
    };
  }

  if (a === 0) return { error: "現在値が0のため必要な変化率を計算できません。", primary: "", lines: [] };
  const required = ((b - a) / a) * 100;
  const factor = b / a;
  return {
    error: "",
    primary: percentFormat(required),
    lines: [
      { label: "目標", value: b.toLocaleString("ja-JP", { maximumFractionDigits: 10 }) },
      { label: "達成倍率", value: factor.toLocaleString("ja-JP", { maximumFractionDigits: 10 }) },
      { label: "変化量", value: (b - a).toLocaleString("ja-JP", { maximumFractionDigits: 10 }) },
    ],
  };
}

export function formatFloatBitsGrouped(bits: string) {
  return formatFloatBits(bits);
}
