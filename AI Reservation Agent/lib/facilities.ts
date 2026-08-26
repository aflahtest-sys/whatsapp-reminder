export type FacilityIcon = {
  icon: string;
  labelEn: string;
  labelAr: string;
};

export const FACILITY_ICONS: FacilityIcon[] = [
  { icon: "pool", labelEn: "Swimming Pool", labelAr: "مسبح" },
  { icon: "kitchen", labelEn: "Kitchen", labelAr: "مطبخ" },
  { icon: "wifi", labelEn: "Wi-Fi", labelAr: "واي فاي" },
  { icon: "parking", labelEn: "Parking", labelAr: "موقف سيارات" },
  { icon: "family", labelEn: "Family-Friendly", labelAr: "مناسب للعائلات" },
  { icon: "garden", labelEn: "Garden", labelAr: "حديقة" },
  { icon: "bbq", labelEn: "Barbecue", labelAr: "شواء" },
  { icon: "ac", labelEn: "Air Conditioning", labelAr: "تكييف" },
  { icon: "tv", labelEn: "Smart TV", labelAr: "تلفاز" },
  { icon: "gym", labelEn: "Gym", labelAr: "صالة رياضية" },
];

export function facilityIconLabel(icon: string, locale: "en" | "ar"): string {
  const found = FACILITY_ICONS.find((f) => f.icon === icon);
  if (!found) return icon;
  return locale === "ar" ? found.labelAr : found.labelEn;
}

export function isFacility(value: unknown): value is {
  key: string;
  label_en: string;
  label_ar: string;
  icon: string;
} {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.key !== "string") return false;
  if (typeof v.label_en !== "string") return false;
  if (typeof v.label_ar !== "string") return false;
  if (typeof v.icon !== "string") return false;
  return v.label_en.trim() !== "" || v.label_ar.trim() !== "";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
