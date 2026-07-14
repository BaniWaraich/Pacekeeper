import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse pulls in pdfjs-dist, which resolves modules/worker at runtime.
  // Bundling it breaks that resolution (POST /api/ingest/pdf → PDF_PARSE_FAILED),
  // so keep it external and require()'d at runtime on the Node server. §6.3.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
