import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminDashboardClient } from "./AdminDashboardClient";

export default async function AdminDashboard() {
  // TEMPORARY BYPASS: Auth removed for testing without Live Keys.
  const userId = "demo-admin-id";
  // if (!userId) redirect("/sign-in");

  return <AdminDashboardClient />;
}
