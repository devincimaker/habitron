import { describeCoachAction } from '../utils/coachProposal';

describe('describeCoachAction', () => {
  it('resolves existing todo titles for remove actions', () => {
    expect(
      describeCoachAction(
        {
          entity: 'todo',
          operation: 'remove',
          todoId: 'todo-1',
        },
        {
          todos: [
            {
              id: 'todo-1',
              title: 'Buy food',
              status: 'open',
              tags: [],
              sortOrder: 1,
              listId: 'list-1',
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        }
      )
    ).toBe('Remove task: Buy food');
  });

  it('disambiguates duplicate task titles in remove actions', () => {
    expect(
      describeCoachAction(
        {
          entity: 'todo',
          operation: 'remove',
          todoId: 'todo-2',
        },
        {
          todos: [
            {
              id: 'todo-1',
              title: 'Buy food',
              status: 'open',
              tags: [],
              sortOrder: 1,
              listId: 'list-1',
              createdAt: 0,
              updatedAt: 0,
            },
            {
              id: 'todo-2',
              title: 'Buy food',
              status: 'open',
              scheduledDate: '2026-04-13',
              scheduledTime: '13:00',
              tags: [],
              sortOrder: 2,
              listId: 'list-1',
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        }
      )
    ).toBe('Remove task: Buy food (scheduled 2026-04-13 at 13:00, id todo)');
  });
});
