import type { Metadata, Viewport } from "next";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { AdminDenied } from "@/components/admin/AdminDenied";
import { adminRole } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { fontVars } from "@/lib/fonts";
import "../../globals.css";

export const metadata: Metadata = {
  title: "Адмін-панель · CS2 UA",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#000913",
  colorScheme: "dark",
};

// Admin is a separate root layout — always Ukrainian, not localized.
// Access is decided here, on the server: without a grant the panel's pages are
// never rendered or sent at all, so there's nothing to poke at from the client.
export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await adminRole();
  const signedIn =
    role !== null ||
    !!(await (await createClient()).auth.getUser()).data.user;

  return (
    <html lang="uk" className={`${fontVars} h-full antialiased`}>
      <body className="min-h-full">
        {role ? (
          <AdminChrome role={role}>{children}</AdminChrome>
        ) : (
          <AdminDenied signedIn={signedIn} />
        )}
      </body>
    </html>
  );
}
