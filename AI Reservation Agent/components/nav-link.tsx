"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={
        isActive
          ? "block rounded-lg bg-emerald-700/20 px-3 py-2 text-sm font-semibold text-emerald-50"
          : "block rounded-lg px-3 py-2 text-sm font-medium text-emerald-100/70 transition hover:bg-emerald-700/10 hover:text-emerald-50"
      }
    >
      {label}
    </Link>
  );
}
