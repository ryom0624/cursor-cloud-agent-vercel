import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ToolSuite, type SuiteSlug } from "@/components/tool-suite";
import { tools } from "@/lib/tools";

const slugs: SuiteSlug[] = [
  "data-converter",
  "csv-viewer",
  "csv-viewer-beta",
  "csv-viewer-legacy",
  "csv-viewer-legacy2",
  "mermaid",
  "encoder",
  "jwt",
  "hash",
  "id-generator",
  "password",
  "regex",
  "diff",
  "text",
  "lorem",
  "date-time",
  "cron",
  "number",
];

export const dynamicParams = false;

export function generateStaticParams() {
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug === "csv-viewer-beta") {
    return {
      title: "CSV Viewer | DevSmith",
      description: "CSVを開いて中身を見る。入力データを外部送信せず、ブラウザ内で処理します。",
    };
  }
  if (slug === "csv-viewer-legacy") {
    return {
      title: "CSV Viewer Legacy | DevSmith",
      description: "正式版昇格前の安定版です。障害時のrollback確認用です。入力データを外部送信せず、ブラウザ内で処理します。",
    };
  }
  if (slug === "csv-viewer-legacy2") {
    return {
      title: "CSV Viewer Legacy 2 | DevSmith",
      description: "Grid中心化前の正式版です。障害時の確認用です。入力データを外部送信せず、ブラウザ内で処理します。",
    };
  }
  const tool = tools.find((item) => item.href === `/tools/${slug}`);
  if (!tool) return {};
  return {
    title: `${tool.name} | DevSmith`,
    description: `${tool.description}。入力データを外部送信せず、ブラウザ内で処理します。`,
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "csv-viewer-beta") redirect("/tools/csv-viewer");
  if (!slugs.includes(slug as SuiteSlug)) notFound();
  return <ToolSuite slug={slug as SuiteSlug} />;
}
