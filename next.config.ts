import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// This app lives inside a folder that has an unrelated package-lock.json above
// it; pin the workspace root so Next stops guessing. fileURLToPath (not
// URL.pathname) so directory names containing spaces survive.
const here = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: here },
};

export default nextConfig;
