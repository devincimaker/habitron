interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Formats conversation messages into a human-readable text format.
 * Converts role identifiers into readable labels (User/Coach).
 *
 * @param messages - Array of messages with role and content
 * @returns Formatted conversation text with each message on a new line
 */
export function formatConversationText(messages: Message[]): string {
  return messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Coach'}: ${m.content}`)
    .join('\n');
}
