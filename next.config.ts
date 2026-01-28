import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude Node.js modules from client-side bundle
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        readline: false,
        child_process: false,
        'inquirer': false,
        '@bundlr-network/client': false,
      };
    }
    
    return config;
  },
  transpilePackages: [
    '@metaplex-foundation/umi',
    '@metaplex-foundation/umi-bundle-defaults',
    '@metaplex-foundation/mpl-token-metadata',
    '@metaplex-foundation/umi-signer-wallet-adapters',
    '@metaplex-foundation/umi-uploader-irys',
  ],
};

export default nextConfig;