import { useState, useEffect } from 'react';

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [progress, setProgress] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = [
    'Binding local gateway port 8000...',
    'Loading local_smart AI config profiles...',
    'Spinning up memory vector data schemas...',
    'Tail-monitoring agent.log channels...',
    'Checking environment dependencies (SYS OK)...',
    'Local Smart workspace initialized successfully!'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        // Increment progress randomly
        const randInc = Math.floor(Math.random() * 15) + 5;
        const nextProgress = Math.min(prev + randInc, 100);

        // Advance steps accordingly
        const nextStep = Math.min(
          Math.floor((nextProgress / 100) * steps.length),
          steps.length - 1
        );
        setStepIndex(nextStep);

        return nextProgress;
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-[#07090c] flex items-center justify-center z-50 p-6">
      {/* Sci-Fi Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-purple/10 filter blur-[80px]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyan/10 filter blur-[80px]"></div>

      <div className="glass-panel p-8 max-w-lg w-full flex flex-col items-center gap-6 text-center border-white/10 shadow-2xl relative overflow-hidden">
        {/* Hologram Scanner line effect */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan to-transparent opacity-50 shadow-[0_0_10px_#00f0ff] animate-bounce"></div>

        {/* Big Rotating Logo Icon */}
        <div className="relative w-16 h-16 animate-pulse mt-4">
          <svg className="w-full h-full filter drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#setupLogoGrad)" />
            <path d="M2 17L12 22L22 17" stroke="url(#setupLogoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="url(#setupLogoGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <defs>
              <linearGradient id="setupLogoGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#ffb700" />
                <stop offset="100%" stopColor="#ff7700" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-extrabold text-2xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#ffb700] to-[#ff5500] font-sans">
            LOCAL SMART AGENT
          </h1>
          <p className="text-xs text-dim uppercase tracking-widest font-mono">Web Desktop Interface v1.0.0</p>
        </div>

        {/* Terminal logs loading steps */}
        <div className="w-full bg-black/40 border border-white/5 rounded-xl p-4 min-h-[100px] flex flex-col justify-center gap-2 font-mono text-[11px] text-left">
          <div className="flex items-center gap-2">
            <span className="status-dot green animate-pulse"></span>
            <span className="text-slate-400">系統狀態: Booting core processes...</span>
          </div>

          <div className="text-cyan font-semibold transition-all duration-300">
            &gt; {steps[stepIndex]}
          </div>

          <div className="text-dim">
            Progress: {progress}% completed
          </div>
        </div>

        {/* Horizontal Neon Progress Bar */}
        <div className="w-full flex flex-col gap-2 mt-2">
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full bg-gradient-to-r from-cyan to-purple rounded-full transition-all duration-300 relative"
              style={{ width: `${progress}%` }}
            >
              {/* flow reflection effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Workspace Entry Button */}
        {progress === 100 ? (
          <button
            onClick={onComplete}
            className="w-full py-3 mt-2 rounded-xl font-bold bg-gradient-to-r from-gold to-[#ff7700] text-black tracking-wider hover:scale-[1.02] shadow-[0_0_15px_rgba(255,183,0,0.3)] transition-all cursor-pointer animate-fadeIn"
          >
            ENTER WORKSPACE
          </button>
        ) : (
          <button
            disabled
            className="w-full py-3 mt-2 rounded-xl font-semibold bg-white/5 border border-white/10 text-dim tracking-wider select-none"
          >
            INITIALIZING CORE...
          </button>
        )}
      </div>
    </div>
  );
}
