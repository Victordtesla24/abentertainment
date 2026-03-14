import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminShell } from "./AdminShell";

export const metadata = {
  title: "Admin Dashboard | AB Entertainment",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  return (
    <AdminShell displayName={displayName} email={email}>
      {children}
    </AdminShell>
  );
}
