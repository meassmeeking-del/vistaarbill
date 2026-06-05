import { createServerFn } from "@tanstack/react-start";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: { messages: ChatMessage[] }) => {
    if (!data || !Array.isArray(data.messages)) {
      throw new Error("messages must be an array");
    }
    const clean = data.messages
      .filter((m) => m && typeof m.content === "string" && m.content.length > 0)
      .slice(-12)
      .map((m) => ({
        role: m.role === "assistant" || m.role === "system" ? m.role : "user",
        content: m.content.slice(0, 2000),
      }));
    return { messages: clean };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "You are VistaarBill Assistant — a friendly helper for a small shop POS app. Help with billing, products, sales, GST/tax basics in India (₹), and quick tips. Keep replies concise (max 4-5 sentences), use simple Hinglish when the user does, and use bullet points for steps.",
          },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) {
      return { reply: "Bahut zyada requests — thodi der baad try karo.", error: "rate_limit" };
    }
    if (res.status === 402) {
      return { reply: "AI credits khatam ho gaye. Workspace billing me credits add karo.", error: "payment_required" };
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, t);
      return { reply: "Kuch gadbad ho gayi. Phir try karo.", error: "gateway_error" };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim() || "Hmm, kuch nahi mila.";
    return { reply };
  });