"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/server/actions";

export default function Nav({ faculty }: { faculty: boolean }) {
  const pathname = usePathname();

  const links = faculty
    ? [
        { href: "/", label: "Inventory" },
        { href: "/issued", label: "Issued Log" },
      ]
    : [{ href: "/", label: "Inventory" }];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-white">
            IV
          </span>
          <span className="text-base font-extrabold tracking-tight">NYU VIP Inventory</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#1b1a18] text-[#fbfaf7]"
                    : "text-muted hover:bg-[#efece4] hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {faculty ? (
            <form action={logoutAction}>
              <button type="submit" className="btn btn-ghost btn-sm ml-1">
                Sign out
              </button>
            </form>
          ) : (
            <Link href="/login" className="btn btn-ghost btn-sm ml-1">
              Faculty sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
