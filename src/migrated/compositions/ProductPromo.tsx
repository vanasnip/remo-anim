import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Typography, Box } from '@mui/material';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#ff4081',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
});

export const ProductPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: {
      damping: 12,
      stiffness: 200,
    },
  });

  const subtitleOpacity = interpolate(
    frame,
    [20, 40],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const featureSlide = interpolate(
    frame,
    [60, 80],
    [-100, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <ThemeProvider theme={theme}>
      <AbsoluteFill
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
        }}
      >
        <Box
          sx={{
            transform: `scale(${titleScale})`,
            textAlign: 'center',
            mb: 4,
          }}
        >
          <Typography
            variant="h1"
            sx={{
              color: 'white',
              fontWeight: 'bold',
              fontSize: '80px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            Introducing ProductX
          </Typography>
        </Box>

        <Box
          sx={{
            opacity: subtitleOpacity,
            textAlign: 'center',
            mb: 6,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              color: 'white',
              fontSize: '32px',
              fontWeight: 300,
            }}
          >
            Revolutionary Solution for Modern Teams
          </Typography>
        </Box>

        <Box
          sx={{
            transform: `translateX(${featureSlide}%)`,
            display: 'flex',
            gap: 4,
            mt: 4,
          }}
        >
          {['Fast', 'Secure', 'Scalable'].map((feature, index) => (
            <Box
              key={feature}
              sx={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(10px)',
                borderRadius: '20px',
                padding: '30px',
                minWidth: '200px',
                textAlign: 'center',
                opacity: interpolate(
                  frame,
                  [80 + index * 10, 90 + index * 10],
                  [0, 1],
                  {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  }
                ),
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                {feature}
              </Typography>
            </Box>
          ))}
        </Box>
      </AbsoluteFill>
    </ThemeProvider>
  );
};