"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Practice" },
  { href: "/progress", label: "Progress" },
  { href: "/history", label: "History" },
  { href: "/goals", label: "Goals" },
  { href: "/settings", label: "Settings" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="brand-lockup">
        <Link href="/" className="brand-name">
          Stagecraft
        </Link>
        <p className="brand-tag">Personal Toastmasters Coach</p>
      </div>
      <nav className="main-nav" aria-label="Primary">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={active ? "nav-link active" : "nav-link"}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
