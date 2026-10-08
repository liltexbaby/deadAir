import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next 16 blocks cross-origin requests to dev-only assets by default. The dev
  // server binds as `localhost`, so hitting it from a phone on the LAN
  // (http://192.168.1.154:3000) is a different origin and the /_next/static
  // JS chunks are refused — the HTML renders but no JavaScript runs, which
  // looks like a totally dead page.
  //
  // Dev-only; has no effect on a production build.
  allowedDevOrigins: ['192.168.1.154', '192.168.1.*', '*.local'],

  experimental: {
    serverActions: {
      // Covers and posters upload through Server Actions, whose default body
      // cap is 1 MB — real artwork is far bigger. The admin forms compress in
      // the browser first (lib/compressImage.ts), so uploads normally land
      // well under 1 MB; this is headroom, kept below the host's ~4.5 MB
      // request limit.
      bodySizeLimit: '4mb',
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        // Album covers and tour posters. Scoped to the public storage path so
        // this doesn't implicitly allow every route on the project host —
        // omitting `pathname` would imply '/**'.
        protocol: 'https',
        hostname: 'kkybtjxtdcdvrkexwdyr.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
