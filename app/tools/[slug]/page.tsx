import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolSuite, type SuiteSlug } from "@/components/tool-suite";
import { tools } from "@/lib/tools";

const slugs: SuiteSlug[] = [
  "data-converter",
  "csv-viewer",
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
  return <ToolSuite slug={slug as SuiteSlug} />;
}
