import type { Metadata, Viewport } from "next";
import { AdminChrome } from "@/components/admin/AdminChrome";
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
export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className={`${fontVars} h-full antialiased`}>
      <body className="min-h-full">
        <AdminChrome>{children}</AdminChrome>
      </body>
    </html>
  );
}
