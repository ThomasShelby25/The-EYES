import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '10.94.213.159', 'localhost'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ['pdfkit'],
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./node_modules/pdfkit/js/data/*.afm'],
    },
  },
};

export default nextConfig;
