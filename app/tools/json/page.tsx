import type { Metadata } from "next";
import { JsonWorkbench } from "@/components/json-workbench";

export const metadata: Metadata = {
  title: "JSON Tools — 整形・検証・圧縮 | DevSmith",
  description:
    "JSONの整形、構文検証、圧縮、ツリー表示をブラウザ内で安全に行えます。",
};

export default function JsonToolsPage() {
  return <JsonWorkbench />;
}
