import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ToolSuite, type SuiteSlug } from "@/components/tool-suite";
import { tools } from "@/lib/tools";

const slugs: SuiteSlug[] = [
  "data-converter",
  "csv-viewer",
  "csv-viewer-beta",
  "csv-viewer-legacy",
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
      description: "CSVを貼り付けるかファイルで開き、文字化け・Excel変換事故・データ破壊を事前に検出します。入力データを外部送信せず、ブラウザ内で処理します。",
    };
  }
  if (slug === "csv-viewer-legacy") {
    return {
      title: "CSV Viewer Legacy | DevSmith",
      description: "正式版昇格前の安定版です。障害時のrollback確認用です。入力データを外部送信せず、ブラウザ内で処理します。",
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
  if (!slugs.includes(slug as SuiteSlug)) notFound();
  if (slug === "csv-viewer-beta") redirect("/tools/csv-viewer");
  return <ToolSuite slug={slug as SuiteSlug} />;
}
