import type { Metadata, Viewport } from "next";
import ThemeRegistry from "@/theme/ThemeRegistry";
import { AuthProvider } from "@/context/AuthContext";
import LayoutRouter from "@/components/LayoutRouter";

export const viewport: Viewport = {
  themeColor: "#0a1929",
};

export const metadata: Metadata = {
  title: "Stegerholmens Hamn – Båtplats Näset Göteborg",
  description:
    "Stegerholmens Bryggförening – Båtplatser och hamnservice på Näset i Göteborg. Bryggförvaltning, sjösättning, markuppställning, köp & sälj och aktuella nyheter.",
  keywords: [
    "båtplats näset",
    "båtplats näset göteborg",
    "båtplats göteborg",
    "stegerholmen",
    "stegerholmens hamn",
    "stegerholmens bryggförening",
    "båthamn näset",
    "hamn näset göteborg",
    "bryggplats göteborg",
    "sjösättning näset",
    "markuppställning näset",
  ],
  manifest: "/manifest.json",
  metadataBase: new URL("https://stegerholmenshamn.se"),
  openGraph: {
    title: "Stegerholmens Hamn – Båtplats Näset Göteborg",
    description:
      "Båtplatser och hamnservice på Näset i Göteborg. Bryggförvaltning, sjösättning, markuppställning och mer.",
    url: "https://stegerholmenshamn.se",
    siteName: "Stegerholmens Hamn",
    locale: "sv_SE",
    type: "website",
    images: [
      {
        url: "/IMG20221112150016-EDIT.jpg",
        width: 1200,
        height: 630,
        alt: "Stegerholmens Hamn – Näset, Göteborg",
      },
    ],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeRegistry>
          <AuthProvider>
            <LayoutRouter>{children}</LayoutRouter>
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}

