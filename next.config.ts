import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives inside a folder that has an unrelated package-lock.json above
  // it; pin the workspace root so Next stops guessing.
  turbopack: { root: path.dirname(new URL(import.meta.url).pathname) },
};

export default nextConfig;
