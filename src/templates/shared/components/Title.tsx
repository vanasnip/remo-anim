import React from 'react';
import {spring, useCurrentFrame, useVideoConfig} from 'remotion';

interface TitleProps {
	title: string;
	subtitle?: string;
	color?: string;
	backgroundColor?: string;
	fontSize?: number;
	fontFamily?: string;
	position?: 'center' | 'top' | 'bottom';
}

export const Title: React.FC<TitleProps> = ({
	title,
	subtitle,
	color = '#ffffff',
	backgroundColor = 'transparent',
	fontSize = 72,
	fontFamily = 'Inter, sans-serif',
	position = 'center',
}) => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	// Smooth entrance animation
	const scale = spring({
		frame,
		fps,
		from: 0.8,
		to: 1,
		durationInFrames: 20,
	});

	const opacity = spring({
		frame,
		fps,
		from: 0,
		to: 1,
		durationInFrames: 15,
	});

	const translateY = spring({
		frame,
		fps,
		from: position === 'top' ? -50 : position === 'bottom' ? 50 : 0,
		to: 0,
		durationInFrames: 20,
	});

	const containerStyle: React.CSSProperties = {
		position: 'absolute',
		width: '100%',
		display: 'flex',
		flexDirection: 'column',
		alignItems: 'center',
		justifyContent: position === 'top' ? 'flex-start' : position === 'bottom' ? 'flex-end' : 'center',
		padding: '60px',
		backgroundColor,
		opacity,
		transform: `scale(${scale}) translateY(${translateY}px)`,
		...(position === 'top' && {top: 0}),
		...(position === 'bottom' && {bottom: 0}),
		...(position === 'center' && {top: '50%', transform: `translate(0, -50%) scale(${scale}) translateY(${translateY}px)`}),
	};

	return (
		<div style={containerStyle}>
			<h1 style={{
				fontSize,
				color,
				margin: 0,
				fontFamily,
				fontWeight: 800,
				textAlign: 'center',
				lineHeight: 1.1,
				textShadow: '0 2px 10px rgba(0,0,0,0.3)',
			}}>
				{title}
			</h1>
			{subtitle && (
				<p style={{
					fontSize: fontSize * 0.35,
					color,
					opacity: 0.9,
					margin: '20px 0 0 0',
					fontFamily,
					fontWeight: 400,
					textAlign: 'center',
				}}>
					{subtitle}
				</p>
			)}
		</div>
	);
};