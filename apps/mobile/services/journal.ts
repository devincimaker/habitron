import { supabase } from './supabase';
import type {
  JournalEntry,
  JournalEntryDraft,
  JournalEntrySource,
  JournalMood,
} from '@habits-coach/shared';
import { getTodayDate } from '@habits-coach/shared';

interface DbJournalEntry {
  id: string;
  user_id: string;
  entry_date: string | null;
  content: string;
  mood: JournalMood | null;
  tags: string[] | null;
  source: JournalEntrySource;
  created_at: string;
  updated_at: string;
}

function mapDbJournalEntryToJournalEntry(entry: DbJournalEntry): JournalEntry {
  return {
    id: entry.id,
    entryDate: entry.entry_date ?? entry.created_at.slice(0, 10),
    content: entry.content,
    mood: entry.mood ?? undefined,
    tags: entry.tags ?? [],
    source: entry.source,
    createdAt: new Date(entry.created_at).getTime(),
    updatedAt: new Date(entry.updated_at).getTime(),
  };
}

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  return user.id;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) {
    return [];
  }

  const uniqueTags = new Map<string, string>();

  for (const rawTag of tags) {
    const normalized = rawTag.trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (!uniqueTags.has(key)) {
      uniqueTags.set(key, normalized);
    }
  }

  return Array.from(uniqueTags.values());
}

export async function getJournalEntries(limit = 50): Promise<JournalEntry[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching journal entries:', error);
    throw error;
  }

  return (data as DbJournalEntry[]).map(mapDbJournalEntryToJournalEntry);
}

export async function addJournalEntry(entry: JournalEntryDraft): Promise<JournalEntry> {
  const userId = await getCurrentUserId();

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      entry_date: entry.entryDate ?? getTodayDate(),
      content: entry.content,
      mood: entry.mood ?? null,
      tags: normalizeTags(entry.tags),
      source: entry.source ?? 'manual',
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding journal entry:', error);
    throw error;
  }

  return mapDbJournalEntryToJournalEntry(data as DbJournalEntry);
}

export async function updateJournalEntry(
  entryId: string,
  changes: Partial<JournalEntryDraft>
): Promise<JournalEntry> {
  const updateData: Partial<DbJournalEntry> = {};

  if (changes.entryDate !== undefined) updateData.entry_date = changes.entryDate;
  if (changes.content !== undefined) updateData.content = changes.content;
  if (changes.mood !== undefined) updateData.mood = changes.mood ?? null;
  if (changes.tags !== undefined) updateData.tags = normalizeTags(changes.tags);
  if (changes.source !== undefined) updateData.source = changes.source;

  const { data, error } = await supabase
    .from('journal_entries')
    .update(updateData)
    .eq('id', entryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating journal entry:', error);
    throw error;
  }

  return mapDbJournalEntryToJournalEntry(data as DbJournalEntry);
}

export async function deleteJournalEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    console.error('Error deleting journal entry:', error);
    throw error;
  }
}
