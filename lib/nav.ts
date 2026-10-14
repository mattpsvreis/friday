import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  Repeat,
  Settings,
  Tags,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** Primary nav (Settings rendered separately at sidebar bottom). */
export const APP_NAV: AppNavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/recurring", label: "Recurring", icon: Repeat },
  { href: "/expenses", label: "Expenses", icon: TrendingDown },
  { href: "/income", label: "Income", icon: TrendingUp },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/categories", label: "Categories", icon: Tags },
];

export const SETTINGS_NAV: AppNavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings,
};
