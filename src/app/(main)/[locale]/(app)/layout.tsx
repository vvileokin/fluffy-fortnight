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
      {/* Impeccable: Crafted Arena Atmosphere — fixed, behind everything, the
          light the whole product sits in. Decorative only, never announced. */}
      <div className="arena" aria-hidden />
      <Sidebar promo={promo} />
      <div className="lg:pl-[248px]">
        <Topbar />
        {/* Phones buy back a little width: 12px gutters instead of 16px, and a
            shorter run-in above the first section. Desktop is unchanged. */}
        <main className="mx-auto w-full max-w-[1180px] px-3 pb-28 pt-3 sm:px-6 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
