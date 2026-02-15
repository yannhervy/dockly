"use client";

import * as React from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";

/**
 * Theme registry component that wraps the MUI ThemeProvider and
 * CssBaseline for consistent styling throughout the app.
 * Handles SSR/CSR compatibility with Next.js App Router.
 */
export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
