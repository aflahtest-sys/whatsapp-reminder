import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { checkAvailability } from "@/lib/services/availability";
import { calculateBookingPrice } from "@/lib/services/pricing";
import { createReservation, cancelReservation, updateReservationDates } from "@/lib/services/reservation";
import { getAiKnowledge } from "@/lib/services/knowledgeBase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export type ChatToolResult = {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
};

export type ChatResponse = {
  content: string;
  toolCalls: ChatToolResult[];
  language: "en" | "ar";
  handoverRequested: boolean;
};

// ─── Tool definitions for OpenAI ───────────────────────────────

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Check if a property is available for given dates. Returns available boolean and reason if not.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "The property ID" },
          checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
        },
        required: ["propertyId", "checkIn", "checkOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_price",
      description: "Calculate the total price for a stay including per-night breakdown by season.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "The property ID" },
          checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
        },
        required: ["propertyId", "checkIn", "checkOut"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reservation",
      description: "Create a new reservation for a customer. Only call after confirming availability and price with the customer.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string", description: "The property ID" },
          customerId: { type: "string", description: "The customer ID" },
          checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)" },
          checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)" },
          guests: { type: "number", description: "Number of guests" },
        },
        required: ["propertyId", "customerId", "checkIn", "checkOut", "guests"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_reservation",
      description: "Look up an existing reservation by reservation ID or customer phone number.",
      parameters: {
        type: "object",
        properties: {
          reservationId: { type: "string", description: "The reservation ID" },
          customerPhone: { type: "string", description: "Customer phone number to search by" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "modify_reservation",
      description: "Modify an existing reservation's dates or guest count.",
      parameters: {
        type: "object",
        properties: {
          reservationId: { type: "string", description: "The reservation ID" },
          checkIn: { type: "string", description: "New check-in date (YYYY-MM-DD)" },
          checkOut: { type: "string", description: "New check-out date (YYYY-MM-DD)" },
          guests: { type: "number", description: "New guest count" },
        },
        required: ["reservationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_reservation",
      description: "Cancel an existing reservation.",
      parameters: {
        type: "object",
        properties: {
          reservationId: { type: "string", description: "The reservation ID" },
          reason: { type: "string", description: "Cancellation reason" },
        },
        required: ["reservationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "handover_to_staff",
      description: "Transfer the conversation to a human staff member. Use when: the customer asks for a discount, makes a complaint, you are unsure about something, or the customer explicitly asks to speak to a human.",
      parameters: {
        type: "object",
        properties: {
          reason: { type: "string", description: "Why you are handing over to staff" },
        },
        required: ["reason"],
      },
    },
  },
];

// ─── Tool execution ────────────────────────────────────────────

type ToolContext = {
  propertyId: string;
  customerId: string;
  organizationId: string;
};

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ChatToolResult> {
  try {
    let result: unknown;

    switch (name) {
      case "check_availability": {
        const r = await checkAvailability(
          ctx.propertyId,
          new Date(args.checkIn as string),
          new Date(args.checkOut as string)
        );
        result = r.available
          ? { available: true }
          : { available: false, reason: r.reason };
        break;
      }

      case "calculate_price": {
        const r = await calculateBookingPrice(
          ctx.propertyId,
          new Date(args.checkIn as string),
          new Date(args.checkOut as string)
        );
        if (!r.ok) { result = { error: r.error }; break; }
        result = r.data;
        break;
      }

      case "create_reservation": {
        const r = await createReservation(ctx.organizationId, {
          propertyId: ctx.propertyId,
          customerId: ctx.customerId,
          checkIn: new Date(args.checkIn as string),
          checkOut: new Date(args.checkOut as string),
          guests: args.guests as number,
          source: "WEB_CHAT",
        });
        if (!r.ok) { result = { error: r.error }; break; }
        result = {
          reservationId: r.data.id,
          status: r.data.status,
          totalPrice: Number(r.data.totalPrice),
          depositAmount: Number(r.data.depositAmount),
          remainingBalance: Number(r.data.remainingBalance),
        };
        break;
      }

      case "get_reservation": {
        if (args.reservationId) {
          const r = await prisma.reservation.findFirst({
            where: { id: args.reservationId as string, property: { organizationId: ctx.organizationId } },
            include: { customer: true, payments: true },
          });
          result = r ? serializeReservation(r) : { error: "not_found" };
        } else if (args.customerPhone) {
          const customer = await prisma.customer.findFirst({
            where: { organizationId: ctx.organizationId, phone: args.customerPhone as string },
          });
          if (!customer) { result = { error: "customer_not_found" }; break; }
          const reservations = await prisma.reservation.findMany({
            where: { customerId: customer.id },
            include: { customer: true },
            orderBy: { checkIn: "desc" },
          });
          result = reservations.map(serializeReservation);
        } else {
          result = { error: "provide_reservationId_or_customerPhone" };
        }
        break;
      }

      case "modify_reservation": {
        const updates: { checkIn?: Date; checkOut?: Date; guests?: number } = {};
        if (args.checkIn) updates.checkIn = new Date(args.checkIn as string);
        if (args.checkOut) updates.checkOut = new Date(args.checkOut as string);
        if (args.guests) updates.guests = args.guests as number;

        const r = await updateReservationDates(ctx.organizationId, args.reservationId as string, {
          checkIn: updates.checkIn ?? new Date(),
          checkOut: updates.checkOut ?? new Date(),
          guests: updates.guests ?? 2,
        });
        if (!r.ok) { result = { error: r.error }; break; }
        result = { success: true, reservation: serializeReservation(r.data) };
        break;
      }

      case "cancel_reservation": {
        const r = await cancelReservation(
          ctx.organizationId,
          args.reservationId as string,
          args.reason as string | undefined
        );
        if (!r.ok) { result = { error: r.error }; break; }
        result = { success: true, depositRefundable: r.data.depositRefundable };
        break;
      }

      case "handover_to_staff": {
        result = { success: true, reason: args.reason };
        break;
      }

      default:
        result = { error: `unknown_tool: ${name}` };
    }

    return { toolName: name, args, result, success: true };
  } catch (e) {
    return {
      toolName: name,
      args,
      result: { error: e instanceof Error ? e.message : "unknown_error" },
      success: false,
    };
  }
}

function serializeReservation(r: {
  id: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  nights: number;
  totalPrice: unknown;
  depositAmount: unknown;
  remainingBalance: unknown;
  status: string;
  cancellationReason: string | null;
  depositRefundable: boolean | null;
  customer?: { name: string; phone: string } | null;
}) {
  return {
    id: r.id,
    checkIn: r.checkIn.toISOString().split("T")[0],
    checkOut: r.checkOut.toISOString().split("T")[0],
    guests: r.guests,
    nights: r.nights,
    totalPrice: Number(r.totalPrice),
    depositAmount: Number(r.depositAmount),
    remainingBalance: Number(r.remainingBalance),
    status: r.status,
    cancellationReason: r.cancellationReason,
    depositRefundable: r.depositRefundable,
    customerName: r.customer?.name,
    customerPhone: r.customer?.phone,
  };
}

// ─── System prompt ─────────────────────────────────────────────

function buildSystemPrompt(
  propertyName: string,
  propertyId: string,
  customerId: string,
  knowledgeBase: string,
  language: "en" | "ar"
): string {
  const langInstruction = language === "ar"
    ? "You MUST respond entirely in Arabic (العربية). Do not use English except for proper nouns."
    : "You MUST respond entirely in English.";

  return `You are a friendly, professional booking assistant for ${propertyName}.

${langInstruction}

CRITICAL RULES:
- NEVER invent availability, prices, policies, facilities, or booking status. ALWAYS use the provided tools.
- NEVER make up prices or dates. Always call check_availability and calculate_price before confirming anything.
- You have access to a knowledge base for this property. Use it to answer questions about facilities, policies, and FAQs.
- When the customer wants to book, always: (1) check availability, (2) calculate price, (3) confirm with customer, (4) create reservation.
- Guest count must be <= 20. Politely decline if exceeded.
- For discount requests, complaints, uncertain situations, or if the customer says "talk to a human", call handover_to_staff.
- After creating a reservation, summarize: dates, guests, total price, deposit, remaining balance.

PROPERTY: ${propertyName} (ID: ${propertyId})
CUSTOMER ID: ${customerId}

KNOWLEDGE BASE:
${knowledgeBase || "No knowledge base entries configured."}

CONVERSATION FLOW:
1. Greet the customer warmly.
2. Understand their needs (dates, guests, purpose).
3. Check availability for their dates.
4. Calculate and share the price breakdown.
5. Ask for confirmation.
6. Create the reservation once confirmed.
7. Send a summary with deposit information.

If the customer changes their mind or wants to modify/cancel an existing reservation, help them with that too.`;
}

// ─── Main chat function ────────────────────────────────────────

export async function chat(params: {
  organizationId: string;
  propertyId: string;
  customerId: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  language: "en" | "ar";
}): Promise<ChatResponse> {
  const property = await prisma.property.findUnique({ where: { id: params.propertyId } });
  const propertyName = property?.name ?? "Our Resort";

  const aiKnowledge = await getAiKnowledge(params.propertyId);
  const knowledgeBase = aiKnowledge?.entries
    ?.map((e) => {
      const parts: string[] = [];
      if (e.type === "FAQ" && e.question) parts.push(`Q: ${e.question}`);
      parts.push(`A (EN): ${e.contentEn}`);
      parts.push(`A (AR): ${e.contentAr}`);
      return parts.join("\n");
    })
    .join("\n\n") ?? "";

  const systemPrompt = buildSystemPrompt(
    propertyName,
    params.propertyId,
    params.customerId,
    knowledgeBase,
    params.language
  );

  const allMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...params.messages,
  ];

  const toolCalls: ChatToolResult[] = [];
  let handoverRequested = false;
  const ctx: ToolContext = {
    propertyId: params.propertyId,
    customerId: params.customerId,
    organizationId: params.organizationId,
  };

  // Run tool calls in a loop (max 5 rounds)
  for (let round = 0; round < 5; round++) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: allMessages,
      tools,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    // If no tool calls, we're done
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      const content = assistantMessage.content ?? "";
      const detectedLang = detectLanguage(content);
      return { content, toolCalls, language: detectedLang, handoverRequested };
    }

    // Add assistant message to conversation
    allMessages.push(assistantMessage);

    // Execute each tool call
    for (const tc of assistantMessage.tool_calls) {
      if (tc.type !== "function") continue;
      const args = JSON.parse(tc.function.arguments);
      const toolResult = await executeTool(tc.function.name, args, ctx);
      toolCalls.push(toolResult);

      if (tc.function.name === "handover_to_staff") {
        handoverRequested = true;
      }

      // Add tool result to conversation
      allMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult.result),
      });
    }
  }

  // If we exhausted rounds, get a final response
  const finalResponse = await openai.chat.completions.create({
    model: MODEL,
    messages: allMessages,
  });
  const finalContent = finalResponse.choices[0].message.content ?? "";
  const detectedLang = detectLanguage(finalContent);
  return { content: finalContent, toolCalls, language: detectedLang, handoverRequested };
}

// ─── Language detection (simple heuristic) ─────────────────────

function detectLanguage(text: string): "en" | "ar" {
  const arabicChars = text.match(/[\u0600-\u06FF]/g);
  const totalChars = text.replace(/\s/g, "").length;
  if (!arabicChars || totalChars === 0) return "en";
  return arabicChars.length / totalChars > 0.3 ? "ar" : "en";
}
