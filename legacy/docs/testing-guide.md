# Testing Guide

## Overview

This project has comprehensive test coverage with 70+ test cases using **Jest** and **React Testing Library**.

## Test Structure

```
remotion-app/src/__tests__/
├── components/           # Component unit tests
│   └── ErrorBoundary.test.tsx
├── compositions/         # Video template tests
│   ├── Augmented/
│   │   └── ContentAugmentation.test.tsx (31 tests)
│   ├── Instructional/
│   │   ├── PythonManimTutorial.test.tsx (19 tests)
│   │   └── ReactComponentTutorial.test.tsx (20 tests)
│   ├── PythonTutorial.test.tsx
│   └── TutorialVideo.test.tsx
└── setupTests.ts        # Test configuration
```

## Running Tests

### All Tests

```bash
cd remotion-app
npm test
```

### Watch Mode (Development)

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm test -- --coverage
```

### Specific Test File

```bash
npm test ContentAugmentation
npm test PythonManimTutorial
```

### Debug Mode

```bash
npm test -- --no-coverage --verbose
```

## Writing Tests

### Basic Component Test

```tsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YourComponent } from "../YourComponent";

describe("YourComponent", () => {
  it("renders without crashing", () => {
    render(<YourComponent />);
    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });
});
```

### Testing Remotion Components

```tsx
import * as Remotion from "remotion";

// Mock Remotion hooks
jest.mock("remotion");

beforeEach(() => {
  (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
  (Remotion.useVideoConfig as jest.Mock).mockReturnValue({
    fps: 30,
    durationInFrames: 900,
    width: 1920,
    height: 1080,
  });
});

it("displays correct content at frame 50", () => {
  (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(50);
  render(<YourVideo />);
  // Your assertions
});
```

### Testing Animations

```tsx
it("animates opacity correctly", () => {
  const mockInterpolate = Remotion.interpolate as jest.Mock;
  mockInterpolate.mockImplementation((frame, inputRange, outputRange) => {
    // Simulate interpolation
    if (frame <= inputRange[0]) return outputRange[0];
    if (frame >= inputRange[1]) return outputRange[1];
    const progress = (frame - inputRange[0]) / (inputRange[1] - inputRange[0]);
    return outputRange[0] + (outputRange[1] - outputRange[0]) * progress;
  });

  render(<AnimatedComponent />);
  // Test animation states
});
```

## Mock Strategy

### Remotion Mock (`__mocks__/remotion.tsx`)

```tsx
// Properly typed mock components
interface AbsoluteFillProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export const AbsoluteFill = ({
  children,
  style,
  ...props
}: AbsoluteFillProps) => (
  <div data-testid="absolute-fill" style={{ ...style }} {...props}>
    {children}
  </div>
);

// Mock hooks with proper types
export const useCurrentFrame = jest.fn(() => 30);
export const useVideoConfig = jest.fn(() => ({
  fps: 30,
  durationInFrames: 900,
  width: 1920,
  height: 1080,
}));
```

### External Library Mocks

```tsx
// Mock react-syntax-highlighter
jest.mock("react-syntax-highlighter", () => ({
  Prism: ({
    children,
    language,
    ...props
  }: PropsWithChildren<{ language?: string }>) => (
    <pre data-testid="syntax-highlighter" data-language={language} {...props}>
      {children}
    </pre>
  ),
}));
```

## Test Categories

### 1. Rendering Tests

- Component mounts without errors
- Initial state is correct
- Props are handled properly

### 2. Animation Tests

- Frame-based transitions
- Interpolation calculations
- Spring animations
- Timeline synchronization

### 3. Interaction Tests

- User clicks and inputs
- Tab switching
- Video controls
- Error handling

### 4. Edge Cases

- Missing props
- Error boundaries
- Video loading failures
- Empty states

## Best Practices

### 1. Use Data-testid

```tsx
<div data-testid="unique-element">
```

### 2. Test User Behavior

```tsx
// Good - tests what user sees
expect(screen.getByText("Submit")).toBeInTheDocument();

// Avoid - tests implementation details
expect(component.state.isSubmitting).toBe(false);
```

### 3. Mock External Dependencies

```tsx
jest.mock("remotion");
jest.mock("react-syntax-highlighter");
```

### 4. Clean Up Between Tests

```tsx
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  cleanup(); // Usually automatic
});
```

### 5. Test Accessibility

```tsx
expect(screen.getByRole("button", { name: "Submit" })).toBeInTheDocument();
```

## Common Testing Patterns

### Testing at Different Frames

```tsx
const frameTests = [
  { frame: 0, expected: "Introduction" },
  { frame: 100, expected: "Step 1" },
  { frame: 200, expected: "Step 2" },
];

frameTests.forEach(({ frame, expected }) => {
  it(`shows "${expected}" at frame ${frame}`, () => {
    (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(frame);
    render(<Tutorial />);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
```

### Testing Error States

```tsx
it("handles video loading error", () => {
  const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

  const { container } = render(<VideoComponent />);
  const video = container.querySelector("video");

  // Trigger error
  fireEvent.error(video!);

  expect(consoleSpy).toHaveBeenCalledWith(
    expect.stringContaining("could not be loaded"),
  );

  consoleSpy.mockRestore();
});
```

### Testing Animations

```tsx
it("fades in content", () => {
  // Start of animation
  (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(0);
  const { rerender } = render(<FadeInComponent />);
  expect(screen.getByTestId("content")).toHaveStyle({ opacity: 0 });

  // End of animation
  (Remotion.useCurrentFrame as jest.Mock).mockReturnValue(30);
  rerender(<FadeInComponent />);
  expect(screen.getByTestId("content")).toHaveStyle({ opacity: 1 });
});
```

## Debugging Tests

### Visual Debugging

```tsx
import { debug } from "@testing-library/react";

it("debugging test", () => {
  const { container } = render(<Component />);
  debug(container); // Prints HTML to console
});
```

### Checking Mock Calls

```tsx
expect(mockFunction).toHaveBeenCalledWith(
  expect.objectContaining({
    frame: 50,
    fps: 30,
  }),
);

console.log(mockFunction.mock.calls); // See all calls
```

### Using Chrome DevTools

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
# Open chrome://inspect in Chrome
```

## CI/CD Integration

Tests run automatically in CI/CD pipeline:

```yaml
- name: Run tests
  run: |
    cd remotion-app
    npm ci
    npm test -- --coverage --watchAll=false
```

## Troubleshooting

| Issue                            | Solution                                      |
| -------------------------------- | --------------------------------------------- |
| `Cannot find module 'remotion'`  | Check mock file exists in `__mocks__`         |
| `TypeError: X is not a function` | Ensure mocks are properly typed               |
| Timeout errors                   | Increase timeout: `jest.setTimeout(10000)`    |
| Flaky tests                      | Use `waitFor` for async operations            |
| Coverage gaps                    | Add tests for error cases and edge conditions |

## Test Coverage Goals

- **Minimum**: 70% overall coverage
- **Target**: 85% for critical paths
- **Focus areas**:
  - Animation timing logic
  - User interactions
  - Error handling
  - Component props validation
