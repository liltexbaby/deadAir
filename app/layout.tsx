import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, M_PLUS_1p, Noto_Sans_JP, Zen_Kaku_Gothic_New } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// UI type. NieR: Automata's menus are set in FOT-Rodin, a commercial
// Japanese gothic that can't be served on the web; these are its closest free
// relatives. Noto Sans JP is the default; `?font=mplus` / `?font=zen` swap in
// the others for comparison (see FONT_SWITCH and globals.css). The
// alternates aren't preloaded, so nobody downloads them unless they're shown.
const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

// Headings face: Love Letter Typewriter (Dixie's Delights, 1996). Shareware —
// its licence requires registering it before professional use, so it must be
// registered before this ships for the client. See .ui-heading in globals.css.
const loveLetter = localFont({
  src: "./fonts/love-letter-typewriter.ttf",
  variable: "--font-heading",
  display: "swap",
});

const mPlus1p = M_PLUS_1p({
  variable: "--font-mplus",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  preload: false,
});

const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  preload: false,
});

// The `?retro` skin's PS1/PS2 menu serif (see globals.css). Not preloaded:
// browsers only fetch a font once something renders in it, so the default
// look never downloads it.
const retroSerif = Cormorant_Garamond({
  variable: "--font-retro",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  preload: false,
});

/**
 * `?retro` in the URL switches on the alternate PS1/PS2-style skin, by
 * setting data-retro on <html> before first paint (no flash of the default
 * look). Every retro rule lives in globals.css under html[data-retro].
 */
const RETRO_SWITCH = `try{if(new URLSearchParams(location.search).has('retro'))document.documentElement.setAttribute('data-retro','')}catch(e){}`;

/** `?font=mplus` or `?font=zen`: compare UI fonts (html[data-font] in globals.css). */
const FONT_SWITCH = `try{var f=new URLSearchParams(location.search).get('font');if(f)document.documentElement.setAttribute('data-font',f)}catch(e){}`;

export const metadata: Metadata = {
  title: "deadAir",
  description:
    "deadAir is a multidisciplinary & independent label. Betting on human achievement since 2021.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the fixed header sit under the notch and reach the screen edges; the
  // safe-area insets in globals.css keep content clear of it.
  viewportFit: "cover",
  // Matches the sky tone at the top of public/bg-power-lines-light.jpg.
  themeColor: "#f6f3ee",
  // Deliberately NOT setting maximumScale/userScalable — blocking pinch-zoom is
  // an accessibility regression.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${notoSansJp.variable} ${loveLetter.variable} ${mPlus1p.variable} ${zenKaku.variable} ${retroSerif.variable} h-full antialiased`}
      // RETRO_SWITCH / FONT_SWITCH may add attributes before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: RETRO_SWITCH + FONT_SWITCH }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
