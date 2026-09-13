import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@duckdb/duckdb-wasm", "apache-arrow"],
};

export default nextConfig;
