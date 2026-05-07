/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '500mb' },
    serverComponentsExternalPackages: []
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' }
    ]
  },
  webpack: (webpackConfig, { isServer }) => {
    if (isServer) {
      webpackConfig.externals = webpackConfig.externals || []
    }
    return webpackConfig
  }
}

export default config
