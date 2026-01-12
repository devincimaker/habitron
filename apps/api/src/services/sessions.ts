import OpenAI from 'openai';
import { config } from '../config.js';
import type { CoachingSessionMessage } from '@habits-coach/shared';

const client = new OpenAI({ apiKey: config.openai.apiKey });

const SUMMARY_PROMPT = `You are summarizing a coaching conversation about habits and personal development.

Generate a SHORT, DESCRIPTIVE name (3-7 words) that captures the main topic or outcome of this conversation.

Examples of good summaries:
- Starting a morning meditation practice
- Overcoming evening snacking habits
- Planning weekly exercise routine
- Discussing work-life balance challenges
- Setting up a reading habit

Do NOT use generic names like "Coaching session" or "Habit discussion".
Do NOT wrap your response in quotes.
Focus on what makes THIS conversation unique.

Return ONLY the summary text, nothing else.`;

export async function generateSessionSummary(
  messages: CoachingSessionMessage[]
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: `Summarize this conversation:\n\n${conversationText}` },
    ],
    temperature: 0.3,
    max_tokens: 50,
  });

  let summary = response.choices[0]?.message?.content?.trim();

  if (!summary) {
    throw new Error('Failed to generate summary');
  }

  // Strip any surrounding quotes the AI might add
  summary = summary.replace(/^["']|["']$/g, '');

  return summary;
}
