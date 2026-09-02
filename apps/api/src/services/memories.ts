import type { ExtractMemoriesRequest, ExtractMemoriesResponse, MemoryCategory } from '@habits-coach/shared';
import { parseJsonReply, runClaudeText } from '../coach/claude.js';

interface ExistingMemory {
  content: string;
  category: MemoryCategory;
}

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction assistant. Your job is to identify NEW information about the user from a coaching conversation that would be valuable to remember for future sessions.

Extract memories that fall into these categories:
- motivation: Their underlying motivations, what drives them, their "why"
- obstacle: Challenges they face, patterns that hold them back
- preference: How they like to do things, scheduling preferences, communication style
- personal: Life circumstances, job, family, health context
- general: Other noteworthy information

A goal with a finish line and a date is not a memory: it lives in the goals list, which the coach manages with its own tools. Skip those.

Guidelines:
- Only extract information explicitly stated by the user
- Keep each memory concise (1-2 sentences)
- Focus on information that would help personalize future coaching
- Skip trivial or temporary information
- Extract 0-5 NEW memories maximum per conversation

CRITICAL - Deduplication rules:
- You will be given a list of EXISTING memories we already know about the user
- DO NOT extract anything that duplicates or restates existing memories
- DO NOT extract anything semantically similar to existing memories
  (e.g., "likes morning exercise" duplicates "prefers working out in the morning")
- Only extract genuinely NEW information not already covered by existing memories

Respond with JSON only, no prose around it:
{
  "memories": [
    { "content": "The memory content", "category": "category_name" }
  ]
}

If no NEW meaningful memories can be extracted, return: { "memories": [] }`;

const MEMORY_CATEGORIES: MemoryCategory[] = ['motivation', 'obstacle', 'preference', 'personal', 'general'];

export async function extractMemories(
  messages: ExtractMemoriesRequest['messages'],
  existingMemories: ExistingMemory[] = []
): Promise<ExtractMemoriesResponse> {
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');

  const existingMemoriesText =
    existingMemories.length > 0
      ? `\n\nEXISTING MEMORIES (do NOT duplicate these):\n${existingMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
      : '';

  const reply = await runClaudeText({
    system: MEMORY_EXTRACTION_PROMPT,
    prompt: `Extract memories from this conversation:\n\n${conversationText}${existingMemoriesText}`,
  });

  const parsed = parseJsonReply<{ memories?: unknown }>(reply);
  const memories = Array.isArray(parsed.memories) ? parsed.memories : [];

  return {
    memories: memories.flatMap((memory) => {
      if (
        typeof memory === 'object' &&
        memory !== null &&
        typeof (memory as { content?: unknown }).content === 'string' &&
        MEMORY_CATEGORIES.includes((memory as { category?: MemoryCategory }).category as MemoryCategory)
      ) {
        const { content, category } = memory as { content: string; category: MemoryCategory };
        return [{ content, category }];
      }
      return [];
    }),
  };
}
