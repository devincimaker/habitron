import { formatVoiceStatus, spokenDividerFor } from '../utils/voiceTranscript';

const MINUTE = 60_000;

describe('spokenDividerFor', () => {
  const messages = [
    { spoken: undefined, timestamp: 0 },
    { spoken: true, timestamp: 1 * MINUTE },
    { spoken: true, timestamp: 3 * MINUTE },
    { spoken: true, timestamp: 6 * MINUTE },
    { spoken: undefined, timestamp: 7 * MINUTE },
    { spoken: true, timestamp: 8 * MINUTE },
  ];

  it('marks the first message of a spoken run with how long the run lasted', () => {
    expect(spokenDividerFor(messages, 1)).toBe('Spoken · 5 min');
  });

  it('marks nothing else in the run, nor a typed message', () => {
    expect(spokenDividerFor(messages, 0)).toBeNull();
    expect(spokenDividerFor(messages, 2)).toBeNull();
    expect(spokenDividerFor(messages, 4)).toBeNull();
  });

  it('drops the duration for a run under a minute', () => {
    expect(spokenDividerFor(messages, 5)).toBe('Spoken');
  });
});

describe('formatVoiceStatus', () => {
  it('counts minutes into the session', () => {
    expect(formatVoiceStatus(0, 4 * MINUTE + 20_000)).toBe('Coaching · 4 min');
    expect(formatVoiceStatus(0, 20_000)).toBe('Coaching · just started');
  });
});
