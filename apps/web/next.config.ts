import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@swarsales/core", "@swarsales/agent-builder", "@xyflow/react", "@xyflow/system"],
};

export default nextConfig;
