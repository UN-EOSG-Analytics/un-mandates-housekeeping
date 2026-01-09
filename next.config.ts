import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    trailingSlash: true,
    reactStrictMode: true,
    poweredByHeader: false,
    images: { unoptimized: true },
}

export default nextConfig