"use server";

import { requireOrgUser } from "@/lib/auth/guards";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getLocale } from "@/lib/i18n/locale";
import { getResortProperty } from "@/lib/services/property";
import { ChatInterface } from "@/components/ai-chat/chat-interface";

export default async function AiChatPage() {
  const session = await requireOrgUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  let propertyId: string | null = null;
  if (session.user.organizationId) {
    const property = await getResortProperty(session.user.organizationId);
    if (property) propertyId = property.id;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{dict.nav.aiChat}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {locale === "ar" ? "مساعد الحجز بالذكاء الاصطناعي" : "AI-powered booking assistant"}
        </p>
      </div>
      <ChatInterface
        propertyId={propertyId}
        locale={locale}
      />
    </div>
  );
}
