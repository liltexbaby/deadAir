import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
