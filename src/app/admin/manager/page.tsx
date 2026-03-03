"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import BerthManagement from "./BerthManagement";

export default function ManagerPage() {
  return (
    <ProtectedRoute>
      <BerthManagement />
    </ProtectedRoute>
  );
}
