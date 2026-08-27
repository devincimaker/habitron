import type { CoachTurnRecord } from '@habits-coach/shared';
import { finishedTurn, waitForTurn } from '../coachTurnRecovery';

const done: CoachTurnRecord = { prompt: 'Plan my day', status: 'done', reply: 'Here is the plan.' };
const failed: CoachTurnRecord = { prompt: 'Plan my day', status: 'failed', error: 'The coach ran into a problem.' };
const running: CoachTurnRecord = { prompt: 'Plan my day', status: 'running' };

describe('finishedTurn', () => {
  it('returns the record once the turn is done', () => {
    expect(finishedTurn(done, 'Plan my day')).toBe(done);
  });

  it('returns the record once the turn has failed', () => {
    expect(finishedTurn(failed, 'Plan my day')).toBe(failed);
  });

  it('is null while the turn is still running', () => {
    expect(finishedTurn(running, 'Plan my day')).toBeNull();
  });

  it('is null when the record belongs to another turn', () => {
    expect(finishedTurn(done, 'Review my habits')).toBeNull();
  });

  it('is null before the session has had a turn', () => {
    expect(finishedTurn(null, 'Plan my day')).toBeNull();
  });

  it('matches the prompt the way the server trimmed it', () => {
    expect(finishedTurn(done, '  Plan my day \n')).toBe(done);
  });
});

describe('waitForTurn', () => {
  const sleep = jest.fn(async () => {});
  const options = { pollMs: 2_000, capMs: 6_000, sleep };

  beforeEach(() => sleep.mockClear());

  it('resolves with the reply once the server has it', async () => {
    const load = jest.fn().mockResolvedValueOnce(running).mockResolvedValueOnce(running).mockResolvedValueOnce(done);

    await expect(waitForTurn(load, 'Plan my day', options)).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it('resolves with the failure once the server records one', async () => {
    const load = jest.fn().mockResolvedValue(failed);

    await expect(waitForTurn(load, 'Plan my day', options)).resolves.toBe(failed);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('keeps polling through a failed poll', async () => {
    const load = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(done);

    await expect(waitForTurn(load, 'Plan my day', options)).resolves.toBe(done);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('gives up once the cap is spent', async () => {
    const load = jest.fn().mockResolvedValue(running);

    await expect(waitForTurn(load, 'Plan my day', options)).resolves.toBeNull();
    // 0s, 2s, 4s, 6s: four polls inside a 6s cap, then done.
    expect(load).toHaveBeenCalledTimes(4);
  });
});
