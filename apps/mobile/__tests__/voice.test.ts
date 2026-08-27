import { pushLevelHistory, toVoiceControlMode } from '../utils/voice';

describe('toVoiceControlMode', () => {
  it('passes the recorder mode through while nothing is wrong', () => {
    expect(toVoiceControlMode('idle', null)).toBe('idle');
    expect(toVoiceControlMode('recording', null)).toBe('recording');
    expect(toVoiceControlMode('transcribing', null)).toBe('transcribing');
  });

  it('shows the error whatever the recorder mode says', () => {
    expect(toVoiceControlMode('recording', 'Failed to transcribe audio')).toBe('error');
    expect(toVoiceControlMode('idle', 'Failed to stop recording')).toBe('error');
  });
});

describe('pushLevelHistory', () => {
  it('puts the newest level first', () => {
    expect(pushLevelHistory([0.2, 0.1], 0.5, 4)).toEqual([0.5, 0.2, 0.1]);
  });

  it('drops the oldest once the window is full', () => {
    expect(pushLevelHistory([0.3, 0.2, 0.1], 0.9, 3)).toEqual([0.9, 0.3, 0.2]);
  });

  it('does not mutate the previous history', () => {
    const history = [0.1];
    pushLevelHistory(history, 0.7, 3);
    expect(history).toEqual([0.1]);
  });
});
