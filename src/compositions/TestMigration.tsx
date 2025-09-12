import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Arc } from '../components/animations/Arc';

export const TestMigration: React.FC = () => {
  const frame = useCurrentFrame();
  
  // Test the Arc component with animations
  const progress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const rotateProgress = interpolate(frame, [0, 120], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0e1a' }}>
      <Arc
        progress={progress}
        rotation={30}
        rotateProgress={rotateProgress}
        color1="#f59e0b"
        color2="#ec4899"
      />
      <Arc
        progress={progress}
        rotation={60}
        rotateProgress={rotateProgress}
        color1="#3b82f6"
        color2="#8b5cf6"
      />
      <Arc
        progress={progress}
        rotation={90}
        rotateProgress={rotateProgress}
        color1="#10b981"
        color2="#06b6d4"
      />
    </AbsoluteFill>
  );
};