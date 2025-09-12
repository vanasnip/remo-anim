import {Composition} from 'remotion';
import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Logo} from './components/animations/Logo';
import {Title} from './components/animations/Title';
import {Subtitle} from './components/animations/Subtitle';

export const HelloWorld: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#1a1a1a'}}>
      <Logo logoColor1="#86A8E7" logoColor2="#91EAE4" />
      <Title titleText="Hello World" titleColor="#ffffff" />
      <Subtitle />
    </AbsoluteFill>
  );
};

export const HelloWorldComposition: React.FC = () => {
  return (
    <Composition
      id="HelloWorld-Migrated"
      component={HelloWorld}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};