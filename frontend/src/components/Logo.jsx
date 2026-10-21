import React from 'react';

export default function Logo({ size = 48, showGlow = true }) {
  // We use mix-blend-mode: screen to programmatically remove the black background 
  // from the JPEG/PNG image, showing only the green artwork on the dark interface.
  // scale-[1.25] crops the empty black margins to make the logo occupy 90% of the area.
  return (
    <div
      className="nodebeacon-logo-badge relative overflow-hidden shrink-0 flex items-center justify-center rounded-xl bg-[#111714] border border-[#303D35] shadow-md"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: '#111714',
        borderColor: '#303D35',
        filter: showGlow ? 'drop-shadow(0 0 10px rgba(32,164,100,0.35))' : 'none'
      }}
    >
      <img
        src="/icon.png"
        alt="NodeBeacon Icon"
        className="w-full h-full object-contain scale-[1.25]"
        style={{ mixBlendMode: 'screen' }}
      />
    </div>
  );
}
