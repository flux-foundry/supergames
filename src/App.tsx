import { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, Check, Settings, Volume2, VolumeX, Music } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useMultiplayer, Message } from './hooks/useMultiplayer';
import {
  GameState,
  createInitialState,
  updateBird,
  checkCollision,
  flap,
  GAME_WIDTH,
  GAME_HEIGHT,
  PIPE_SPAWN_DIST,
  PIPE_WIDTH,
  PIPE_GAP,
  GROUND_HEIGHT,
  seededRandom,
} from './lib/physics';
import {
  drawBackground,
  drawGround,
  drawPipe,
  drawBird,
} from './lib/graphics';
import {
  playFlapSound,
  playScoreSound,
  playDieSound,
  playBgm,
  stopBgm,
  audioSettings,
  updateAudioSettings,
} from './lib/audio';

export default function App() {
  const [partnerId, setPartnerId] = useState('');
  const [gameState, setGameState] = useState<GameState>(createInitialState());
  const [rematchRequested, _setRematchRequested] = useState(false);
  const rematchRequestedRef = useRef(false);
  const setRematchRequested = (val: boolean) => {
    rematchRequestedRef.current = val;
    _setRematchRequested(val);
  };
  
  const [opponentWantsRematch, setOpponentWantsRematch] = useState(false);
  
  const [quitRequested, _setQuitRequested] = useState(false);
  const quitRequestedRef = useRef(false);
  const setQuitRequested = (val: boolean) => {
    quitRequestedRef.current = val;
    _setQuitRequested(val);
  };
  const [opponentWantsQuit, setOpponentWantsQuit] = useState(false);
  
  const gameStateRef = useRef<GameState>(createInitialState());
  const frameRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleMessage = useCallback((msg: Message) => {
    if (msg.type === 'STATE_UPDATE' && roleRef.current === 'guest') {
      const state = gameStateRef.current;
      // We only accept score and death from state updates to prevent physics rubberbanding
      state.player1.score = Math.max(state.player1.score, msg.state.player1.score);
      state.player2.score = Math.max(state.player2.score, msg.state.player2.score);
      if (msg.state.player1.isDead) state.player1.isDead = true;
      if (msg.state.player2.isDead) state.player2.isDead = true;
      if (msg.state.gameOver) state.gameOver = true;
      
    } else if (msg.type === 'FLAP') {
      if (roleRef.current === 'host') {
        flap(gameStateRef.current.player2);
      } else {
        flap(gameStateRef.current.player1);
      }
      playFlapSound();
    } else if (msg.type === 'TOGGLE_PAUSE') {
      gameStateRef.current.paused = !gameStateRef.current.paused;
    } else if (msg.type === 'START_GAME') {
      const newState = msg.state ?? createInitialState(Math.floor(Math.random() * 1000000));
      newState.gameStarted = true;
      newState.countdown = 3;
      gameStateRef.current = newState;
      setGameState(newState);
      setRematchRequested(false);
      setOpponentWantsRematch(false);
      setQuitRequested(false);
      setOpponentWantsQuit(false);
      playBgm();
    } else if (msg.type === 'REMATCH_REQUEST') {
      if (gameStateRef.current.gameOver) {
        setOpponentWantsRematch(true);
        // If we are host and we already asked for a rematch, start immediately
        if (roleRef.current === 'host' && rematchRequestedRef.current) {
          startGame();
        }
      }
    } else if (msg.type === 'QUIT_REQUEST') {
      setOpponentWantsQuit(true);
    } else if (msg.type === 'QUIT_GAME') {
      window.location.reload();
    }
  }, []);

  const {
    peerId,
    connected,
    role,
    error,
    hostGame,
    joinGame,
    sendMessage,
  } = useMultiplayer(handleMessage);

  const roleRef = useRef(role);
  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState({ ...audioSettings });

  const handleSettingsChange = (newSettings: Partial<typeof audioSettings>) => {
    const updated = { ...localSettings, ...newSettings };
    setLocalSettings(updated);
    updateAudioSettings(updated);
  };

  const handleCopyId = () => {
    if (peerId) {
      navigator.clipboard.writeText(peerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startGame = useCallback(() => {
    const newState = createInitialState();
    newState.gameStarted = true;
    newState.countdown = 3;
    gameStateRef.current = newState;
    setGameState(newState);
    sendMessage({ type: 'START_GAME', state: newState });
    playBgm();
  }, [sendMessage]);

  const togglePause = useCallback(() => {
    gameStateRef.current.paused = !gameStateRef.current.paused;
    sendMessage({ type: 'TOGGLE_PAUSE' });
  }, [sendMessage]);

  const handleInput = useCallback(() => {
    const state = gameStateRef.current;
    if (!state.gameStarted) {
      if (role === 'host' && connected && !showSettings) startGame();
      return;
    }
    if (state.gameOver) {
       return;
    }
    if (state.countdown > 0 || state.paused) {
       return;
    }

    if (role === 'host') {
      sendMessage({ type: 'FLAP' });
      flap(state.player1);
      playFlapSound();
    } else {
      sendMessage({ type: 'FLAP' });
      // Predict flap locally for responsive feel
      flap(state.player2);
      playFlapSound();
    }
  }, [connected, role, sendMessage, startGame, showSettings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  // Main Game Loop for Canvas Rendering & Physics
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const state = gameStateRef.current;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      drawBackground(ctx, GAME_WIDTH, GAME_HEIGHT, state.distance);
      
      state.pipes.forEach((p) => {
        drawPipe(ctx, p.x, p.openingY, PIPE_WIDTH, GAME_HEIGHT, true);
        drawPipe(ctx, p.x, p.openingY + PIPE_GAP, PIPE_WIDTH, GAME_HEIGHT, false);
      });

      drawGround(ctx, GAME_WIDTH, GAME_HEIGHT, state.distance);

      const f = Math.floor(frameRef.current / 5) % 3;
      // Draw guest (blue) behind host (yellow)
      drawBird(ctx, state.player2.x, state.player2.y, state.player2.rotation, f, '#20d0f8');
      drawBird(ctx, state.player1.x, state.player1.y, state.player1.rotation, f, '#f8d020');
    };

    let lastTime = performance.now();
    let accumulator = 0;
    const TIME_STEP = 1000 / 60; // 60 fps fixed

    const loop = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      
      // Cap dt to prevent spiral of death if tab was inactive
      accumulator += Math.min(dt, 200);

      while (accumulator >= TIME_STEP) {
        accumulator -= TIME_STEP;
        frameRef.current++;

        if (frameRef.current % 15 === 0) {
          setGameState({...gameStateRef.current});
        }

        if (gameStateRef.current.gameStarted && !gameStateRef.current.gameOver) {
          const state = gameStateRef.current;
          
          if (state.countdown > 0) {
            state.countdown -= 1/60; // Assuming ~60fps fixed step
            if (state.countdown < 0) state.countdown = 0;
          } else if (!state.paused) {
            const speed = (state.player1.isDead && state.player2.isDead) ? 0 : 3;
            updateBird(state.player1, speed);
            updateBird(state.player2, speed);

            state.distance += speed;
            state.pipes.forEach((p) => (p.x -= speed));
          
          const lastPipeX = state.pipes.length > 0 ? state.pipes[state.pipes.length - 1].x : 0;
          const currentSpawnDist = Math.max(300, 600 - (state.distance * 0.05));
          if (state.pipes.length === 0 || lastPipeX < GAME_WIDTH - currentSpawnDist) {
            state.seed++;
            const baseY = 120 + seededRandom(state.seed) * (GAME_HEIGHT - GROUND_HEIGHT - 240 - PIPE_GAP);
            state.seed++;
            const isMoving = state.distance > 2400 && seededRandom(state.seed) > 0.4;
            state.seed++;
            const phase = seededRandom(state.seed) * Math.PI * 2;
            state.pipes.push({
              id: state.seed.toString(),
              x: GAME_WIDTH,
              openingY: baseY,
              baseY: baseY,
              isMoving: isMoving,
              phase: phase,
              passed: false,
            });
          }
          
          // Update moving pipes
          state.pipes.forEach((p) => {
            if (p.isMoving) {
              p.openingY = p.baseY + Math.sin(state.distance * 0.015 + p.phase) * 60;
            }
          });

          state.pipes = state.pipes.filter((p) => p.x > -PIPE_WIDTH);

          state.pipes.forEach((p) => {
            if (!p.passed && p.x + PIPE_WIDTH < 150) {
              p.passed = true;
              if (!state.player1.isDead) {
                state.player1.score++;
                playScoreSound();
              }
              if (!state.player2.isDead) {
                state.player2.score++;
                if (role === 'host') playScoreSound(); 
              }
            }
          });

          state.pipes.forEach((p) => {
            if (checkCollision(state.player1, p) && !state.player1.isDead) {
              state.player1.isDead = true;
              playDieSound();
            }
            if (checkCollision(state.player2, p) && !state.player2.isDead) {
              state.player2.isDead = true;
              playDieSound();
            }
          });

          if (state.player1.isDead && state.player2.isDead) {
            if (state.player1.y >= GAME_HEIGHT - GROUND_HEIGHT - 16 && state.player2.y >= GAME_HEIGHT - GROUND_HEIGHT - 16) {
               state.gameOver = true;
               stopBgm();
            }
          }
          }

          gameStateRef.current = { ...state };
          
          // Host only sends sync updates every 15 frames
          if (role === 'host' && frameRef.current % 15 === 0) {
            sendMessage({ type: 'STATE_UPDATE', state: gameStateRef.current });
          }
        }
      }

      render();
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [role, sendMessage]);

  // Disconnect & stop BGM on unmount
  useEffect(() => {
    return () => stopBgm();
  }, []);

  // Confetti effect on victory
  useEffect(() => {
    if (gameState.gameOver && connected) {
      const myScore = role === 'host' ? gameState.player1.score : gameState.player2.score;
      const oppScore = role === 'host' ? gameState.player2.score : gameState.player1.score;
      
      if (myScore > oppScore) {
        const duration = 2500;
        const animationEnd = Date.now() + duration;

        const interval: any = setInterval(() => {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            return clearInterval(interval);
          }
          confetti({
            particleCount: 20,
            spread: 80,
            origin: { x: Math.random() * 0.4, y: Math.random() * 0.5 },
            colors: ['#eab308', '#22c55e', '#3b82f6', '#ffffff']
          });
          confetti({
            particleCount: 20,
            spread: 80,
            origin: { x: 0.6 + Math.random() * 0.4, y: Math.random() * 0.5 },
            colors: ['#eab308', '#22c55e', '#3b82f6', '#ffffff']
          });
        }, 200);

        return () => clearInterval(interval);
      }
    }
  }, [gameState.gameOver, connected]);

  return (
    <div className={`flex flex-col items-center justify-center min-h-[100dvh] bg-[#70c5ce] text-slate-100 font-sans select-none touch-none overflow-hidden relative p-0 max-w-full`} onPointerDown={handleInput}>
      
      {/* Decorative background for the lobby */}
      {!connected && (
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '48px 48px' }} />
      )}
      
      {/* Settings Button - Redesigned */}
      {!connected && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
          className="absolute top-6 right-6 z-20 w-12 h-12 flex items-center justify-center bg-[#ded895] border-[4px] border-[#53381a] shadow-[4px_4px_0_0_#53381a] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#53381a] transition-all cursor-pointer rounded pointer-events-auto"
          title="Settings"
        >
          <Settings size={24} color="#53381a" strokeWidth={2.5} />
        </button>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pointer-events-auto">
          <div className="bg-[#ded895] p-6 sm:p-8 rounded border-[6px] border-[#53381a] shadow-[0_8px_0_0_#53381a,0_15px_20px_rgba(0,0,0,0.5)] w-full max-w-sm relative pointer-events-auto">
             <div className="mb-6 border-b-[4px] border-[#53381a]/20 pb-4">
                <h2 className="text-3xl font-black text-[#53381a] flex items-center gap-3 justify-center font-mono uppercase tracking-widest">
                  Options
                </h2>
             </div>
             
             <div className="space-y-6">
                <div>
                   <label className="text-sm font-bold text-[#53381a] uppercase tracking-wider mb-2 flex justify-between items-center font-mono">
                     <span>MUSIC</span>
                     <span className="text-[#e26900]">{Math.round(localSettings.bgmVolume * 100)}%</span>
                   </label>
                   <input type="range" min="0" max="1" step="0.05" value={localSettings.bgmVolume} onChange={(e) => handleSettingsChange({ bgmVolume: parseFloat(e.target.value) })} className="w-full h-4 bg-[#b5aa58] rounded appearance-none cursor-pointer border-[2px] border-[#53381a] drop-shadow-sm accent-[#e26900]" />
                </div>
                
                <div>
                   <label className="text-sm font-bold text-[#53381a] uppercase tracking-wider mb-2 flex items-center gap-2 font-mono">
                     <input 
                       type="checkbox" 
                       checked={localSettings.sfxEnabled} 
                       onChange={(e) => handleSettingsChange({ sfxEnabled: e.target.checked })}
                       className="w-5 h-5 accent-[#e26900] border-[#53381a] rounded-sm cursor-pointer"
                     />
                     <span className="cursor-pointer" onClick={() => handleSettingsChange({ sfxEnabled: !localSettings.sfxEnabled })}>
                       SOUND EFFECTS
                     </span>
                     {localSettings.sfxEnabled ? <Volume2 size={16} className="text-[#53381a]"/> : <VolumeX size={16} className="text-[#53381a]/50" />}
                   </label>
                   <input disabled={!localSettings.sfxEnabled} type="range" min="0" max="1" step="0.05" value={localSettings.sfxVolume} onChange={(e) => handleSettingsChange({ sfxVolume: parseFloat(e.target.value) })} className="w-full h-4 bg-[#b5aa58] rounded appearance-none cursor-pointer border-[2px] border-[#53381a] drop-shadow-sm accent-[#e26900] disabled:opacity-40" />
                </div>
             </div>
             
             <button onClick={() => setShowSettings(false)} className="mt-8 w-full py-3 bg-[#f07000] hover:bg-[#ff841a] text-white border-[4px] border-[#53381a] shadow-[0_4px_0_0_#53381a] uppercase font-black text-xl tracking-widest rounded transition-all active:-translate-y-[-4px] active:shadow-none">
               CONFIRM
             </button>
          </div>
        </div>
      )}
      
      {!connected ? (
        <div className="z-10 bg-[#70c5ce] p-6 max-w-md w-full relative flex flex-col items-center">
          
          <div className="mb-12 text-center relative mt-6">
            <h1 className="text-6xl sm:text-7xl font-black text-white drop-shadow-[4px_4px_0_#53381a] font-mono tracking-tighter mix-blend-overlay opacity-90 relative top-2 -rotate-2">NETFLAP</h1>
            <h1 className="text-6xl sm:text-7xl font-black text-[#e8c68c] drop-shadow-[4px_4px_0_#53381a] font-mono tracking-tighter absolute inset-0 -rotate-2">NETFLAP</h1>
            <p className="text-white text-xs font-bold uppercase tracking-[0.3em] font-mono mt-4 drop-shadow-[2px_2px_0_rgba(0,0,0,0.4)]">Co-op Survival</p>
          </div>
          
          <div className="w-full bg-[#ded895] border-[6px] border-[#53381a] rounded shadow-[0_8px_0_0_#53381a] p-6">
            <div className="mb-8 relative flex flex-col items-center">
              <p className="text-sm text-[#53381a] mb-2 uppercase font-bold tracking-[0.2em] font-mono">Your Key</p>
              
              <div className="w-full bg-[#cfc778] py-4 px-4 rounded border-[4px] border-[#a09a5b] font-mono text-xl sm:text-2xl tracking-[0.3em] text-[#53381a] text-center shadow-inner relative flex justify-center items-center mb-6 h-16">
                {!peerId ? (
                  <span className="text-[#a09a5b] text-sm tracking-widest animate-pulse">
                    GENERATING...
                  </span>
                ) : (
                  <div className="font-black drop-shadow-[1px_1px_0_rgba(255,255,255,0.8)]">{peerId}</div>
                )}
              </div>

              <div className="flex gap-4 w-full">
                <button 
                  onClick={handleCopyId}
                  disabled={!peerId}
                  className="flex-1 py-3 bg-[#20d0f8] hover:bg-[#4de1fc] text-white border-[4px] border-[#53381a] shadow-[0_4px_0_0_#53381a] flex gap-2 items-center justify-center font-black uppercase text-sm tracking-widest rounded transition-all active:translate-y-[4px] active:shadow-none disabled:opacity-50"
                  title="Copy Key"
                >
                  {copied ? <Check size={18} strokeWidth={3} /> : <Copy size={18} strokeWidth={3} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button 
                  onClick={() => {
                     playFlapSound();
                     hostGame();
                  }} 
                  disabled={role === 'host'}
                  className={`flex-[1.5] py-3 border-[4px] border-[#53381a] rounded font-black transition-all text-sm uppercase tracking-widest ${role === 'host' ? 'bg-[#cfc778] text-[#53381a] shadow-[0_4px_0_0_#53381a]' : 'bg-[#e05030] hover:bg-[#ff6844] text-white shadow-[0_4px_0_0_#53381a] active:translate-y-[4px] active:shadow-none'}`}
                >
                  {role === 'host' ? (
                     <span className="flex items-center justify-center gap-1 text-[10px]">
                       <span className="w-2 h-2 bg-[#53381a] rounded-full animate-ping"></span>
                       WAITING...
                     </span>
                  ) : (
                     'HOST GAME'
                  )}
                </button>
              </div>
            </div>

          {role !== 'host' && (
            <>
              <div className="relative flex items-center mb-6 justify-center">
                <div className="flex-1 border-t-[4px] border-[#cfc778]"></div>
                <span className="mx-4 text-[10px] font-bold text-[#a09a5b] uppercase tracking-widest font-mono">Or Connect</span>
                <div className="flex-1 border-t-[4px] border-[#cfc778]"></div>
              </div>

              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="ENTER KEY" 
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value.trim())}
                  className="w-full bg-[#cfc778] border-[4px] border-[#a09a5b] text-[#53381a] px-4 py-3 rounded font-mono text-center text-lg tracking-widest placeholder:text-[#a09a5b]/60 outline-none focus:border-[#53381a] uppercase font-bold"
                  maxLength={5}
                />
                <button 
                  onClick={() => {
                    playFlapSound();
                    joinGame(partnerId);
                  }} 
                  disabled={!partnerId}
                  className="w-full py-4 bg-[#70c5ce] hover:bg-[#8adee6] text-white font-black border-[4px] border-[#53381a] shadow-[0_4px_0_0_#53381a] rounded transition-all disabled:opacity-50 text-xl uppercase tracking-widest active:translate-y-[4px] active:shadow-none font-mono"
                >
                  JOIN GAME
                </button>
              </div>
            </>
          )}
          {error && <p className="text-red-600 mt-4 text-xs font-bold uppercase tracking-widest bg-red-200 py-3 rounded border-[4px] border-red-300 font-mono text-center">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col items-center pointer-events-auto bg-[#70c5ce]">
          {/* The single full-screen canvas */}
          <canvas 
            ref={canvasRef} 
            width={GAME_WIDTH} 
            height={GAME_HEIGHT} 
            className="w-full h-full object-cover object-left md:object-center bg-[#70c5ce]" 
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Top HUD Overlay */}
          <div className="absolute top-4 inset-x-2 sm:inset-x-4 flex justify-between items-start pointer-events-none z-40">
            {/* Left Column */}
            <div className="flex flex-col gap-2 pointer-events-auto">
               <button onClick={(e) => { 
                  e.stopPropagation(); 
                  if (opponentWantsQuit) {
                    sendMessage({ type: 'QUIT_GAME' });
                    window.location.reload(); 
                  } else {
                    sendMessage({ type: 'QUIT_REQUEST' });
                    setQuitRequested(true);
                  }
               }} className={`text-[10px] sm:text-xs font-bold text-slate-100 uppercase tracking-widest border-[3px] border-[#303030] border-b-[4px] px-2 sm:px-4 py-1.5 sm:py-2 rounded transition-all ${quitRequested ? 'bg-slate-400 text-slate-800' : 'bg-[#eab308] hover:bg-[#fcd34d] text-[#303030]'}`} disabled={quitRequested}> 
                 {quitRequested ? 'WAITING...' : opponentWantsQuit ? 'ACCEPT QUIT' : '◀ QUIT'} 
               </button>
               {opponentWantsQuit && !quitRequested && (
                 <div className="bg-red-500 text-white text-[8px] px-1 py-1 rounded font-bold animate-bounce text-center mt-1">
                   Opponent wants to quit!
                 </div>
               )}
            </div>

            {/* Middle Column: Scores */}
            <div className="flex flex-col items-center pointer-events-none mt-0 sm:mt-2 lg:mt-0">
               <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 px-4 sm:px-8 py-2 sm:py-3 rounded-[20px] flex gap-4 sm:gap-16 items-center shadow-2xl border-[3px] border-[#303030]">
                 <div className="flex flex-col items-center">
                   <span className="text-[9px] sm:text-[10px] font-black text-yellow-400 uppercase tracking-widest mb-0 sm:mb-1 shadow-yellow-500/50 drop-shadow-md">{role === 'host' ? 'YOU' : 'OPP'}</span>
                   <span className="text-2xl sm:text-4xl font-black font-mono text-white drop-shadow-lg leading-none">{gameState.player1.score}</span>
                 </div>
                 <div className="w-px h-6 sm:h-8 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                 <div className="flex flex-col items-center">
                   <span className="text-[9px] sm:text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-0 sm:mb-1 shadow-cyan-500/50 drop-shadow-md">{role === 'guest' ? 'YOU' : 'OPP'}</span>
                   <span className="text-2xl sm:text-4xl font-black font-mono text-white drop-shadow-lg leading-none">{gameState.player2.score}</span>
                 </div>
               </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col items-end gap-2 pointer-events-auto">
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/30 text-[#303030]">
                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e] animate-pulse border border-[#303030]"></div>
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest drop-shadow-[1px_1px_0_rgba(255,255,255,0.8)]">{role === 'host' ? 'HOST' : 'CONN'}</span>
              </div>
              {gameState.gameStarted && !gameState.gameOver && (
                  <button onClick={(e) => { e.stopPropagation(); togglePause(); }} className="text-[10px] sm:text-xs font-bold text-slate-100 hover:text-white uppercase tracking-widest border-[3px] border-[#303030] border-b-[4px] bg-[#fb923c] hover:bg-[#fdba74] text-[#303030] px-2 sm:px-4 py-1.5 sm:py-2 rounded transition-all text-center">
                    {gameState.paused ? '▶ RESUME' : '⏸ PAUSE'}
                  </button>
               )}
            </div>
          </div>

            {/* Game States */}
            {!gameState.gameStarted && (
              <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none z-30">
                <div className="bg-[#ded895] border-[6px] border-[#303030] p-8 max-w-sm w-11/12 rounded-lg shadow-[8px_8px_0_0_rgba(0,0,0,0.5)] flex flex-col items-center text-center">
                  <h2 className="text-4xl font-black mb-4 uppercase text-[#303030] drop-shadow-[2px_2px_0_rgba(255,255,255,0.8)] font-mono tracking-tighter">
                    READY?
                  </h2>
                  <p className="text-[#558022] text-sm font-bold uppercase tracking-widest px-2 flex items-center justify-center animate-pulse">
                    {role === 'host' ? 'Tap to Start' : 'Waiting for Host...'}
                  </p>
                </div>
              </div>
            )}
            
            {gameState.gameStarted && !gameState.gameOver && gameState.countdown > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20 pointer-events-none">
                <span className="text-[120px] font-black text-white font-mono drop-shadow-[4px_4px_0_#f07000] animate-ping">
                   {Math.ceil(gameState.countdown)}
                </span>
              </div>
            )}

            {gameState.paused && !gameState.countdown && !gameState.gameOver && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 pointer-events-none">
                <div className="bg-[#ded895] border-[6px] border-[#303030] p-8 rounded shadow-[8px_8px_0_0_rgba(0,0,0,0.5)]">
                   <span className="text-4xl font-black text-[#303030] font-mono tracking-widest">PAUSED</span>
                </div>
              </div>
            )}

            {gameState.gameOver && (
              <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center bg-black/60 pointer-events-none z-30">
                <div className="bg-[#ded895] border-[6px] border-[#53381a] p-6 sm:p-8 max-w-sm w-11/12 rounded shadow-[0_8px_0_0_#53381a,0_15px_20px_rgba(0,0,0,0.5)] flex flex-col items-center text-center relative">
                  
                  {/* Title card */}
                  <div className="absolute -top-6 bg-[#e05030] border-[4px] border-[#53381a] px-6 py-2 rounded shadow-[0_4px_0_0_#53381a] transform -rotate-2">
                    <h2 className="text-3xl font-black uppercase text-white drop-shadow-[2px_2px_0_rgba(0,0,0,0.3)] font-mono tracking-tighter">
                      {(() => {
                        const myScore = role === 'host' ? gameState.player1.score : gameState.player2.score;
                        const oppScore = role === 'host' ? gameState.player2.score : gameState.player1.score;
                        if (myScore > oppScore) return 'VICTORY';
                        if (myScore < oppScore) return 'DEFEAT';
                        return 'DRAW';
                      })()}
                    </h2>
                  </div>
                  
                  <div className="mt-8 flex gap-4 sm:gap-6 mb-4 font-mono text-xl sm:text-2xl font-black bg-[#cfc778] px-6 py-3 rounded border-[4px] border-[#a09a5b] shadow-inner">
                     <span className="text-[#f07000] drop-shadow-[1px_1px_0_rgba(255,255,255,0.8)]">YOU: {role === 'host' ? gameState.player1.score : gameState.player2.score}</span>
                     <span className="text-[#20d0f8] drop-shadow-[1px_1px_0_rgba(255,255,255,0.8)]">OPP: {role === 'host' ? gameState.player2.score : gameState.player1.score}</span>
                  </div>

                  <div className="text-[#654823] text-[11px] sm:text-[13px] font-bold uppercase tracking-widest mb-6 max-w-[280px] mx-auto opacity-90 px-2 min-h-[4rem] flex items-center justify-center text-balance leading-relaxed">
                    {(() => {
                      const myScore = role === 'host' ? gameState.player1.score : gameState.player2.score;
                      const oppScore = role === 'host' ? gameState.player2.score : gameState.player1.score;
                      const diff = Math.abs(myScore - oppScore);
                      const totalScore = myScore + oppScore;
                      
                      if (myScore > oppScore) {
                        const comments = [
                          "Flawless victory. They didn't even flap.",
                          "Absolute domination. They had a family, you know.",
                          "A win is a win. Barely.",
                          "You're the top bird. They're just chicken nuggets.",
                          "Gravity respects you. Your opponent fears you.",
                          "Did they even turn their monitor on?",
                          "You soared. They snored.",
                          "Skill issue on their part, honestly.",
                          "Winner winner, birdseed dinner!",
                          "That was embarrassing to watch. For them.",
                          "You have ascended. They have plummeted.",
                          "Are you secretly a robot? Or are they just bad?",
                          "Opponent uninstalled immediately after that.",
                          "You danced among the pipes. They ate dirt.",
                          "Was it lag, or do they just suck? We will never know.",
                          "Such grace, such poise, such brutal destruction of your enemy.",
                          "You flap with the fury of a thousand suns.",
                          "They tried. You succeeded. That's life.",
                          "You should probably charge them for this lesson.",
                          "Another one bites the dust. Literally.",
                          "Don't let it get to your head. They were really bad.",
                          "Like taking candy from a baby bird.",
                          "You are the Michael Jordan of tapping.",
                          "You barely even hit spacebar. Pure talent.",
                          "Are they playing with their feet?",
                          "I almost feel bad for them. Almost.",
                          "You styled on them so hard the pipes clapped.",
                          "They were hoping for a lag spike to save them.",
                          "Is there an easy mode they can switch to?",
                          "You left them in the dust... and the pipes.",
                          "Legend says they are still falling.",
                          "Even the background clouds are laughing at them.",
                          "Maybe they were distracted by a real bird out the window.",
                          "You must have a really expensive gaming chair."
                        ];
                        return comments[totalScore % comments.length];
                      }
                      if (myScore < oppScore) {
                        const comments = [
                          "Gravity: 1. You: 0. Did you forget which button to press?",
                          "Were you even looking at the screen?",
                          "So close, yet so completely defeated.",
                          "That was... sad. Try opening your eyes next time.",
                          "Your bird was allergic to flying, apparently.",
                          "I've seen potatoes play better.",
                          "The ground is not your friend. Why did you hug it?",
                          "Opponent won. You provided comic relief.",
                          "Is your spacebar broken, or just your spirit?",
                          "You flew like a brick attached to an anvil.",
                          "Maybe stick to walking.",
                          "A spectacular display of mediocrity.",
                          "They didn't even sweat. You did all the losing for them.",
                          "You made the pipes look like an impenetrable fortress.",
                          "Have you considered a career in falling gracefully?",
                          "The sky was right there. You chose the dirt.",
                          "I'm not mad, I'm just disappointed.",
                          "Your coordination is mathematically impossible.",
                          "Did you mistake the pipe for a drive-thru?",
                          "Well, at least you tried. Oh wait, did you?",
                          "Ouch. That looked painful.",
                          "You might want to reconsider your life choices right now.",
                          "Your flapping privileges have been revoked.",
                          "Did your cat step on the keyboard?",
                          "You clearly need a better gaming chair.",
                          "Just pretend you let them win.",
                          "Is your mouse unplugged? What's your excuse?",
                          "You tapped like a metronome that's out of batteries.",
                          "Gravity works, in case you were wondering.",
                          "You were aiming for the pipes, right?",
                          "This isn't a submarine simulator. Go UP.",
                          "The pipes are stationary. How did you miss the gap?",
                          "I'm sure the sun was in your eyes."
                        ];
                        return comments[totalScore % comments.length];
                      }
                      const drawComments = [
                          "Perfectly balanced. Perfectly boring.",
                          "A draw? Really? That's just disappointing for everyone.",
                          "Neither of you had what it takes.",
                          "Mutually assured destruction.",
                          "Yay, participation trophies for both of you!",
                          "You both lost in my eyes.",
                          "Nobody wins. Just like real life.",
                          "You're both equally terrible.",
                          "A magnificent display of synchronized failing.",
                          "Wow, you guys must be soulmates.",
                          "Double KO! Now do it again.",
                          "Stop copying each other and win properly.",
                          "It's like looking into a mirror of incompetence.",
                          "Draws are just losses in disguise.",
                          "You guys just gave up at the exact same moment, huh.",
                          "Did you both sneeze at the exact same time?",
                          "Equally matched. Which isn't saying much.",
                          "Two birds, one incredibly boring outcome.",
                          "Neither of you deserved to win that.",
                          "A tie is like kissing your sister by a pipe.",
                          "The universe demands a rematch.",
                          "Were you holding hands while you played this?",
                          "You both achieved the exact same level of 'meh'."
                      ];
                      return drawComments[totalScore % drawComments.length];
                    })()}
                  </div>
                  
                  <div className="flex w-full gap-2 mt-4 pointer-events-auto">
                    {/* Quit Button */}
                    <div className="flex-1 relative">
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        if (opponentWantsQuit) {
                          sendMessage({ type: 'QUIT_GAME' });
                          window.location.reload(); 
                        } else {
                          sendMessage({ type: 'QUIT_REQUEST' });
                          setQuitRequested(true);
                        }
                      }} className={`transition-colors border-[4px] border-[#53381a] px-4 py-3 rounded font-black uppercase tracking-widest shadow-[0_4px_0_0_#53381a] active:translate-y-[4px] active:shadow-none text-center w-full ${quitRequested ? 'bg-slate-400 text-slate-800' : 'bg-[#e05030] hover:bg-[#ff6844] text-white'}`} disabled={quitRequested}>
                        {quitRequested ? 'WAITING' : opponentWantsQuit ? 'ACCEPT QUIT' : 'QUIT'}
                      </button>
                      {opponentWantsQuit && !quitRequested && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10 bg-red-500 text-white text-[10px] px-2 py-1 rounded font-bold animate-bounce whitespace-nowrap">
                          Opponent quitting!
                        </div>
                      )}
                    </div>
                    {/* Rematch Button */}
                    <div className="flex-[2] relative">
                      <button onClick={(e) => { 
                        e.stopPropagation(); 
                        if (opponentWantsRematch && role === 'host') {
                          startGame();
                        } else if (opponentWantsRematch && role === 'guest') {
                          sendMessage({ type: 'REMATCH_REQUEST' });
                          setRematchRequested(true);
                        } else {
                          sendMessage({ type: 'REMATCH_REQUEST' });
                          setRematchRequested(true);
                        }
                      }} className={`transition-colors border-[4px] border-[#53381a] px-4 py-3 rounded font-black uppercase tracking-widest shadow-[0_4px_0_0_#53381a] active:translate-y-[4px] active:shadow-none text-center w-full ${rematchRequested ? 'bg-slate-400 text-slate-800' : 'bg-[#70c5ce] hover:bg-[#8adee6] text-[#53381a]'}`} disabled={rematchRequested}>
                        {rematchRequested ? 'WAITING...' : opponentWantsRematch ? 'ACCEPT REMATCH' : 'REMATCH'}
                      </button>
                      {opponentWantsRematch && !rematchRequested && (
                        <div className="absolute -top-4 right-2 z-10 bg-[#e05030] border-2 border-[#53381a] text-white text-[10px] px-2 py-1 rounded font-bold animate-bounce whitespace-nowrap shadow-[2px_2px_0_0_#53381a]">
                          Opponent requested!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
      )}

    </div>
  );
}
