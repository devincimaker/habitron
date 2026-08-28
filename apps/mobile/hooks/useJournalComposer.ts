import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { JournalEntry } from '@habits-coach/shared';

/** A param can arrive repeated (`?voice=1&voice=1`); expo-router hands those over as an array. */
type Param = string | string[] | undefined;

const first = (param: Param): string | undefined =>
  Array.isArray(param) ? param[0] : param;

export interface ComposerIntent {
  prompt: string | null;
  autoStartVoice: boolean;
}

/**
 * What `/journal?compose=1&voice=1&prompt=…` asks for, or null when the link
 * was not a request to compose. Pure, so the deep link's shape is testable
 * without a screen around it.
 */
export function readComposeIntent(params: {
  compose?: Param;
  voice?: Param;
  prompt?: Param;
}): ComposerIntent | null {
  if (!first(params.compose)) return null;
  const voice = first(params.voice);
  return {
    prompt: first(params.prompt) ?? null,
    autoStartVoice: voice === '1' || voice === 'true',
  };
}

export interface JournalComposer {
  entry: JournalEntry | null;
  isOpen: boolean;
  prompt: string | null;
  autoStartVoice: boolean;
  open: (options?: {
    entry?: JournalEntry | null;
    prompt?: string | null;
    autoStartVoice?: boolean;
  }) => void;
  close: () => void;
}

/**
 * The journal composer's lifecycle: what it is editing, and the deep link that
 * opens it. The link opens the editor once — the param is consumed by replacing
 * the route, so a re-render cannot reopen it.
 */
export function useJournalComposer(): JournalComposer {
  const router = useRouter();
  const params = useLocalSearchParams<{
    compose?: string | string[];
    voice?: string | string[];
    prompt?: string | string[];
  }>();

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [autoStartVoice, setAutoStartVoice] = useState(false);

  const open = useCallback<JournalComposer['open']>((options) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntry(options?.entry ?? null);
    setPrompt(options?.prompt ?? null);
    setAutoStartVoice(Boolean(options?.autoStartVoice));
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setEntry(null);
    setPrompt(null);
    setAutoStartVoice(false);
  }, []);

  // One link, one opening. Replacing the route is what clears the param, and
  // that lands a render or two later — long enough for a close in between to
  // look like a fresh request to compose.
  const consumed = useRef(false);

  useEffect(() => {
    const intent = readComposeIntent(params);
    if (!intent) {
      consumed.current = false;
      return;
    }
    if (consumed.current) return;
    consumed.current = true;
    open(intent);
    router.replace('/journal');
  }, [open, params, router]);

  return { entry, isOpen, prompt, autoStartVoice, open, close };
}
