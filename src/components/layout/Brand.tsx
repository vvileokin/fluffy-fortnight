import Image from "next/image";
// Plain next/link (not the i18n one): Brand is also used in the admin tree,
// which has no NextIntlClientProvider. Single-locale site, so "/" is correct.
import Link from "next/link";
import { cn } from "@/lib/utils";

/** CS2 UA brand logo (yellow CS2 lockup with the Ukrainian flag ribbon). */
export function Brand({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="CS2 UA — головна"
      className={cn("inline-flex items-center", className)}
    >
      <Image
        src="/brand/logo-cs2.png"
        alt="CS2 UA"
        width={220}
        height={165}
        priority
        className={cn(
          "w-auto object-contain -ml-1.5",
          compact ? "h-9" : "h-10",
        )}
      />
    </Link>
  );
}
