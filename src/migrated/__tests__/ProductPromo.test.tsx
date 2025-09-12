import React from 'react';
import { render } from '@testing-library/react';
import { ProductPromo } from '../compositions/ProductPromo';

// Mock Remotion hooks
jest.mock('remotion', () => ({
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 150 }),
  AbsoluteFill: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  spring: ({ frame }: any) => frame / 30,
  interpolate: (value: number, input: number[], output: number[]) => {
    if (value <= input[0]) return output[0];
    if (value >= input[1]) return output[1];
    const ratio = (value - input[0]) / (input[1] - input[0]);
    return output[0] + ratio * (output[1] - output[0]);
  },
}));

describe('ProductPromo', () => {
  it('renders without crashing', () => {
    const { container } = render(<ProductPromo />);
    expect(container).toBeInTheDocument();
  });

  it('displays the main title', () => {
    const { getByText } = render(<ProductPromo />);
    expect(getByText('Introducing ProductX')).toBeInTheDocument();
  });

  it('displays the subtitle', () => {
    const { getByText } = render(<ProductPromo />);
    expect(getByText('Revolutionary Solution for Modern Teams')).toBeInTheDocument();
  });

  it('displays all feature cards', () => {
    const { getByText } = render(<ProductPromo />);
    expect(getByText('Fast')).toBeInTheDocument();
    expect(getByText('Secure')).toBeInTheDocument();
    expect(getByText('Scalable')).toBeInTheDocument();
  });
});