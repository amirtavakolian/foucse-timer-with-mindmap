// Web Audio API Light Chime Synthesizer (~5 Seconds)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a ~5-second soothing harmonic light chime music for notification completion
 */
export function playCompletionChime(volume = 0.8, soundType: 'chime' | 'piano' | 'gentle_bell' | 'marimba' = 'chime') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    if (soundType === 'gentle_bell' || soundType === 'chime') {
      // 5-second arpeggiated relaxing ambient chord sequence (C Major 9 / F Maj9 / C)
      // Notes in Hz: C5 (523.25), E5 (659.25), G5 (783.99), B5 (987.77), C6 (1046.50), E6 (1318.51)
      const sequence = [
        { note: 523.25, time: 0.0, duration: 2.5 },  // C5
        { note: 659.25, time: 0.3, duration: 2.5 },  // E5
        { note: 783.99, time: 0.6, duration: 2.8 },  // G5
        { note: 987.77, time: 0.9, duration: 3.0 },  // B5
        { note: 1046.50, time: 1.3, duration: 3.2 }, // C6
        { note: 1318.51, time: 1.8, duration: 3.2 }, // E6
        
        // Final resolving chord at t=2.5s lasting till 5.0s
        { note: 523.25, time: 2.5, duration: 2.5 },  // C5
        { note: 659.25, time: 2.5, duration: 2.5 },  // E5
        { note: 783.99, time: 2.5, duration: 2.5 },  // G5
        { note: 1046.50, time: 2.5, duration: 2.5 }, // C6
      ];

      sequence.forEach(({ note, time, duration }) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, now + time);

        // Soft bell envelope with shimmer
        noteGain.gain.setValueAtTime(0, now + time);
        noteGain.gain.linearRampToValueAtTime(0.25, now + time + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

        // Add subtle harmonic overtone for crystal clarity
        const overtone = ctx.createOscillator();
        const overtoneGain = ctx.createGain();
        overtone.type = 'triangle';
        overtone.frequency.setValueAtTime(note * 2, now + time);
        overtoneGain.gain.setValueAtTime(0, now + time);
        overtoneGain.gain.linearRampToValueAtTime(0.05, now + time + 0.05);
        overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + time + (duration * 0.6));

        osc.connect(noteGain);
        noteGain.connect(masterGain);

        overtone.connect(overtoneGain);
        overtoneGain.connect(masterGain);

        osc.start(now + time);
        osc.stop(now + time + duration);
        overtone.start(now + time);
        overtone.stop(now + time + duration);
      });
    } else if (soundType === 'marimba') {
      const notes = [
        { note: 440.0, time: 0.0 }, { note: 554.37, time: 0.2 }, { note: 659.25, time: 0.4 },
        { note: 880.0, time: 0.6 }, { note: 659.25, time: 1.0 }, { note: 880.0, time: 1.4 },
        { note: 1108.73, time: 1.8 }, { note: 1318.51, time: 2.3 }
      ];
      notes.forEach(({ note, time }) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(note, now + time);
        g.gain.setValueAtTime(0.3, now + time);
        g.gain.exponentialRampToValueAtTime(0.001, now + time + 1.2);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + time);
        osc.stop(now + time + 1.3);
      });
    } else { // Piano tone
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.4);
        g.gain.setValueAtTime(0.3, now + idx * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.4 + 3.0);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now + idx * 0.4);
        osc.stop(now + idx * 0.4 + 3.2);
      });
    }

  } catch (err) {
    console.warn('Audio play failed or context blocked:', err);
  }
}

/**
 * Short subtle click or tick sound for timer start/stop button UI
 */
export function playUiClick(volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    g.gain.setValueAtTime(volume * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Ignore audio errors on click
  }
}

/**
 * Tick sound for timer second countdown (optional)
 */
export function playTimerTick(volume = 0.1) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);

    g.gain.setValueAtTime(volume * 0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  } catch {
    // Ignore
  }
}
