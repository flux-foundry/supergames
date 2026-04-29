/**
 * Procedural audio generation using Web Audio API for a retro feel.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

let bgmOsc: OscillatorNode | null = null;
let bgmGain: GainNode | null = null;
let isBgmPlaying = false;

export const audioSettings = {
  bgmVolume: parseFloat(localStorage.getItem('bgmVolume') || '0.5'),
  bgmEnabled: localStorage.getItem('bgmEnabled') === 'false' ? false : true,
  sfxVolume: parseFloat(localStorage.getItem('sfxVolume') || '1.0'),
  sfxEnabled: localStorage.getItem('sfxEnabled') === 'false' ? false : true,
};

export const updateAudioSettings = (newSettings: Partial<typeof audioSettings>) => {
  Object.assign(audioSettings, newSettings);
  localStorage.setItem('bgmVolume', audioSettings.bgmVolume.toString());
  localStorage.setItem('bgmEnabled', audioSettings.bgmEnabled.toString());
  localStorage.setItem('sfxVolume', audioSettings.sfxVolume.toString());
  localStorage.setItem('sfxEnabled', audioSettings.sfxEnabled.toString());

  if (bgmGain) {
    bgmGain.gain.setValueAtTime(
      audioSettings.bgmEnabled ? 0.04 * audioSettings.bgmVolume : 0, 
      getAudioContext().currentTime
    );
  }
};

export const playBgm = () => {
  if (isBgmPlaying) return;
  const ctx = getAudioContext();
  
  bgmOsc = ctx.createOscillator();
  bgmGain = ctx.createGain();

  // 'square' wave for classic 8-bit sound
  bgmOsc.type = 'square';
  bgmGain.gain.value = 0.02 * audioSettings.bgmVolume;

  bgmOsc.connect(bgmGain);
  bgmGain.connect(ctx.destination);

  // Upbeat, lively 8-bit chip melody
  const seq = [
    392.00, 392.00, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.50,
    392.00, 392.00, 523.25, 659.25, 783.99, 659.25, 783.99, 1046.50,
    349.23, 349.23, 440.00, 523.25, 698.46, 523.25, 698.46, 880.00,
    349.23, 349.23, 440.00, 523.25, 698.46, 523.25, 698.46, 880.00,
  ]; 
  
  let step = 0;
  const bgmInterval = setInterval(() => {
    if (!isBgmPlaying || !bgmOsc) {
      clearInterval(bgmInterval);
      return;
    }
    const freq = seq[step % seq.length];
    // Crisp notes without glide
    bgmOsc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    // Add rhythmic volume ducking (envelope) for chippy staccato feel
    const baseVol = audioSettings.bgmEnabled ? 0.03 * audioSettings.bgmVolume : 0;
    bgmGain.gain.setValueAtTime(baseVol, ctx.currentTime);
    if (baseVol > 0) {
      bgmGain.gain.exponentialRampToValueAtTime(baseVol * 0.1, ctx.currentTime + 0.1);
    }
    
    step++;
  }, 160); // Fast tempo

  bgmOsc.start();
  isBgmPlaying = true;
};

export const stopBgm = () => {
  isBgmPlaying = false;
  if (bgmOsc) {
    try { bgmOsc.stop(); } catch(e){}
    bgmOsc.disconnect();
    bgmOsc = null;
  }
};

export const playFlapSound = () => {
  if (!audioSettings.sfxEnabled) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Soft pop sound using triangle
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(250, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.1);

  const baseVol = 0.1 * audioSettings.sfxVolume;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(baseVol, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.1);
};

export const playScoreSound = () => {
  if (!audioSettings.sfxEnabled) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Soft chime
  osc.type = 'sine';
  osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
  osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5

  const baseVol = 0.08 * audioSettings.sfxVolume;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(baseVol, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const playDieSound = () => {
  if (!audioSettings.sfxEnabled) return;
  const ctx = getAudioContext();
  
  // Soft THUD instead of harsh noise
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Low frequency thud
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);

  const oscBaseVol = 0.2 * audioSettings.sfxVolume;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(oscBaseVol, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
};

export const playFrogSound = () => {
  if (!audioSettings.sfxEnabled) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.05);
  osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.15);

  const baseVol = 0.06 * audioSettings.sfxVolume;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(baseVol, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.15);
};
