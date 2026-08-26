const mockFrom = jest.fn();
const mockGetUser = jest.fn();

jest.mock('../services/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

import { nextPositionForSection, reorderHabits } from '../services/habits';

/** Records what each update() wrote, and against which id. */
function captureUpdates() {
  const writes: { fields: Record<string, unknown>; id: string }[] = [];
  mockFrom.mockImplementation(() => ({
    update: (fields: Record<string, unknown>) => ({
      eq: (_column: string, id: string) => {
        writes.push({ fields, id });
        return Promise.resolve({ error: null });
      },
    }),
  }));
  return writes;
}

describe('habits service — reorderHabits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('writes snake_case section_id and position, one update per habit', async () => {
    const writes = captureUpdates();

    await reorderHabits([
      { id: 'habit-a', sectionId: 'afternoon', position: 0 },
      { id: 'habit-b', sectionId: 'morning', position: 1 },
    ]);

    expect(mockFrom).toHaveBeenCalledWith('habits');
    expect(writes).toEqual([
      { id: 'habit-a', fields: { section_id: 'afternoon', position: 0 } },
      { id: 'habit-b', fields: { section_id: 'morning', position: 1 } },
    ]);
  });

  it('writes a null section_id for the no-routine bucket', async () => {
    const writes = captureUpdates();

    await reorderHabits([{ id: 'habit-a', sectionId: null, position: 0 }]);

    expect(writes[0].fields).toEqual({ section_id: null, position: 0 });
  });

  it('throws when any update fails', async () => {
    mockFrom.mockImplementation(() => ({
      update: () => ({
        eq: (_column: string, id: string) =>
          Promise.resolve({ error: id === 'habit-b' ? { message: 'nope' } : null }),
      }),
    }));

    await expect(
      reorderHabits([
        { id: 'habit-a', sectionId: 'morning', position: 0 },
        { id: 'habit-b', sectionId: 'morning', position: 1 },
      ])
    ).rejects.toEqual({ message: 'nope' });
  });

  it('writes nothing when there is nothing to reorder', async () => {
    const writes = captureUpdates();
    await reorderHabits([]);
    expect(writes).toEqual([]);
  });
});

describe('habits service — nextPositionForSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  function mockHighest(rows: { position: number }[]) {
    const filters: { method: string; args: unknown[] }[] = [];
    const builder = {
      eq: (...args: unknown[]) => {
        filters.push({ method: 'eq', args });
        return builder;
      },
      is: (...args: unknown[]) => {
        filters.push({ method: 'is', args });
        return builder;
      },
      order: () => builder,
      limit: () => Promise.resolve({ data: rows, error: null }),
    };
    mockFrom.mockImplementation(() => ({ select: () => builder }));
    return filters;
  }

  it('returns one past the highest position in the routine', async () => {
    mockHighest([{ position: 4 }]);
    await expect(nextPositionForSection('morning')).resolves.toBe(5);
  });

  it('returns 0 for an empty routine', async () => {
    mockHighest([]);
    await expect(nextPositionForSection('morning')).resolves.toBe(0);
  });

  it('filters on IS NULL for the no-routine bucket, not eq', async () => {
    const filters = mockHighest([{ position: 1 }]);
    await nextPositionForSection(null);

    expect(filters).toEqual([{ method: 'is', args: ['section_id', null] }]);
  });
});
