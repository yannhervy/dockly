import type { Metadata } from "next";
import ThemeRegistry from "@/theme/ThemeRegistry";
import { AuthProvider } from "@/context/AuthContext";
import LayoutRouter from "@/components/LayoutRouter";

export const metadata: Metadata = {
  title: "Stegerholmens Hamn – Båtplatser & Hamnförening",
  description:
    "Stegerholmens Hamn – Båtplatser, bryggförvaltning och hamnservice i skärgården. Intresseanmälan, köp & sälj, och mer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeRegistry>
          <AuthProvider>
            <LayoutRouter>{children}</LayoutRouter>
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}

