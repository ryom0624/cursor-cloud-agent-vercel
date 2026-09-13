import { describe, expect, it } from "vitest";
import {
  analyzeFloat,
  calculatePercent,
  convertRadix,
  convertUnitValue,
  evaluateExpression,
} from "./number-utils";

describe("radix conversion", () => {
  it("converts unsigned 8-bit values", () => {
    const result = convertRadix("255", 10, false, 8);
    expect(result.error).toBe("");
    expect(result.outputs[16]).toBe("FF");
    expect(result.binaryBits).toBe("11111111");
  });

  it("converts values larger than 255 without truncating", () => {
    const result = convertRadix("4096", 10, false, 64);
    expect(result.error).toBe("");
    expect(result.outputs[10]).toBe("4096");
    expect(result.outputs[16]).toBe("1000");
    expect(result.outputs[2]).toBe("1000000000000");
  });

  it("keeps values that overflow the selected width instead of masking", () => {
    const result = convertRadix("256", 10, false, 8);
    expect(result.error).toBe("");
    expect(result.outputs[10]).toBe("256");
    expect(result.outputs[16]).toBe("100");
    expect(result.warning).toContain("8bit");
  });

  it("parses octal as base 8 rather than decimal", () => {
    const result = convertRadix("10", 8, false, 64);
    expect(result.outputs[10]).toBe("8");
  });

  it("interprets signed two's complement", () => {
    const result = convertRadix("-1", 10, true, 8);
    expect(result.signedValue).toBe(BigInt(-1));
    expect(result.binaryBits).toBe("11111111");
  });
});

describe("unit conversion", () => {
  it("converts bytes to KiB", () => {
    const result = convertUnitValue(1024, "b", "kib", "bytes");
    expect(result.result).toBe(1);
  });

  it("converts milliseconds to seconds", () => {
    const result = convertUnitValue(1500, "ms", "s", "time");
    expect(result.result).toBe(1.5);
  });
});

describe("expression evaluation", () => {
  it("evaluates hex literals and arithmetic", () => {
    expect(evaluateExpression("0xFF + 1").value).toBe("256");
  });

  it("evaluates bigint paths", () => {
    const result = evaluateExpression("0xFFFFFFFFFFFFFFFF");
    expect(result.kind).toBe("bigint");
    expect(result.value).toBe("18446744073709551615");
  });
});

describe("float analysis", () => {
  it("reports 64-bit representation for pi-like input", () => {
    const result = analyzeFloat("3.14", 64);
    expect(result.error).toBe("");
    expect(result.bits.length).toBe(64);
    expect(result.hex.length).toBe(16);
  });
});

describe("percent calculations", () => {
  it("calculates increase rate", () => {
    const result = calculatePercent("change", 100, 125);
    expect(result.primary).toBe("25%");
  });

  it("calculates required change for reverse mode", () => {
    const result = calculatePercent("reverse", 80, 100);
    expect(result.primary).toBe("25%");
  });
});
