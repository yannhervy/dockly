"use client";

import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import theme from "./theme";

/**
 * Theme registry component that wraps the MUI ThemeProvider and
 * CssBaseline for consistent styling throughout the app.
 * Uses AppRouterCacheProvider for proper SSR/CSR compatibility
 * with Next.js App Router, preventing hydration mismatches.
 */
export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
