import { Suspense } from "react";
import { AdminSectionsPage } from "./AdminSections";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

// Required for Next.js static export — pre-generate all section pages
export function generateStaticParams() {
  return [
    { slug: ["users"] },
    { slug: ["docks"] },
    { slug: ["resources"] },
    { slug: ["interests"] },
    { slug: ["abandoned"] },
    { slug: ["poi"] },
  ];
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 200,
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <AdminSectionsPage />
    </Suspense>
  );
}
