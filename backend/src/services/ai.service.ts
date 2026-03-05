import { env } from "@/config/env";

export async function analyzeCropImage(imageBase64: string) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are an expert agricultural pathologist. Return strict JSON." },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this crop image and return diseaseName, confidence, cropType, severity, symptoms, treatment, prevention" },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
}
