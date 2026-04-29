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

let ambientGain: GainNode | null = null;
let windBufferSource: AudioBufferSourceNode | null = null;
let cricketOsc1: OscillatorNode | null = null;
let cricketOsc2: OscillatorNode | null = null;
let cricketGain: GainNode | null = null;
let isAmbientPlaying = false;

function createNoiseBuffer(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 2; // 2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export const playAmbientSound = () => {
  if (isAmbientPlaying) return;
  const ctx = getAudioContext();
  
  // Wind
  const noiseBuffer = createNoiseBuffer(ctx);
  windBufferSource = ctx.createBufferSource();
  windBufferSource.buffer = noiseBuffer;
  windBufferSource.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 400; // Deep wind

  ambientGain = ctx.createGain();
  ambientGain.gain.value = audioSettings.bgmEnabled ? 0.05 * audioSettings.bgmVolume : 0;

  windBufferSource.connect(windFilter);
  windFilter.connect(ambientGain);
  ambientGain.connect(ctx.destination);
  windBufferSource.start();

  // Crickets
  cricketOsc1 = ctx.createOscillator();
  cricketOsc1.type = 'square';
  cricketOsc1.frequency.value = 4500;
  
  cricketOsc2 = ctx.createOscillator();
  cricketOsc2.type = 'sawtooth';
  cricketOsc2.frequency.value = 5000;

  cricketGain = ctx.createGain();
  cricketGain.gain.value = 0; // Starts at 0 (day time)
  
  // Create a tremolo effect for crickets using an LFO
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 15; // Tremolo speed
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 1;
  lfo.connect(lfoGain.gain);
  lfo.start();

  cricketOsc1.connect(cricketGain);
  cricketOsc2.connect(cricketGain);
  cricketGain.connect(lfoGain);
  lfoGain.connect(ctx.destination);
  
  cricketOsc1.start();
  cricketOsc2.start();

  isAmbientPlaying = true;
};

export const updateAmbientSound = (distance: number) => {
  if (!isAmbientPlaying || !ambientGain || !cricketGain) return;
  const ctx = getAudioContext();
  const volMulti = audioSettings.bgmEnabled ? audioSettings.bgmVolume : 0;
  currentDistance = distance;
  
  // Day/Night cycle
  const cycle = distance % 25000;
  
  // Wind is slightly louder during the day
  let windVol = 0.05;
  if (cycle > 10000 && cycle < 15000) windVol = 0.03; // evening calmer
  else if (cycle >= 15000 && cycle < 23000) windVol = 0.02; // night calmest
  else if (cycle >= 23000) windVol = 0.04;
  
  ambientGain.gain.setTargetAtTime(windVol * volMulti, ctx.currentTime, 1);

  // Crickets chirp at night
  let crickVol = 0;
  if (cycle > 14000 && cycle < 24000) crickVol = 0.005; // Night time crickets
  cricketGain.gain.setTargetAtTime(crickVol * volMulti, ctx.currentTime, 2);
};

export const stopAmbientSound = () => {
  isAmbientPlaying = false;
  try {
    if (windBufferSource) windBufferSource.stop();
    if (cricketOsc1) cricketOsc1.stop();
    if (cricketOsc2) cricketOsc2.stop();
  } catch (e) {}
  
  windBufferSource = null;
  ambientGain = null;
  cricketOsc1 = null;
  cricketOsc2 = null;
  cricketGain = null;
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

let bgmInterval: any = null;
let currentDistance = 0;
let nextNoteTime = 0;
let current16thNote = 0;

export const playBgm = () => {
  if (isBgmPlaying) return;
  const ctx = getAudioContext();
  isBgmPlaying = true;
  
  nextNoteTime = ctx.currentTime + 0.1;
  current16thNote = 0;

  const arpMaj = [0, 4, 7, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4, 0, -5];
  const arpMin = [0, 3, 7, 12, 7, 3, 0, 3, 7, 12, 15, 12, 7, 3, 0, -5];
  
  // Sync chords out of 32 steps (2 bars)
  const scheduler = () => {
    if (!isBgmPlaying) return;
    
    while (nextNoteTime < ctx.currentTime + 0.1) {
      if (audioSettings.bgmEnabled) {
         playStep(nextNoteTime, current16thNote);
      }
      nextNoteTime += 0.125; // 120 BPM -> 125ms per 16th note
      current16thNote++;
    }
  };
  
  const playStep = (time: number, step: number) => {
    const cycle = currentDistance % 25000;
    
    let root = 60; // C4
    let pattern = arpMaj;
    
    // Smooth transition logic with 2 bar progression
    const barPhase = Math.floor(step / 16) % 2;
    
    if (cycle < 8000) {
      // Day (Upbeat C Maj, F Maj)
      if (barPhase === 0) { root = 60; pattern = arpMaj; } // C Maj
      else { root = 65; pattern = arpMaj; } // F Maj
    } else if (cycle < 10000) {
      // Transition Day -> Evening (D Min, G Maj)
      if (barPhase === 0) { root = 62; pattern = arpMin; } // D Min
      else { root = 67; pattern = arpMaj; } // G Maj
    } else if (cycle < 14000) {
      // Evening (A Min, E Min - Intense, focused)
      if (barPhase === 0) { root = 69; pattern = arpMin; } // A Min
      else { root = 64; pattern = arpMin; } // E Min
    } else if (cycle < 16000) {
      // Transition Evening -> Night (F Maj, D Min)
      if (barPhase === 0) { root = 65; pattern = arpMaj; } // F Maj
      else { root = 62; pattern = arpMin; } // D Min
    } else {
      // Night (F Lydian / cool electronic vibe)
      if (barPhase === 0) { root = 65; pattern = arpMaj; } // F Maj
      else { root = 60; pattern = arpMaj; } // C Maj
    }
    
    const noteOffset = pattern[step % 16];
    const midiNote = root + noteOffset;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    
    // Play Arpeggio
    const arpOsc = ctx.createOscillator();
    const arpGain = ctx.createGain();
    arpOsc.type = cycle > 14000 && cycle < 24000 ? 'sawtooth' : 'square'; // Smoother night synth
    arpOsc.frequency.value = freq;
    
    const arpVol = 0.05 * audioSettings.bgmVolume;
    arpGain.gain.setValueAtTime(arpVol, time);
    arpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    
    // Filter for the arpeggiator to give it a plucky sound
    const arpFilter = ctx.createBiquadFilter();
    arpFilter.type = 'lowpass';
    arpFilter.frequency.setValueAtTime(3000, time);
    arpFilter.frequency.exponentialRampToValueAtTime(500, time + 0.1);
    
    arpOsc.connect(arpFilter);
    arpFilter.connect(arpGain);
    arpGain.connect(ctx.destination);
    arpOsc.start(time);
    arpOsc.stop(time + 0.1);
    
    // Play Bass Note
    if (step % 8 === 0) {
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'triangle';
      bassOsc.frequency.value = 440 * Math.pow(2, ((root - 12) - 69) / 12); // Octave lower root
      
      const bassVol = 0.12 * audioSettings.bgmVolume;
      bassGain.gain.setValueAtTime(bassVol, time);
      bassGain.gain.linearRampToValueAtTime(bassVol * 0.5, time + 0.1);
      bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      
      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);
      bassOsc.start(time);
      bassOsc.stop(time + 0.25);
    }
    
    // Play Drums
    if (step % 8 === 0) { // Kick
      const kickOsc = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150, time);
      kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
      
      const kickVol = 0.2 * audioSettings.bgmVolume;
      kickGain.gain.setValueAtTime(kickVol, time);
      kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
      
      kickOsc.connect(kickGain);
      kickGain.connect(ctx.destination);
      kickOsc.start(time);
      kickOsc.stop(time + 0.1);
    } else if (step % 4 === 2) { // Hi-hat / Snare click
       const bufferSize = ctx.sampleRate * 0.05; 
       const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
       const data = buffer.getChannelData(0);
       for (let i = 0; i < bufferSize; i++) {
           data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.01));
       }
       const noiseSource = ctx.createBufferSource();
       noiseSource.buffer = buffer;
       
       const filter = ctx.createBiquadFilter();
       filter.type = 'highpass';
       filter.frequency.value = 7000;
       
       const noiseGain = ctx.createGain();
       const noiseVol = 0.06 * audioSettings.bgmVolume;
       noiseGain.gain.setValueAtTime(noiseVol, time);
       noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
       
       noiseSource.connect(filter);
       filter.connect(noiseGain);
       noiseGain.connect(ctx.destination);
       noiseSource.start(time);
    }
  };

  bgmInterval = setInterval(scheduler, 50); // fast interval to ensure buffer stays full
};

export const stopBgm = () => {
  isBgmPlaying = false;
  if (bgmInterval) {
    clearInterval(bgmInterval);
    bgmInterval = null;
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
  
  // CRUNCH hit sound
  const bufferSize = ctx.sampleRate * 0.2; // 0.2 seconds
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
  }
  
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);

  const gain = ctx.createGain();
  const baseVol = 0.4 * audioSettings.sfxVolume;
  gain.gain.setValueAtTime(baseVol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

  noiseSource.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noiseSource.start();
  
  // Plus a low thud
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
  
  oscGain.gain.setValueAtTime(0.3 * audioSettings.sfxVolume, ctx.currentTime);
  oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  
  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
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
