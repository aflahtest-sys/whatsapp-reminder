"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { chat } from "@/lib/services/ai";
import {
  getOrCreateConversation,
  getConversationMessages,
  addMessage,
  updateConversationStatus,
  listConversations,
  getConversationContext,
} from "@/lib/services/conversation";
import { getResortProperty } from "@/lib/services/property";

export type ActionResult = { ok: boolean; error?: string; data?: unknown };

async function requireOrgScope(): Promise<string> {
  const session = await auth();
  if (!session?.user || session.user.role === "PLATFORM_ADMIN") redirect("/login");
  if (!session.user.organizationId) redirect("/login");
  return session.user.organizationId;
}

export async function sendMessageAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const orgId = await requireOrgScope();
    const message = formData.get("message") as string | null;
    const customerId = formData.get("customerId") as string | null;

    if (!message || !customerId) {
      return { ok: false, error: "Message and customerId are required" };
    }

    const property = await getResortProperty(orgId);
    if (!property) {
      return { ok: false, error: "Property not found" };
    }

    const convResult = await getOrCreateConversation({
      organizationId: orgId,
      propertyId: property.id,
      customerId,
      channel: "WEB_CHAT",
    });
    if (!convResult.ok) {
      return { ok: false, error: convResult.error };
    }
    if (!convResult.data) {
      return { ok: false, error: "conversation_not_found" };
    }
    const conversation = convResult.data;

    await addMessage({
      conversationId: conversation.id,
      content: message,
      sender: "CUSTOMER",
    });

    const context = await getConversationContext(conversation.id, orgId) ?? [];

    const detectedLang = /[\u0600-\u06FF]/.test(message) ? "ar" : "en";

    const result = await chat({
      organizationId: orgId,
      propertyId: property.id,
      customerId,
      messages: context,
      language: detectedLang,
    });

    await addMessage({
      conversationId: conversation.id,
      content: result.content,
      sender: "AI",
      language: result.language,
      metadata: result.toolCalls.length > 0 ? { toolCalls: result.toolCalls } : undefined,
    });

    if (result.handoverRequested) {
      await updateConversationStatus(orgId, conversation.id, "NEEDS_ATTENTION");
    }

    return {
      ok: true,
      data: {
        conversationId: conversation.id,
        aiMessage: result.content,
        toolCalls: result.toolCalls,
        handoverRequested: result.handoverRequested,
        language: result.language,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function staffReplyAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    await requireOrgScope();
    const conversationId = formData.get("conversationId") as string | null;
    const message = formData.get("message") as string | null;

    if (!conversationId || !message) {
      return { ok: false, error: "conversationId and message required" };
    }

    const session = await auth();
    await addMessage({
      conversationId,
      content: message,
      sender: "STAFF",
      senderUserId: session?.user?.id,
    });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function takeOverAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const orgId = await requireOrgScope();
    const conversationId = formData.get("conversationId") as string | null;
    if (!conversationId) return { ok: false, error: "conversationId required" };

    await updateConversationStatus(orgId, conversationId, "HUMAN_HANDLING");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function releaseToAiAction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const orgId = await requireOrgScope();
    const conversationId = formData.get("conversationId") as string | null;
    if (!conversationId) return { ok: false, error: "conversationId required" };

    await updateConversationStatus(orgId, conversationId, "AI_HANDLING");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function loadConversationsAction(): Promise<{ conversations: unknown[] }> {
  const orgId = await requireOrgScope();
  const conversations = await listConversations(orgId);
  return { conversations };
}

export async function loadMessagesAction(conversationId: string): Promise<{ messages: unknown[]; conversation: unknown }> {
  const orgId = await requireOrgScope();
  const result = await getConversationMessages(conversationId, orgId);
  if (!result) return { messages: [], conversation: null };
  return { messages: result.messages, conversation: result.conversation };
}
