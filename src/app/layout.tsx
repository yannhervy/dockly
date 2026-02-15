import type { Metadata } from "next";
import ThemeRegistry from "@/theme/ThemeRegistry";
import { AuthProvider } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Dockly – Harbor Management System",
  description:
    "Manage berths, sea huts, boxes, and land storage for your harbor association.",
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
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
