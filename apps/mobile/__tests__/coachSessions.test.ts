import type { CoachingSessionSummary } from '@habits-coach/shared';
import {
  buildMemoryWarning,
  formatSessionMeta,
  formatSessionStatus,
  sortSessions,
} from '../utils/coachSessions';

const NOW = new Date('2026-08-24T12:00:00');
const day = (iso: string) => new Date(iso).getTime();

function session(overrides: Partial<CoachingSessionSummary>): CoachingSessionSummary {
  return {
    id: 'id',
    name: 'Session',
    startedAt: day('2026-08-22T09:00:00'),
    endedAt: day('2026-08-22T09:30:00'),
    memoryCount: 0,
    ...overrides,
  };
}

describe('sortSessions', () => {
  it('puts open sessions first, then newest first', () => {
    const oldOpen = session({ id: 'old-open', startedAt: day('2026-08-01T09:00:00'), endedAt: null });
    const newer = session({ id: 'newer', startedAt: day('2026-08-23T09:00:00') });
    const older = session({ id: 'older', startedAt: day('2026-08-20T09:00:00') });

    expect(sortSessions([older, newer, oldOpen]).map((s) => s.id)).toEqual([
      'old-open',
      'newer',
      'older',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [session({ id: 'a' }), session({ id: 'b', endedAt: null })];
    sortSessions(input);
    expect(input.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('formatSessionMeta', () => {
  it('reads Open for an open session, with no date or memories', () => {
    expect(formatSessionMeta(session({ endedAt: null, memoryCount: 4 }), NOW)).toBe('Open');
  });

  it('shows memory count and date for a closed session', () => {
    expect(formatSessionMeta(session({ memoryCount: 3 }), NOW)).toBe('3 memories · Aug 22');
    expect(formatSessionMeta(session({ memoryCount: 1 }), NOW)).toBe('1 memory · Aug 22');
  });

  it('omits the memory count when there are none', () => {
    expect(formatSessionMeta(session({ memoryCount: 0 }), NOW)).toBe('Aug 22');
    expect(formatSessionMeta(session({ memoryCount: undefined }), NOW)).toBe('Aug 22');
  });

  it('adds the year for sessions from another year', () => {
    expect(
      formatSessionMeta(
        session({ startedAt: day('2020-06-20T14:00:00'), endedAt: day('2020-06-20T14:30:00') }),
        NOW
      )
    ).toBe('Jun 20, 2020');
  });
});

describe('formatSessionStatus', () => {
  it('describes an open session by when it started', () => {
    expect(formatSessionStatus(day('2026-08-20T09:00:00'), null, NOW)).toBe(
      'Started Aug 20 · still open'
    );
    expect(formatSessionStatus(day('2026-08-24T09:00:00'), null, NOW)).toBe(
      'Started today · still open'
    );
    expect(formatSessionStatus(day('2026-08-23T23:00:00'), null, NOW)).toBe(
      'Started yesterday · still open'
    );
  });

  it('describes a closed session by when it ended', () => {
    expect(
      formatSessionStatus(day('2026-08-20T09:00:00'), day('2026-08-22T09:30:00'), NOW)
    ).toBe('Ended Aug 22');
  });
});

describe('buildMemoryWarning', () => {
  it('is empty with no memories', () => {
    expect(buildMemoryWarning(undefined)).toBe('');
    expect(buildMemoryWarning(0)).toBe('');
  });

  it('uses the right noun', () => {
    expect(buildMemoryWarning(1)).toBe('\n\nThis will also delete 1 associated memory.');
    expect(buildMemoryWarning(2)).toBe('\n\nThis will also delete 2 associated memories.');
  });
});
