import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingExcludes: { '/*': ['./data/**/*', './assets/**/*'] },
};

export default config;
