"use client";

import { createTheme } from "@mui/material/styles";

// Maritime color palette
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#4FC3F7", // Light ocean blue
      light: "#80D8FF",
      dark: "#0288D1",
      contrastText: "#0A1929",
    },
    secondary: {
      main: "#FFB74D", // Warm sunset orange
      light: "#FFD54F",
      dark: "#F57C00",
      contrastText: "#0A1929",
    },
    background: {
      default: "#0A1929", // Deep navy
      paper: "#0D2137",
    },
    text: {
      primary: "#E3F2FD",
      secondary: "#90CAF9",
    },
    success: {
      main: "#66BB6A",
    },
    error: {
      main: "#EF5350",
    },
    warning: {
      main: "#FFA726",
    },
    divider: "rgba(79, 195, 247, 0.12)",
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid rgba(79, 195, 247, 0.12)",
          backdropFilter: "blur(20px)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 8,
        },
        contained: {
          boxShadow: "0 4px 14px rgba(79, 195, 247, 0.25)",
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-root": {
            borderRadius: 8,
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "rgba(13, 33, 55, 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(79, 195, 247, 0.12)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: "#0D2137",
          borderRight: "1px solid rgba(79, 195, 247, 0.12)",
        },
      },
    },
  },
});

export default theme;
