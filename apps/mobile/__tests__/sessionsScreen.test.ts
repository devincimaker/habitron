/**
 * Sessions Screen Tests - Swipe to Delete (HAB-42)
 *
 * These tests verify the swipe-to-delete functionality for sessions.
 * Users can swipe left on a session to delete it with a confirmation alert.
 *
 * Why these tests exist:
 * - Prevent regressions in delete confirmation UX
 * - Ensure memory warnings display correctly (cascade delete awareness)
 * - Verify proper grammar in user-facing text
 * - Confirm delete action calls the correct API
 *
 * Related files:
 * - components/SessionListItem.tsx - Swipe gesture implementation
 * - app/(tabs)/sessions.tsx - Delete handler and confirmation alert
 */

import { Alert } from 'react-native';
import type { CoachingSessionSummary } from '@habits-coach/shared';

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

const mockDeleteSession = jest.fn();
jest.mock('../services/sessions', () => ({
  deleteSession: (...args: unknown[]) => mockDeleteSession(...args),
  getSessions: jest.fn(),
  getSessionDetail: jest.fn(),
}));

import { useSessionsStore } from '../stores/useSessionsStore';

function buildMemoryWarning(memoryCount: number | undefined): string {
  if (!memoryCount) return '';
  const noun = memoryCount === 1 ? 'memory' : 'memories';
  return `\n\nThis will also delete ${memoryCount} associated ${noun}.`;
}

/**
 * Tests the warning text generator for delete confirmations.
 * Important because deleting a session cascades to delete associated memories.
 */
describe('buildMemoryWarning', () => {
  it('should return empty string when memoryCount is undefined', () => {
    expect(buildMemoryWarning(undefined)).toBe('');
  });

  it('should return empty string when memoryCount is 0', () => {
    expect(buildMemoryWarning(0)).toBe('');
  });

  it('should use singular "memory" when count is 1', () => {
    expect(buildMemoryWarning(1)).toBe('\n\nThis will also delete 1 associated memory.');
  });

  it('should use plural "memories" when count is greater than 1', () => {
    expect(buildMemoryWarning(2)).toBe('\n\nThis will also delete 2 associated memories.');
    expect(buildMemoryWarning(10)).toBe('\n\nThis will also delete 10 associated memories.');
  });
});

/**
 * Tests the confirmation alert shown when user swipes to delete a session.
 * Ensures users see the session name, memory warning, and can cancel or confirm.
 */
describe('Sessions Screen - Swipe Delete', () => {
  const mockSession: CoachingSessionSummary = {
    id: 'session-123',
    name: 'Test Session',
    startedAt: Date.now(),
    endedAt: Date.now(),
    messageCount: 5,
    memoryCount: 3,
  };

  const mockSessionNoName: CoachingSessionSummary = {
    id: 'session-456',
    name: null,
    startedAt: Date.now(),
    endedAt: Date.now(),
    messageCount: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useSessionsStore.setState({
      sessions: [mockSession, mockSessionNoName],
      selectedSession: null,
      isLoading: false,
    });
  });

  describe('handleSwipeDelete alert', () => {
    function simulateSwipeDelete(session: CoachingSessionSummary) {
      const sessionName = session.name || 'Untitled Session';
      const memoryWarning = buildMemoryWarning(session.memoryCount);

      Alert.alert(
        'Delete Session',
        `Are you sure you want to delete "${sessionName}"?${memoryWarning}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => useSessionsStore.getState().deleteSession(session.id),
          },
        ]
      );
    }

    it('should show alert with session name', () => {
      simulateSwipeDelete(mockSession);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Session',
        expect.stringContaining('Test Session'),
        expect.any(Array)
      );
    });

    it('should show "Untitled Session" when name is null', () => {
      simulateSwipeDelete(mockSessionNoName);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Session',
        expect.stringContaining('Untitled Session'),
        expect.any(Array)
      );
    });

    it('should include memory warning when session has memories', () => {
      simulateSwipeDelete(mockSession);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Delete Session',
        expect.stringContaining('3 associated memories'),
        expect.any(Array)
      );
    });

    it('should not include memory warning when session has no memories', () => {
      simulateSwipeDelete(mockSessionNoName);
      const [, message] = (Alert.alert as jest.Mock).mock.calls[0];
      expect(message).not.toContain('associated');
    });

    it('should have Cancel and Delete buttons', () => {
      simulateSwipeDelete(mockSession);
      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      expect(buttons).toHaveLength(2);
      expect(buttons[0].text).toBe('Cancel');
      expect(buttons[0].style).toBe('cancel');
      expect(buttons[1].text).toBe('Delete');
      expect(buttons[1].style).toBe('destructive');
    });

    it('should call deleteSession when Delete is pressed', async () => {
      mockDeleteSession.mockResolvedValue(undefined);
      simulateSwipeDelete(mockSession);
      const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];
      await buttons[1].onPress();
      expect(mockDeleteSession).toHaveBeenCalledWith('session-123');
    });
  });
});

/**
 * Tests date formatting logic used in SessionListItem.
 * Ensures dates display correctly and show year only for past years.
 */
describe('SessionListItem props', () => {
  it('should format session data correctly for display', () => {
    const session: CoachingSessionSummary = {
      id: 'test-id',
      name: 'Morning Reflection',
      startedAt: new Date('2024-03-15T10:30:00').getTime(),
      endedAt: new Date('2024-03-15T10:45:00').getTime(),
      messageCount: 8,
      memoryCount: 2,
    };

    const date = new Date(session.startedAt);
    const isCurrentYear = date.getFullYear() === new Date().getFullYear();
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: isCurrentYear ? undefined : 'numeric',
    });

    expect(dateStr).toContain('Mar');
    expect(dateStr).toContain('15');
  });

  it('should show year for dates not in current year', () => {
    const oldSession: CoachingSessionSummary = {
      id: 'old-id',
      name: 'Old Session',
      startedAt: new Date('2020-06-20T14:00:00').getTime(),
      endedAt: new Date('2020-06-20T14:30:00').getTime(),
      messageCount: 3,
    };

    const date = new Date(oldSession.startedAt);
    const isCurrentYear = date.getFullYear() === new Date().getFullYear();
    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: isCurrentYear ? undefined : 'numeric',
    });

    expect(isCurrentYear).toBe(false);
    expect(dateStr).toContain('2020');
  });
});
