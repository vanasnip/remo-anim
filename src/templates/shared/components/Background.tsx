import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';

export type BackgroundType = 'solid' | 'gradient' | 'animated-gradient' | 'particles';

interface BackgroundProps {
	type?: BackgroundType;
	colors?: string[];
	animated?: boolean;
	opacity?: number;
}

export const Background: React.FC<BackgroundProps> = ({
	type = 'gradient',
	colors = ['#667eea', '#764ba2'],
	animated = false,
	opacity = 1,
}) => {
	const frame = useCurrentFrame();
	
	// Animated gradient angle
	const angle = animated 
		? interpolate(frame, [0, 300], [0, 360], {
			extrapolateRight: 'clamp',
		})
		: 45;

	let backgroundStyle: React.CSSProperties = {
		position: 'absolute',
		width: '100%',
		height: '100%',
		opacity,
	};

	switch (type) {
		case 'solid':
			backgroundStyle.backgroundColor = colors[0];
			break;
			
		case 'gradient':
		case 'animated-gradient':
			backgroundStyle.background = `linear-gradient(${angle}deg, ${colors.join(', ')})`;
			break;
			
		case 'particles':
			// Particle effect using CSS
			backgroundStyle.background = colors[0];
			backgroundStyle.backgroundImage = `
				radial-gradient(circle at 20% 80%, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 70%),
				radial-gradient(circle at 80% 20%, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 70%),
				radial-gradient(circle at 40% 40%, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 70%)
			`;
			if (animated) {
				const shift = interpolate(frame, [0, 600], [0, 100], {
					extrapolateRight: 'wrap',
				});
				backgroundStyle.backgroundPosition = `${shift}% ${shift}%`;
			}
			break;
	}

	return <div style={backgroundStyle} />;
};