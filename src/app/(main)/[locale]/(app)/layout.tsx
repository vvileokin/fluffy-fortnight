import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { BottomNav } from "@/components/layout/BottomNav";
import { getSiteSettings } from "@/lib/db/settings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { promo } = await getSiteSettings();
  return (
    <>
      <Sidebar promo={promo} />
      <div className="lg:pl-[248px]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
