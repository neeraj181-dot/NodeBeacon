import React from 'react';

export default function WaveBackground() {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0 select-none bg-[#050505]">
      {/* Shifting radial cyber glows */}
      <div className="absolute top-[-25%] left-[-20%] w-[70%] h-[70%] rounded-full bg-[#57E389]/4 blur-[130px] animate-pulse-slow pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] rounded-full bg-[#00D084]/4 blur-[130px] animate-pulse-slow-delayed pointer-events-none" />
      
      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:32px_32px] opacity-70 pointer-events-none" />
      
      {/* Horizontal glowing lines grid lines */}
      <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-[#57E389]/10 to-transparent top-[35%]" />
      <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-[#00D084]/8 to-transparent top-[65%]" />

      {/* SVG Wave lines */}
      <div className="absolute bottom-0 left-0 w-full h-[50%] overflow-hidden">
        <svg className="absolute w-[200%] h-full opacity-[0.08] animate-wave-slow" viewBox="0 0 1440 400" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 220 C360 120 720 320 1080 220 C1440 120 1800 320 2160 220 C2520 120 2880 320 3240 220 L3240 400 L0 400 Z" fill="url(#wave-gradient)" />
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#57E389" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#57E389" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        <svg className="absolute w-[200%] h-full opacity-[0.06] animate-wave-fast" viewBox="0 0 1440 400" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 270 C360 320 720 170 1080 270 C1440 370 1800 220 2160 270 C2520 320 2880 170 3240 270 L3240 400 L0 400 Z" fill="url(#wave-gradient-secondary)" />
          <defs>
            <linearGradient id="wave-gradient-secondary" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00D084" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#00D084" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0">
        <div className="absolute w-[3px] h-[3px] bg-[#57E389] rounded-full top-[25%] left-[15%] opacity-30 animate-float-particle-1" />
        <div className="absolute w-[4px] h-[4px] bg-[#00D084] rounded-full top-[45%] left-[35%] opacity-20 animate-float-particle-2" />
        <div className="absolute w-[3px] h-[3px] bg-[#57E389] rounded-full top-[68%] left-[78%] opacity-35 animate-float-particle-3" />
        <div className="absolute w-[5px] h-[5px] bg-[#57E389]/40 rounded-full top-[18%] left-[70%] opacity-15 animate-float-particle-4" />
        <div className="absolute w-[3px] h-[3px] bg-[#00D084] rounded-full top-[80%] left-[22%] opacity-30 animate-float-particle-5" />
      </div>
    </div>
  );
}
