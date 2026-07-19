import React, { useEffect, useState } from 'react';
import Logo from './Logo';

export default function Splash({ onFinish }) {
  const [fade, setFade] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Progress bar simulation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2.5;
      });
    }, 40);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress === 100) {
      const timer = setTimeout(() => {
        setFade(true);
      }, 500);

      const finishTimer = setTimeout(() => {
        onFinish();
      }, 900);

      return () => {
        clearTimeout(timer);
        clearTimeout(finishTimer);
      };
    }
  }, [progress, onFinish]);

  return (
    <div className={`fixed inset-0 bg-[#070707] z-50 flex flex-col items-center justify-center transition-opacity duration-400 select-none ${fade ? 'opacity-0' : 'opacity-100'}`}>
      <div className="flex flex-col items-center gap-8 max-w-sm w-full px-6">
        
        {/* Pulsing Logo (72px) */}
        <div className="animate-pulse duration-1000">
          <Logo size={72} showGlow={true} />
        </div>

        <div className="space-y-4 w-full text-center">
          <span className="text-[10px] text-accent tracking-[0.25em] font-mono uppercase font-bold">
            Initializing NodeBeacon...
          </span>

          {/* Animated Loading Bar */}
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-accent transition-all duration-100 ease-out shadow-[0_0_8px_#57E389]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Version Tag */}
      <div className="absolute bottom-8 text-secondaryText text-[10px] tracking-widest font-mono">
        v1.0.0
      </div>
    </div>
  );
}
