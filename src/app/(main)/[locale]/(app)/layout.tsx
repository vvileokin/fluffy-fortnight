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
        {/* 1180 → 1320: the three-across card grids were coming out ~370px on a
            desktop with room to spare, which is what made the tournament and
            giveaway cards read as small. Widening the column lifts every grid
            on the site by the same ~12% instead of special-casing one page. */}
        <main className="mx-auto w-full max-w-[1320px] px-3 pb-28 pt-3 sm:px-6 sm:pt-6 lg:pb-12">
          {children}
        </main>
      </div>
      <BottomNav />
    </>
  );
}
