// Sound effects using Web Audio API
// No external files needed - sounds are generated programmatically

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;

  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      return null;
    }
  }
  return audioContext;
};

// Short "ding" sound for scoring
export const playScoreSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume audio context if suspended (required for mobile)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Pleasant "ding" sound
    oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
    oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1); // C#6
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialDecayTo?.(0.01, ctx.currentTime + 0.3) ||
      gainNode.gain.setValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn('Failed to play score sound:', e);
  }
};

// Fanfare sound for game end
export const playFanfareSound = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Resume audio context if suspended (required for mobile)
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Play a simple fanfare melody
    const notes = [
      { freq: 523.25, start: 0, duration: 0.15 },    // C5
      { freq: 659.25, start: 0.15, duration: 0.15 }, // E5
      { freq: 783.99, start: 0.3, duration: 0.15 },  // G5
      { freq: 1046.50, start: 0.45, duration: 0.4 }, // C6 (longer)
      { freq: 783.99, start: 0.55, duration: 0.15 }, // G5
      { freq: 1046.50, start: 0.7, duration: 0.5 },  // C6 (final, longest)
    ];

    notes.forEach(note => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(note.freq, ctx.currentTime + note.start);
      oscillator.type = 'triangle'; // Softer sound

      gainNode.gain.setValueAtTime(0.25, ctx.currentTime + note.start);
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime + note.start + note.duration * 0.7);
      gainNode.gain.linearRampToValueAtTime(0.01, ctx.currentTime + note.start + note.duration);

      oscillator.start(ctx.currentTime + note.start);
      oscillator.stop(ctx.currentTime + note.start + note.duration);
    });
  } catch (e) {
    console.warn('Failed to play fanfare sound:', e);
  }
};

// Initialize audio context on first user interaction (required for mobile)
export const initAudioOnInteraction = () => {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
};
