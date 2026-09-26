import type { NextConfig } from 'next';

// Set on the hosted frontend only. The API keeps SQLite state and uploads on
// disk, so it must run on one persistent server rather than serverless.
const apiOrigin = process.env.API_PROXY_ORIGIN?.replace(/\/$/, '');

const config: NextConfig = {
  outputFileTracingExcludes: {
    '/*': ['./data/**/*', './assets/**/*', './reference/**/*', './contracts/**/*'],
  },
  async rewrites() {
    return apiOrigin
      ? { beforeFiles: [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }] }
      : { beforeFiles: [] };
  },
};

export default config;
