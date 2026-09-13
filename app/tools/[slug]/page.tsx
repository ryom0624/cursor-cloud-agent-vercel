import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ToolSuite } from "@/components/tool-suite";
import { isSuiteSlug, tools, type SuiteSlug } from "@/lib/tools";

export const dynamicParams = false;

export function generateStaticParams() {
  return tools
    .filter((tool) => tool.slug !== "json")
    .map((tool) => ({ slug: tool.slug }))
    .concat([
      { slug: "csv-viewer-beta" },
      { slug: "csv-viewer-legacy" },
      { slug: "csv-viewer-legacy2" },
    ]);
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
  if (!isSuiteSlug(slug)) notFound();
  return <ToolSuite slug={slug as SuiteSlug} />;
}
