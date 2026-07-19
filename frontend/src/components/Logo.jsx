import React from 'react';

export default function Logo({ size = 48, showGlow = true }) {
  // We use mix-blend-mode: screen to programmatically remove the black background 
  // from the JPEG/PNG image, showing only the green artwork on the dark interface.
  // scale-[1.25] crops the empty black margins to make the logo occupy 90% of the area.
  return (
    <div 
      className="relative overflow-hidden shrink-0 flex items-center justify-center rounded-lg"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        filter: showGlow ? 'drop-shadow(0 0 10px rgba(87,227,137,0.15))' : 'none'
      }}
    >
      <img 
        src="/icon.png" 
        alt="NodeBeacon Icon" 
        className="absolute w-full h-full object-contain scale-[1.25]"
        style={{ mixBlendMode: 'screen' }}
      />
    </div>
  );
}
