function beep(): void {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
    oscillator.onended = () => void context.close().catch(() => {});
  } catch {
    // Audio is optional; browser policy or device settings must not interrupt logging.
  }
}

/** Signals a timer threshold the way the lifter's timer settings ask for. */
export function cue({ vibrate, sound }: { readonly vibrate: boolean; readonly sound: boolean }): void {
  if (vibrate) navigator.vibrate?.([220, 120, 220]);
  if (sound) beep();
}
