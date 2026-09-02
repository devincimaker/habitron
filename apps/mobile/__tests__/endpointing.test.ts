import { Endpointer, type EndpointEvent } from '../utils/endpointing';

/** Levels on the recorder's scale: (dB + 60) / 60. */
const QUIET_ROOM = 0.17; // ≈ −50 dB
const CAFE = 0.42; // ≈ −35 dB
const SPEECH = 0.67; // ≈ −20 dB
const STEP_MS = 50;

/** Feeds `ms` of a constant level, 50 ms a sample, collecting every event. */
function feed(
  endpointer: Endpointer,
  clock: { at: number },
  level: number,
  ms: number
): EndpointEvent[] {
  const events: EndpointEvent[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += STEP_MS) {
    clock.at += STEP_MS;
    const event = endpointer.push(level, clock.at);
    if (event) events.push(event);
  }
  return events;
}

function calibrated(room: number): { endpointer: Endpointer; clock: { at: number } } {
  const endpointer = new Endpointer();
  const clock = { at: 0 };
  feed(endpointer, clock, room, 600);
  return { endpointer, clock };
}

describe('Endpointer', () => {
  it('trusts nothing during calibration, then knows the room', () => {
    const endpointer = new Endpointer();
    const clock = { at: 0 };

    expect(feed(endpointer, clock, SPEECH, 450)).toEqual([]);
    expect(endpointer.state).toBe('calibrating');

    feed(endpointer, clock, QUIET_ROOM, 200);
    expect(endpointer.state).toBe('quiet');
    expect(endpointer.noiseFloor).toBeGreaterThan(QUIET_ROOM);
  });

  it('opens an utterance on sustained speech and closes it on silence', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);

    const events = [
      ...feed(endpointer, clock, SPEECH, 1000),
      ...feed(endpointer, clock, QUIET_ROOM, 1600),
    ];

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'start' });
    expect(events[1]).toMatchObject({ type: 'end' });
    expect((events[1] as { voicedMs: number }).voicedMs).toBeGreaterThanOrEqual(900);
  });

  it('adapts to a café: the same speech is heard, the café itself is not', () => {
    const { endpointer, clock } = calibrated(CAFE);

    expect(feed(endpointer, clock, CAFE + 0.05, 2000)).toEqual([]);
    expect(feed(endpointer, clock, SPEECH, 800)).toEqual([{ type: 'start' }]);
  });

  it('keeps a thought together across an early pause', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);

    const events = [
      ...feed(endpointer, clock, SPEECH, 1000),
      ...feed(endpointer, clock, QUIET_ROOM, 1200),
      ...feed(endpointer, clock, SPEECH, 1000),
      ...feed(endpointer, clock, QUIET_ROOM, 1600),
    ];

    expect(events.map((event) => event.type)).toEqual(['start', 'end']);
  });

  it('closes faster once speech has been sustained', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);

    feed(endpointer, clock, SPEECH, 3500);
    const events = feed(endpointer, clock, QUIET_ROOM, 900);

    expect(events.map((event) => event.type)).toEqual(['end']);
  });

  it('ignores a blip shorter than the onset', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);

    const events = [
      ...feed(endpointer, clock, SPEECH, 100),
      ...feed(endpointer, clock, QUIET_ROOM, 2000),
    ];

    expect(events).toEqual([]);
  });

  it('discards a cough: long enough to open, too short to be speech', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);

    const events = [
      ...feed(endpointer, clock, SPEECH, 250),
      ...feed(endpointer, clock, QUIET_ROOM, 1600),
    ];

    expect(events.map((event) => event.type)).toEqual(['start', 'discard']);
  });

  it('needs a louder voice to cut the coach off than to answer them', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);
    const softSpeech = endpointer.noiseFloor + 0.16;

    endpointer.setMode('bargeIn');
    expect(feed(endpointer, clock, softSpeech, 1000)).toEqual([]);

    endpointer.setMode('listen');
    expect(feed(endpointer, clock, softSpeech, 400)).toEqual([{ type: 'start' }]);
  });

  it('follows the room when it gets noisier during silence', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);
    const wouldHaveBeenSpeech = QUIET_ROOM + 0.2;

    feed(endpointer, clock, QUIET_ROOM + 0.1, 5000);
    expect(endpointer.noiseFloor).toBeGreaterThan(QUIET_ROOM + 0.09);
    expect(feed(endpointer, clock, wouldHaveBeenSpeech, 1000)).toEqual([]);
  });

  it('cuts an utterance that never ends, and what follows is a new one', () => {
    const endpointer = new Endpointer({ maxUtteranceMs: 5000 });
    const clock = { at: 0 };
    feed(endpointer, clock, QUIET_ROOM, 600);

    const events = feed(endpointer, clock, SPEECH, 6000);

    expect(events.map((event) => event.type)).toEqual(['start', 'end', 'start']);
  });

  it('does not learn the coach\'s echo as the room', () => {
    const { endpointer, clock } = calibrated(QUIET_ROOM);
    const floor = endpointer.noiseFloor;

    endpointer.setMode('bargeIn');
    feed(endpointer, clock, QUIET_ROOM + 0.16, 3000);

    expect(endpointer.noiseFloor).toBe(floor);
  });

  it('keeps the floor across a reset unless told to recalibrate', () => {
    const { endpointer, clock } = calibrated(CAFE);
    const floor = endpointer.noiseFloor;

    endpointer.reset({ keepFloor: true });
    expect(endpointer.state).toBe('quiet');
    expect(endpointer.noiseFloor).toBe(floor);

    endpointer.reset();
    expect(endpointer.state).toBe('calibrating');
    expect(feed(endpointer, clock, SPEECH, 300)).toEqual([]);
  });
});
