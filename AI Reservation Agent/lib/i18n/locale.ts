import "server-only";

import { cookies } from "next/headers";
import type { Locale } from "@/lib/i18n/dictionaries";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const value = cookieStore.get("locale")?.value;
  return value === "ar" ? "ar" : "en";
}
