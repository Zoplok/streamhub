/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: '500mb' },
    serverComponentsExternalPackages: ['bcrypt', '@mapbox/node-pre-gyp']
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
      { protocol: 'https', hostname: '**' }
    ]
  },
  webpack: (webpackConfig, { isServer }) => {
    if (isServer) {
      webpackConfig.externals = webpackConfig.externals || []
      webpackConfig.externals.push('bcrypt', '@mapbox/node-pre-gyp')
    }
    return webpackConfig
  }
}

export default config
