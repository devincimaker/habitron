import type { CoachTurnRecord } from '@habits-coach/shared';
import { waitForTurn } from '../coachTurnRecovery';

const done: CoachTurnRecord = { prompt: 'Plan my day', status: 'done', reply: 'Here is the plan.' };
const failed: CoachTurnRecord = { prompt: 'Plan my day', status: 'failed', error: 'The coach ran into a problem.' };
const running: CoachTurnRecord = { prompt: 'Plan my day', status: 'running' };

describe('waitForTurn', () => {
  const sleep = jest.fn(async () => {});

  beforeEach(() => sleep.mockClear());

  it('waits a poll interval before asking, then resolves with the reply once the server has it', async () => {
    const load = jest.fn().mockResolvedValueOnce(running).mockResolvedValueOnce(running).mockResolvedValueOnce(done);

    await expect(waitForTurn(load, { sleep })).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(sleep.mock.invocationCallOrder[0]).toBeLessThan(load.mock.invocationCallOrder[0]);
  });

  it('resolves with the failure once the server records one', async () => {
    const load = jest.fn().mockResolvedValue(failed);

    await expect(waitForTurn(load, { sleep })).resolves.toBe(failed);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps polling through a failed poll and an empty record', async () => {
    const load = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(done);

    await expect(waitForTurn(load, { sleep })).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('gives up once the five-minute cap is spent', async () => {
    const load = jest.fn().mockResolvedValue(running);

    await expect(waitForTurn(load, { sleep })).resolves.toBeNull();
    // One poll every 2s for 5 minutes.
    expect(load).toHaveBeenCalledTimes(150);
  });
});
