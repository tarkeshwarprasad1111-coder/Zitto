import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

/**
 * `MOBILE=1` switches the build to a fully static export, which is what gets
 * bundled inside the Android APK. The app reads every figure from
 * `lib/mock-data.ts` and makes no runtime API call, so the export is
 * self-contained and the packaged app works with no network at all.
 *
 * Keep it opt-in: the normal `next dev` / `next build` path stays a regular
 * Next.js app, so nothing is lost when the real API is wired up later.
 */
const isMobileBuild = process.env.MOBILE === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: {
    dirs: ['src'],
  },

  ...(isMobileBuild
    ? {
        output: 'export',
        // No Next server in the APK, so the image optimiser cannot run.
        images: { unoptimized: true },
        // Capacitor serves the export from the filesystem, where directory
        // URLs only resolve if the file is literally index.html.
        trailingSlash: true,
      }
    : {}),
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'framer-motion'],
  },
  // Response headers need a server to set them. A static export has none, and
  // Next refuses to build if this is present, so it is server-build only.
  ...(isMobileBuild
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
              ],
            },
          ];
        },
      }),
};

export default withNextIntl(nextConfig);
