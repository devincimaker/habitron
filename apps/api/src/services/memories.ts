import OpenAI from 'openai';
import { config } from '../config.js';
import type { ExtractMemoriesRequest, ExtractMemoriesResponse, MemoryCategory } from '@habits-coach/shared';

const client = new OpenAI({
  apiKey: config.openai.apiKey,
});

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
- goal: Specific goals they want to achieve
- general: Other noteworthy information

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

Respond with JSON:
{
  "memories": [
    { "content": "The memory content", "category": "category_name" }
  ]
}

If no NEW meaningful memories can be extracted, return: { "memories": [] }`;

export async function extractMemories(
  messages: ExtractMemoriesRequest['messages'],
  existingMemories: ExistingMemory[] = []
): Promise<ExtractMemoriesResponse> {
  // Format conversation for extraction
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');

  // Format existing memories for deduplication context
  const existingMemoriesText =
    existingMemories.length > 0
      ? `\n\nEXISTING MEMORIES (do NOT duplicate these):\n${existingMemories.map((m) => `- [${m.category}] ${m.content}`).join('\n')}`
      : '';

  const response = await client.chat.completions.create({
    model: config.openai.model,
    messages: [
      { role: 'system', content: MEMORY_EXTRACTION_PROMPT },
      {
        role: 'user',
        content: `Extract memories from this conversation:\n\n${conversationText}${existingMemoriesText}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return { memories: [] };
  }

  const parsed = JSON.parse(content) as ExtractMemoriesResponse;
  return parsed;
}
