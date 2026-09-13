import { describe, expect, it } from "vitest";
import {
  cidrToMask,
  describeSubnet,
  ipv4ToBinary,
  maskToCidr,
  parseCidr,
  recommendPrefixForHosts,
  splitSubnet,
} from "./ipv4";

describe("CIDR calculation", () => {
  it("calculates network facts for 192.168.10.0/24", () => {
    const subnet = describeSubnet("192.168.10.0/24");
    expect(subnet.networkAddress).toBe("192.168.10.0");
    expect(subnet.broadcastAddress).toBe("192.168.10.255");
    expect(subnet.subnetMask).toBe("255.255.255.0");
    expect(subnet.cidr).toBe(24);
    expect(subnet.totalAddresses).toBe(256);
    expect(subnet.usableHosts).toBe(254);
    expect(subnet.firstHost).toBe("192.168.10.1");
    expect(subnet.lastHost).toBe("192.168.10.254");
  });

  it("handles /32 and /31 edge cases", () => {
    const host = describeSubnet("10.0.0.8/32");
    expect(host.totalAddresses).toBe(1);
    expect(host.usableHosts).toBe(1);
    expect(host.firstHost).toBe("10.0.0.8");
    const p2p = describeSubnet("10.0.0.0/31");
    expect(p2p.totalAddresses).toBe(2);
    expect(p2p.usableHosts).toBe(2);
  });

  it("rejects invalid addresses and prefixes", () => {
    expect(() => parseCidr("192.168.10.0/33")).toThrow(/Invalid CIDR/);
    expect(() => parseCidr("256.0.0.1/24")).toThrow(/Invalid CIDR/);
    expect(() => parseCidr("not-an-ip")).toThrow(/Invalid CIDR/);
  });
});

describe("Required hosts and splitter", () => {
  it("recommends /23 for 500 hosts", () => {
    const recommended = recommendPrefixForHosts(500);
    expect(recommended.prefix).toBe(23);
    expect(recommended.totalAddresses).toBe(512);
    expect(recommended.usableHosts).toBe(510);
  });

  it("splits 10.0.0.0/16 into /20 networks", () => {
    const parts = splitSubnet("10.0.0.0/16", 20);
    expect(parts).toHaveLength(16);
    expect(parts[0]).toBe("10.0.0.0/20");
    expect(parts[1]).toBe("10.0.16.0/20");
    expect(parts.at(-1)).toBe("10.0.240.0/20");
  });

  it("converts CIDR and mask in both directions", () => {
    expect(cidrToMask(24)).toBe("255.255.255.0");
    expect(maskToCidr("255.255.255.0")).toBe(24);
    expect(ipv4ToBinary("192.168.10.0")).toBe("11000000 10101000 00001010 00000000");
  });
});
