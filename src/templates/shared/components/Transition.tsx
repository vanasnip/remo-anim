import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export type TransitionType = 'fade' | 'slide' | 'scale' | 'rotate' | 'wipe';

interface TransitionProps {
	type: TransitionType;
	duration: number;
	children: React.ReactNode;
	direction?: 'in' | 'out';
	from?: 'left' | 'right' | 'top' | 'bottom';
}

export const Transition: React.FC<TransitionProps> = ({
	type,
	duration,
	children,
	direction = 'in',
	from = 'left',
}) => {
	const frame = useCurrentFrame();
	
	const progress = direction === 'in'
		? interpolate(frame, [0, duration], [0, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		})
		: interpolate(frame, [0, duration], [1, 0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});

	let style: React.CSSProperties = {};

	switch (type) {
		case 'fade':
			style = {
				opacity: progress,
			};
			break;
			
		case 'slide':
			const translateMap = {
				left: `translateX(${(1 - progress) * -100}%)`,
				right: `translateX(${(1 - progress) * 100}%)`,
				top: `translateY(${(1 - progress) * -100}%)`,
				bottom: `translateY(${(1 - progress) * 100}%)`,
			};
			style = {
				transform: translateMap[from],
			};
			break;
			
		case 'scale':
			style = {
				transform: `scale(${progress})`,
				opacity: progress,
			};
			break;
			
		case 'rotate':
			style = {
				transform: `rotate(${(1 - progress) * 180}deg) scale(${progress})`,
				opacity: progress,
			};
			break;
			
		case 'wipe':
			const clipMap = {
				left: `inset(0 ${(1 - progress) * 100}% 0 0)`,
				right: `inset(0 0 0 ${(1 - progress) * 100}%)`,
				top: `inset(0 0 ${(1 - progress) * 100}% 0)`,
				bottom: `inset(${(1 - progress) * 100}% 0 0 0)`,
			};
			style = {
				clipPath: clipMap[from],
			};
			break;
	}

	return (
		<div style={{
			width: '100%',
			height: '100%',
			...style,
		}}>
			{children}
		</div>
	);
};