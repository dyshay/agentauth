import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ['@xagentauth/core', '@xagentauth/react'],
}

export default nextConfig
