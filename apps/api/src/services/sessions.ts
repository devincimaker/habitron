import type { CoachingSessionMessage } from '@habits-coach/shared';
import { runClaudeText } from '../coach/claude.js';

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

  const summary = (
    await runClaudeText({
      system: SUMMARY_PROMPT,
      prompt: `Summarize this conversation:\n\n${conversationText}`,
    })
  ).replace(/^["']|["']$/g, '');

  if (!summary) {
    throw new Error('Failed to generate summary');
  }

  return summary;
}
