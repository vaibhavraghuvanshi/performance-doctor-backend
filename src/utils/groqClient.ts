import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.warn("GROQ_API_KEY is not set; AI analysis will fail until configured.");
}

const groq = new Groq({
  apiKey: apiKey ?? "",
  /** Default SDK timeout + retries can make `/analyze` appear “stuck” in DevTools for a long time. */
  timeout: 120_000,
  maxRetries: 0,
});

export async function callGroq(
  prompt: string,
  model = "meta-llama/llama-4-scout-17b-16e-instruct",
): Promise<string> {
  try {
    const response = await groq.chat.completions.create(
      {
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
      },
      { timeout: 120_000, maxRetries: 0 },
    );
    return response.choices[0].message.content ?? "";
  } catch (error) {
    console.error(
      "Groq API request failed",
      process.env.NODE_ENV === "production" ? "" : error,
    );
    throw new Error("Failed to fetch response from Groq API");
  }
}
