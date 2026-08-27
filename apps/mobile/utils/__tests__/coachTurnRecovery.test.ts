import type { CoachTurnRecord } from '@habits-coach/shared';
import { waitForTurn } from '../coachTurnRecovery';

const done: CoachTurnRecord = { prompt: 'Plan my day', status: 'done', reply: 'Here is the plan.' };
const failed: CoachTurnRecord = { prompt: 'Plan my day', status: 'failed', error: 'The coach ran into a problem.' };
const running: CoachTurnRecord = { prompt: 'Plan my day', status: 'running' };

describe('waitForTurn', () => {
  const sleep = jest.fn(async () => {});

  beforeEach(() => sleep.mockClear());

  it('asks straight away, then every poll interval, and resolves with the reply once the server has it', async () => {
    const load = jest.fn().mockResolvedValueOnce(running).mockResolvedValueOnce(running).mockResolvedValueOnce(done);

    await expect(waitForTurn('Plan my day', load, sleep)).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(load.mock.invocationCallOrder[0]).toBeLessThan(sleep.mock.invocationCallOrder[0]);
  });

  it('resolves with the failure once the server records one', async () => {
    const load = jest.fn().mockResolvedValue(failed);

    await expect(waitForTurn('Plan my day', load, sleep)).resolves.toBe(failed);
    expect(load).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('keeps polling through a failed poll and an empty record', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(done);

    await expect(waitForTurn('Plan my day', load, sleep)).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('keeps waiting through another turn’s record, and matches the untrimmed prompt it was given', async () => {
    const otherTurn: CoachTurnRecord = { prompt: 'Review my day', status: 'done', reply: 'Not yours.' };
    const load = jest.fn().mockResolvedValueOnce(otherTurn).mockResolvedValueOnce(done);

    await expect(waitForTurn('  Plan my day  ', load, sleep)).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('gives up once the six-minute cap is spent', async () => {
    const load = jest.fn().mockResolvedValue(running);

    await expect(waitForTurn('Plan my day', load, sleep)).resolves.toBeNull();
    // One poll every 2s for 6 minutes — a minute past the server's own cap.
    expect(load).toHaveBeenCalledTimes(180);
  });
});
