export type Ipv4Cidr = {
  ip: number;
  prefix: number;
  dotted: string;
  cidr: string;
};

export type SubnetInfo = {
  input: string;
  networkAddress: string;
  broadcastAddress: string;
  subnetMask: string;
  wildcardMask: string;
  cidr: number;
  totalAddresses: number;
  usableHosts: number;
  firstHost: string;
  lastHost: string;
  ipBinary: string;
  maskBinary: string;
};

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function parseIpv4(input: string) {
  const match = input.trim().match(IPV4);
  if (!match) throw new Error("Invalid CIDR\nIPv4アドレスの形式ではありません。例: 192.168.10.0");
  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => octet > 255)) {
    throw new Error("Invalid CIDR\nオクテットは 0〜255 です。");
  }
  return ((octets[0] << 24) >>> 0) + (octets[1] << 16) + (octets[2] << 8) + octets[3];
}

export function intToIpv4(value: number) {
  const unsigned = value >>> 0;
  return [
    (unsigned >>> 24) & 255,
    (unsigned >>> 16) & 255,
    (unsigned >>> 8) & 255,
    unsigned & 255,
  ].join(".");
}

export function prefixToMask(prefix: number) {
  if (prefix < 0 || prefix > 32 || !Number.isInteger(prefix)) {
    throw new Error("Invalid CIDR\nプレフィックスは 0〜32 です。");
  }
  if (prefix === 0) return 0;
  return (0xffffffff << (32 - prefix)) >>> 0;
}

export function maskToPrefix(mask: string | number) {
  const value = typeof mask === "number" ? mask >>> 0 : parseIpv4(mask);
  const binary = value.toString(2).padStart(32, "0");
  if (!/^1*0*$/.test(binary)) {
    throw new Error("Invalid CIDR\n連続した1のサブネットマスクではありません。");
  }
  return binary.replaceAll("0", "").length;
}

export function parseCidr(input: string): Ipv4Cidr {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Invalid CIDR\nCIDRが空です。");
  const [ipPart, prefixPart] = trimmed.split("/");
  const ip = parseIpv4(ipPart);
  const prefix = prefixPart === undefined ? 32 : Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("Invalid CIDR\nプレフィックスは 0〜32 です。例: 192.168.10.0/24");
  }
  return {
    ip,
    prefix,
    dotted: intToIpv4(ip),
    cidr: `${intToIpv4(ip)}/${prefix}`,
  };
}

export function ipv4ToBinary(ip: string | number) {
  const value = typeof ip === "number" ? ip >>> 0 : parseIpv4(ip);
  return [
    ((value >>> 24) & 255).toString(2).padStart(8, "0"),
    ((value >>> 16) & 255).toString(2).padStart(8, "0"),
    ((value >>> 8) & 255).toString(2).padStart(8, "0"),
    (value & 255).toString(2).padStart(8, "0"),
  ].join(" ");
}

export function describeSubnet(input: string): SubnetInfo {
  const parsed = parseCidr(input);
  const mask = prefixToMask(parsed.prefix);
  const network = (parsed.ip & mask) >>> 0;
  const wildcard = ~mask >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = parsed.prefix === 0 ? 2 ** 32 : 2 ** (32 - parsed.prefix);
  const usable =
    parsed.prefix === 32 ? 1 : parsed.prefix === 31 ? 2 : Math.max(0, total - 2);
  const first = parsed.prefix >= 31 ? network : (network + 1) >>> 0;
  const last = parsed.prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;
  return {
    input: parsed.cidr,
    networkAddress: intToIpv4(network),
    broadcastAddress: intToIpv4(broadcast),
    subnetMask: intToIpv4(mask),
    wildcardMask: intToIpv4(wildcard),
    cidr: parsed.prefix,
    totalAddresses: total,
    usableHosts: usable,
    firstHost: intToIpv4(first),
    lastHost: intToIpv4(last),
    ipBinary: ipv4ToBinary(parsed.ip),
    maskBinary: ipv4ToBinary(mask),
  };
}

export function recommendPrefixForHosts(requiredHosts: number) {
  if (!Number.isInteger(requiredHosts) || requiredHosts < 1) {
    throw new Error("Required Hosts は 1 以上の整数です。");
  }
  for (let prefix = 32; prefix >= 0; prefix -= 1) {
    const total = prefix === 0 ? 2 ** 32 : 2 ** (32 - prefix);
    const usable = prefix === 32 ? 1 : prefix === 31 ? 2 : total - 2;
    if (usable >= requiredHosts) {
      return {
        prefix,
        totalAddresses: total,
        usableHosts: usable,
        subnetMask: intToIpv4(prefixToMask(prefix)),
      };
    }
  }
  throw new Error("IPv4で確保できるホスト数を超えています。");
}

export function splitSubnet(input: string, newPrefix: number) {
  const parsed = parseCidr(input);
  if (newPrefix < parsed.prefix || newPrefix > 32) {
    throw new Error(`Invalid CIDR\n分割先は /${parsed.prefix} より細かい 0〜32 のプレフィックスです。`);
  }
  const count = 2 ** (newPrefix - parsed.prefix);
  const size = newPrefix === 0 ? 2 ** 32 : 2 ** (32 - newPrefix);
  const network = (parsed.ip & prefixToMask(parsed.prefix)) >>> 0;
  return Array.from({ length: count }, (_, index) => {
    const address = (network + index * size) >>> 0;
    return `${intToIpv4(address)}/${newPrefix}`;
  });
}

export function cidrToMask(prefix: number) {
  return intToIpv4(prefixToMask(prefix));
}

export function maskToCidr(mask: string) {
  return maskToPrefix(mask);
}
