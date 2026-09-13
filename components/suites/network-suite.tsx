"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ToolShell, ToolStatus } from "@/components/tool-shell";
import {
  cidrToMask,
  describeSubnet,
  ipv4ToBinary,
  maskToCidr,
  recommendPrefixForHosts,
  splitSubnet,
} from "@/lib/network/ipv4";

type NetworkTab = "calculator" | "hosts" | "splitter" | "convert";

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function NetworkSuite() {
  const [tab, setTab] = useState<NetworkTab>("calculator");
  const [cidr, setCidr] = useState("192.168.10.0/24");
  const [hosts, setHosts] = useState("500");
  const [splitBase, setSplitBase] = useState("10.0.0.0/16");
  const [splitPrefix, setSplitPrefix] = useState("20");
  const [prefix, setPrefix] = useState("24");
  const [mask, setMask] = useState("255.255.255.0");
  const [binaryIp, setBinaryIp] = useState("192.168.10.0");

  const subnet = useMemo(() => {
    try {
      return { ok: true as const, value: describeSubnet(cidr) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Invalid CIDR" };
    }
  }, [cidr]);

  const recommended = useMemo(() => {
    try {
      return { ok: true as const, value: recommendPrefixForHosts(Number(hosts)) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Required Hosts を確認してください。" };
    }
  }, [hosts]);

  const split = useMemo(() => {
    try {
      return { ok: true as const, value: splitSubnet(splitBase, Number(splitPrefix)) };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "Invalid CIDR" };
    }
  }, [splitBase, splitPrefix]);

  const converted = useMemo(() => {
    try {
      return {
        mask: cidrToMask(Number(prefix)),
        prefix: maskToCidr(mask),
        binary: ipv4ToBinary(binaryIp),
        error: "",
      };
    } catch (error) {
      return {
        mask: "",
        prefix: 0,
        binary: "",
        error: error instanceof Error ? error.message : "Invalid CIDR",
      };
    }
  }, [binaryIp, mask, prefix]);

  return (
    <ToolShell
      slug="network"
      category="ネットワーク"
      title="Network Tools"
      description="IPv4のSubnet / CIDR計算をブラウザ内で行います。IPv6は今後追加できる構造にしています。"
      functionCount={6}
      tabs={[
        { id: "calculator", label: "Subnet" },
        { id: "hosts", label: "Required Hosts" },
        { id: "splitter", label: "Splitter" },
        { id: "convert", label: "Convert" },
      ]}
      activeTab={tab}
      onTabChange={(value) => setTab(value as NetworkTab)}
    >
      {tab === "calculator" && (
        <>
          <label className="control-label grow">
            CIDR
            <input value={cidr} onChange={(event) => setCidr(event.target.value)} spellCheck={false} />
          </label>
          {subnet.ok && (
            <div className="kv-grid">
              <Field label="Network Address" value={subnet.value.networkAddress} />
              <Field label="Broadcast Address" value={subnet.value.broadcastAddress} />
              <Field label="Subnet Mask" value={subnet.value.subnetMask} />
              <Field label="CIDR" value={`/${subnet.value.cidr}`} />
              <Field label="Total Addresses" value={subnet.value.totalAddresses} />
              <Field label="Usable Hosts" value={subnet.value.usableHosts} />
              <Field label="First Host" value={subnet.value.firstHost} />
              <Field label="Last Host" value={subnet.value.lastHost} />
              <Field label="IPv4 Binary" value={subnet.value.ipBinary} />
            </div>
          )}
          <ToolStatus error={subnet.ok ? undefined : subnet.error}>IPv4 MVPです。入力は外部へ送信しません。</ToolStatus>
        </>
      )}
      {tab === "hosts" && (
        <>
          <label className="control-label">
            Required Hosts
            <input value={hosts} onChange={(event) => setHosts(event.target.value)} />
          </label>
          {recommended.ok && (
            <div className="kv-grid">
              <Field label="Recommended CIDR" value={`/${recommended.value.prefix}`} />
              <Field label="Total Addresses" value={recommended.value.totalAddresses} />
              <Field label="Usable Hosts" value={recommended.value.usableHosts} />
              <Field label="Subnet Mask" value={recommended.value.subnetMask} />
            </div>
          )}
          <ToolStatus error={recommended.ok ? undefined : recommended.error}>必要ホスト数からプレフィックスを提案します</ToolStatus>
        </>
      )}
      {tab === "splitter" && (
        <>
          <div className="number-controls">
            <label className="control-label grow">Base CIDR<input value={splitBase} onChange={(event) => setSplitBase(event.target.value)} /></label>
            <label className="control-label">Split into /<input value={splitPrefix} onChange={(event) => setSplitPrefix(event.target.value)} /></label>
          </div>
          {split.ok && (
            <div className="suite-editor output-editor">
              <header>
                <span>{split.value.length} SUBNETS</span>
                <CopyButton value={split.value.join("\n")} />
              </header>
              <textarea readOnly value={split.value.join("\n")} />
            </div>
          )}
          <ToolStatus error={split.ok ? undefined : split.error}>例: 10.0.0.0/16 を /20 に分割</ToolStatus>
        </>
      )}
      {tab === "convert" && (
        <>
          <div className="number-controls">
            <label className="control-label">CIDR prefix<input value={prefix} onChange={(event) => setPrefix(event.target.value)} /></label>
            <label className="control-label grow">Subnet mask<input value={mask} onChange={(event) => setMask(event.target.value)} /></label>
            <label className="control-label grow">IPv4<input value={binaryIp} onChange={(event) => setBinaryIp(event.target.value)} /></label>
          </div>
          <div className="kv-grid">
            <Field label="CIDR → Mask" value={converted.mask} />
            <Field label="Mask → CIDR" value={`/${converted.prefix}`} />
            <Field label="IPv4 → Binary" value={converted.binary} />
          </div>
          <ToolStatus error={converted.error || undefined}>CIDR と Subnet Mask を相互変換します</ToolStatus>
        </>
      )}
    </ToolShell>
  );
}
