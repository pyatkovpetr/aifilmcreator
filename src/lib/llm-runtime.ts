export async function callConfiguredLlmJson(
  _role: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<unknown | null> {
  const url = process.env.AI_DIRECTOR_LLM_URL?.trim();
  const apiKey = process.env.AI_DIRECTOR_LLM_API_KEY?.trim();
  const model = process.env.AI_DIRECTOR_LLM_MODEL?.trim() || "gpt-4o-mini";
  if (!url) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        enable_thinking: false,
        chat_template_kwargs: { enable_thinking: false },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    try {
      return JSON.parse(content);
    } catch {
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]?.trim();
      return fenced ? JSON.parse(fenced) : null;
    }
  } catch (error) {
    console.warn("[ai-film-creator] optional LLM unavailable; fallback generator is active", error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
