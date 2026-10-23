import { config } from '../../config.js';

const SYSTEM_PROMPT = `You are a career advisor for recent university graduates.
You receive a graduate's assessment and a shortlist of candidate careers with their required skills.
Choose up to 5 careers ONLY from the candidates, rank them, and return strict JSON:
{"recommendations":[{"careerId":number,"score":0-100,"explanation":string,"roadmap":[{"skill":string,"priority":"high"|"medium"|"low","step":string}]}]}
Explanations must reference the graduate's actual skills, interests and major. Roadmap steps must be concrete and address skill gaps.`;

export function isAiEnabled() {
  const { provider, openai, gemini } = config.ai;
  return (provider === 'openai' && !!openai.apiKey) || (provider === 'gemini' && !!gemini.apiKey);
}

async function callOpenAI(userPrompt, signal) {
  const { apiKey, model } = config.ai.openai;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI request failed with ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

async function callGemini(userPrompt, signal) {
  const { apiKey, model } = config.ai.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini request failed with ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('');
}

export function buildPrompt(assessment, candidates) {
  return JSON.stringify({
    graduate: {
      major: assessment.major,
      graduationYear: assessment.graduationYear,
      interests: assessment.interests,
      skills: assessment.skills.map((s) => ({ name: s.name, level: s.level })),
    },
    candidates: candidates.map((c) => ({
      careerId: c.id,
      title: c.title,
      description: c.description,
      requiredSkills: c.skills.map((s) => ({ name: s.name, importance: s.importance, minLevel: s.minLevel })),
    })),
  });
}

// Calls the configured provider with a hard timeout and returns the raw JSON text.
export async function askAi(assessment, candidates) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const prompt = buildPrompt(assessment, candidates);
    const call = config.ai.provider === 'gemini' ? callGemini : callOpenAI;
    return await call(prompt, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}
