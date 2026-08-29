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
