import type { NextConfig } from 'next';

const config: NextConfig = {
  outputFileTracingExcludes: {
    '/*': ['./data/**/*', './assets/**/*', './reference/**/*', './contracts/**/*'],
  },
};

export default config;
