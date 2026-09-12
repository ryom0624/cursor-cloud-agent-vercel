"use client";

import { DataConverterSuite } from "@/components/suites/data-converter";
import { CsvViewerSuite } from "@/components/suites/csv-viewer";
import { CsvViewerLegacySuite } from "@/components/suites/csv-viewer-legacy";
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
import { CronSuite, DateTimeSuite } from "@/components/suites/time-suites";

export const suiteSlugs = [
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
] as const;

export type SuiteSlug = (typeof suiteSlugs)[number];

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
  }
}
