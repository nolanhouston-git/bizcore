"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/dateFormat";

const NAV_LINKS = [
  { href: "/",         label: "Dashboard", icon: "▦" },
  { href: "/expenses", label: "Expenses",  icon: "⊟" },
  { href: "/income",   label: "Income",    icon: "⊕" },
  { href: "/bank",     label: "Bank",      icon: "⊞" },
  { href: "/gusto",    label: "Gusto",     icon: "◎" },
  { href: "/tax",      label: "Tax",       icon: "§" },
  { href: "/compliance", label: "Compliance", icon: "✓" },
  { href: "/cashflow",   label: "Cash Flow",  icon: "⊘" },
  { href: "/loans",      label: "Loans",      icon: "⊟" },
  { href: "/members",  label: "Members",   icon: "◎" },
  { href: "/settings", label: "Settings",  icon: "⚙" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    // Fetch date format from settings, fall back to default
    fetch("/api/settings/date-format")
      .then(r => r.json())
      .then(d => setDateStr(formatDate(new Date().toISOString().slice(0, 10), d.format)))
      .catch(() => setDateStr(formatDate(new Date().toISOString().slice(0, 10), "Mon DD, YYYY")));
  }, []);

  return (
    <nav
      style={{ fontFamily: "'Outfit', sans-serif" }}
      className="sticky top-0 z-50 bg-[#0f1420]/95 backdrop-blur border-b border-[#1e2535] px-8 h-14 flex items-center gap-6"
    >
      <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4f8ef7] to-[#6366f1] flex items-center justify-center text-sm">
          ◈
        </div>
        <span className="font-mono text-sm font-semibold text-[#e8edf5] tracking-tight">
          BizCore
        </span>
      </Link>
      <div className="flex items-center gap-1">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-[#1e3a6e] text-[#4f8ef7] font-semibold"
                  : "text-[#4a566e] hover:text-[#8896b0] hover:bg-[#141926]"
              }`}
            >
              <span className="text-xs">{icon}</span>
              {label}
            </Link>
          );
        })}
      </div>
      <div className="ml-auto font-mono text-xs text-[#4a566e]">
        {dateStr}
      </div>
    </nav>
  );
}
