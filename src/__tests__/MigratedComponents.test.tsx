import React from 'react';
import { render } from '@testing-library/react';
import { Atom } from '../components/animations/Atom';
import { Logo } from '../components/animations/Logo';
import { Title } from '../components/animations/Title';
import { Subtitle } from '../components/animations/Subtitle';
import { COLOR_1, FONT_FAMILY } from '../constants/animation';

// Mock Remotion hooks for testing
jest.mock('remotion', () => ({
  useVideoConfig: () => ({
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 150,
  }),
  useCurrentFrame: () => 30,
  spring: () => 1,
  interpolate: () => 1,
  random: () => 12345,
  AbsoluteFill: ({ children, style }: any) => <div style={style}>{children}</div>,
}));

// Mock z and zColor for Logo component
jest.mock('zod', () => ({
  z: {
    object: () => ({})
  }
}));

jest.mock('@remotion/zod-types', () => ({
  zColor: () => ({})
}));

describe('Migrated Components', () => {
  describe('Constants', () => {
    test('should export correct color and font', () => {
      expect(COLOR_1).toBe('#86A8E7');
      expect(FONT_FAMILY).toBe('SF Pro Text, Helvetica, Arial, sans-serif');
    });
  });

  describe('Atom Component', () => {
    test('should render without crashing', () => {
      const { container } = render(
        <Atom scale={1} color1="#ff0000" color2="#00ff00" />
      );
      
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      
      const circle = container.querySelector('circle');
      expect(circle).toBeInTheDocument();
      expect(circle).toHaveAttribute('r', '70');
    });

    test('should apply scale transformation', () => {
      const { container } = render(
        <Atom scale={2} color1="#ff0000" color2="#00ff00" />
      );
      
      const svg = container.querySelector('svg');
      expect(svg).toHaveStyle('transform: scale(2)');
    });
  });

  describe('Title Component', () => {
    test('should render title text with correct styling', () => {
      const titleText = 'Hello World';
      const titleColor = '#ff0000';
      
      const { container } = render(
        <Title titleText={titleText} titleColor={titleColor} />
      );
      
      const title = container.querySelector('h1');
      expect(title).toBeInTheDocument();
      
      const words = container.querySelectorAll('span');
      expect(words).toHaveLength(2); // "Hello" and "World"
      
      words.forEach(word => {
        expect(word).toHaveStyle(`color: ${titleColor}`);
      });
    });

    test('should split text into individual words', () => {
      const { container } = render(
        <Title titleText="Test Multiple Words" titleColor="#000000" />
      );
      
      const words = container.querySelectorAll('span');
      expect(words).toHaveLength(3);
      expect(words[0]).toHaveTextContent('Test');
      expect(words[1]).toHaveTextContent('Multiple');
      expect(words[2]).toHaveTextContent('Words');
    });
  });

  describe('Subtitle Component', () => {
    test('should render subtitle with code element', () => {
      const { container, getByText } = render(<Subtitle />);
      
      expect(getByText(/Edit/)).toBeInTheDocument();
      expect(getByText('src/Root.tsx')).toBeInTheDocument();
      
      const codeElement = container.querySelector('code');
      expect(codeElement).toBeInTheDocument();
      expect(codeElement).toHaveStyle(`color: ${COLOR_1}`);
    });
  });

  describe('Logo Component', () => {
    test('should render without crashing', () => {
      const { container } = render(
        <Logo logoColor1="#ff0000" logoColor2="#00ff00" />
      );
      
      // Should render AbsoluteFill container
      const absoluteFill = container.firstChild;
      expect(absoluteFill).toBeInTheDocument();
    });
  });

  describe('Integration Test - All Components Together', () => {
    test('should render all components without conflicts', () => {
      const TestComposition = () => (
        <div>
          <Logo logoColor1="#ff0000" logoColor2="#00ff00" />
          <Title titleText="Test Title" titleColor="#000000" />
          <Subtitle />
          <Atom scale={1} color1="#ff0000" color2="#00ff00" />
        </div>
      );

      const { container } = render(<TestComposition />);
      
      // Check that all components are present
      expect(container.querySelector('svg')).toBeInTheDocument(); // From Atom or Arc
      expect(container.querySelector('h1')).toBeInTheDocument(); // From Title
      expect(container.querySelector('code')).toBeInTheDocument(); // From Subtitle
      
      // Should not throw any errors
      expect(container).toBeInTheDocument();
    });
  });
});