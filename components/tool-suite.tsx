"use client";

import dynamic from "next/dynamic";
import { DataConverterSuite } from "@/components/suites/data-converter";
import { CsvViewerSuite } from "@/components/suites/csv-viewer";
import { CsvViewerLegacySuite } from "@/components/suites/csv-viewer-legacy";
import { CsvViewerLegacy2Suite } from "@/components/suites/csv-viewer-legacy2";
import {
  EncoderSuite,
  HashSuite,
  IdGeneratorSuite,
  JwtSuite,
} from "@/components/suites/security-suites";
import {
  DiffSuite,
  LoremSuite,
  PasswordSuite,
  RegexSuite,
  TextSuite,
} from "@/components/suites/text-suites";
import { NumberSuite } from "@/components/suites/number-suites";
import { CronSuite, DateTimeSuite } from "@/components/suites/time-suites";
import { SuiteLoading } from "@/components/suite-loading";
import { suiteSlugs, type SuiteSlug } from "@/lib/tools";

const SqlSuite = dynamic(
  () => import("@/components/suites/sql-suite").then((mod) => ({ default: mod.SqlSuite })),
  { ssr: false, loading: SuiteLoading },
);
const UrlSuite = dynamic(
  () => import("@/components/suites/url-suite").then((mod) => ({ default: mod.UrlSuite })),
  { ssr: false, loading: SuiteLoading },
);
const HttpSuite = dynamic(
  () => import("@/components/suites/http-suite").then((mod) => ({ default: mod.HttpSuite })),
  { ssr: false, loading: SuiteLoading },
);
const OpenApiSuite = dynamic(
  () => import("@/components/suites/openapi-suite").then((mod) => ({ default: mod.OpenApiSuite })),
  { ssr: false, loading: SuiteLoading },
);
const NetworkSuite = dynamic(
  () => import("@/components/suites/network-suite").then((mod) => ({ default: mod.NetworkSuite })),
  { ssr: false, loading: SuiteLoading },
);
const HarSuite = dynamic(
  () => import("@/components/suites/har-suite").then((mod) => ({ default: mod.HarSuite })),
  { ssr: false, loading: SuiteLoading },
);

export { suiteSlugs };
export type { SuiteSlug };

export function ToolSuite({ slug }: { slug: SuiteSlug }) {
  switch (slug) {
    case "data-converter":
      return <DataConverterSuite />;
    case "csv-viewer":
      return <CsvViewerSuite />;
    case "csv-viewer-beta":
      return <CsvViewerSuite />;
    case "csv-viewer-legacy":
      return <CsvViewerLegacySuite />;
    case "csv-viewer-legacy2":
      return <CsvViewerLegacy2Suite />;
    case "encoder":
      return <EncoderSuite />;
    case "jwt":
      return <JwtSuite />;
    case "hash":
      return <HashSuite />;
    case "id-generator":
      return <IdGeneratorSuite />;
    case "password":
      return <PasswordSuite />;
    case "regex":
      return <RegexSuite />;
    case "diff":
      return <DiffSuite />;
    case "text":
      return <TextSuite />;
    case "lorem":
      return <LoremSuite />;
    case "date-time":
      return <DateTimeSuite />;
    case "cron":
      return <CronSuite />;
    case "number":
      return <NumberSuite />;
    case "sql":
      return <SqlSuite />;
    case "url":
      return <UrlSuite />;
    case "http":
      return <HttpSuite />;
    case "openapi":
      return <OpenApiSuite />;
    case "network":
      return <NetworkSuite />;
    case "har":
      return <HarSuite />;
    default:
      return null;
  }
}
