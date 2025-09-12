import React from 'react';
import { Video, staticFile } from 'remotion';

interface ManimVideoProps {
  fileName: string;
  startFrom?: number;
}

export const ManimVideo: React.FC<ManimVideoProps> = ({ 
  fileName, 
  startFrom = 0 
}) => {
  const videoPath = staticFile(`assets/manim/${fileName}`);
  
  return (
    <Video 
      src={videoPath} 
      startFrom={startFrom}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain'
      }}
    />
  );
};

export const ManimComposition: React.FC = () => {
  return (
    <div style={{
      flex: 1,
      backgroundColor: '#1e1e1e',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <ManimVideo fileName="example.mp4" />
    </div>
  );
};