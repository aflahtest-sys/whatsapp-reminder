import { prisma } from "@/lib/db";

export type ServiceResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function getOrCreateConversation(params: {
  organizationId: string;
  propertyId: string;
  customerId: string;
  channel: "WEB_CHAT" | "WHATSAPP" | "INSTAGRAM";
}): Promise<ServiceResult<Awaited<ReturnType<typeof prisma.conversation.findFirst>>>> {
  const property = await prisma.property.findFirst({
    where: { id: params.propertyId, organizationId: params.organizationId },
  });
  if (!property) return { ok: false, error: "Property not found" };

  const existing = await prisma.conversation.findFirst({
    where: {
      propertyId: params.propertyId,
      customerId: params.customerId,
      channel: params.channel,
      status: { not: "CLOSED" },
    },
    include: { customer: true, property: true },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existing) return { ok: true, data: existing };

  const conversation = await prisma.conversation.create({
    data: {
      propertyId: params.propertyId,
      customerId: params.customerId,
      channel: params.channel,
    },
    include: { customer: true, property: true },
  });
  return { ok: true, data: conversation };
}

export async function listConversations(
  organizationId: string,
  filters?: { status?: string }
) {
  const conversations = await prisma.conversation.findMany({
    where: {
      property: { organizationId },
      ...(filters?.status ? { status: filters.status as "AI_HANDLING" | "NEEDS_ATTENTION" | "HUMAN_HANDLING" | "CLOSED" } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      property: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
  });
  return conversations;
}

export async function getConversationMessages(
  conversationId: string,
  organizationId: string
) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      property: { organizationId },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!conversation) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return { conversation, messages };
}

export async function addMessage(params: {
  conversationId: string;
  sender: "CUSTOMER" | "AI" | "STAFF";
  content: string;
  language?: string;
  senderUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      sender: params.sender,
      content: params.content,
      language: params.language,
      senderUserId: params.senderUserId,
      metadata: params.metadata ? JSON.parse(JSON.stringify(params.metadata)) : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: new Date() },
  });

  return message;
}

export async function updateConversationStatus(
  organizationId: string,
  conversationId: string,
  status: "AI_HANDLING" | "NEEDS_ATTENTION" | "HUMAN_HANDLING" | "CLOSED",
  assignedStaffId?: string
): Promise<ServiceResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, property: { organizationId } },
  });
  if (!conversation) return { ok: false, error: "Conversation not found" };

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status,
      ...(assignedStaffId !== undefined && { assignedStaffId }),
    },
  });

  return { ok: true };
}

export async function getConversationContext(
  conversationId: string,
  organizationId: string,
  limit: number = 20
) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, property: { organizationId } },
  });
  if (!conversation) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const reversed = [...messages].reverse();

  return reversed.map((msg) => {
    if (msg.sender === "CUSTOMER") {
      return { role: "user" as const, content: msg.content };
    }
    if (msg.sender === "AI") {
      return { role: "assistant" as const, content: msg.content };
    }
    return {
      role: "user" as const,
      content: `[Staff]: ${msg.content}`,
    };
  });
}
