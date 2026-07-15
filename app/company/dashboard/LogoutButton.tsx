"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function CompanyLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/company/logout", { method: "POST" });
    router.push("/company/auth");
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 text-sm text-fp-slate hover:text-fp-green transition-colors"
    >
      <LogOut className="w-4 h-4" />
      خروج
    </button>
  );
}
