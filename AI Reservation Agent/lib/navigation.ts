export type NavItem = {
  href: string;
  labelKey: string;
  phase?: number;
};

export const dashboardNav: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard" },
  { href: "/dashboard/calendar", labelKey: "calendar" },
  { href: "/dashboard/reservations", labelKey: "reservations" },
  { href: "/dashboard/customers", labelKey: "customers" },
  { href: "/dashboard/ai-chat", labelKey: "aiChat" },
  { href: "/dashboard/pricing", labelKey: "pricing" },
  { href: "/dashboard/payments", labelKey: "payments" },
  { href: "/dashboard/resort-info", labelKey: "resortInfo" },
  { href: "/dashboard/settings", labelKey: "settings" },
];

export const adminNav: NavItem[] = [
  { href: "/admin", labelKey: "organizations" },
  { href: "/admin/properties", labelKey: "properties", phase: 1 },
  { href: "/admin/ai-config", labelKey: "aiConfig", phase: 5 },
  { href: "/admin/integrations", labelKey: "integrations", phase: 7 },
  { href: "/admin/system", labelKey: "systemHealth", phase: 10 },
  { href: "/admin/logs", labelKey: "logs", phase: 10 },
];
