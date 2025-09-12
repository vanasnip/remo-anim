import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, interpolate, spring, staticFile, Video} from 'remotion';
import {Title} from '../shared/components/Title';
import {Background} from '../shared/components/Background';
import {Transition} from '../shared/components/Transition';

export interface Animation {
	id: string;
	title: string;
	category: string;
	video: string;
	description?: string;
	duration: number;
	transitionType?: 'fade' | 'slide' | 'scale' | 'rotate';
}

export interface AnimationShowcaseTemplateProps {
	// Showcase Info
	title: string;
	subtitle?: string;
	
	// Animations
	animations: Animation[];
	
	// Layout
	layout?: 'single' | 'grid' | 'carousel';
	showTitles?: boolean;
	showDescriptions?: boolean;
	
	// Styling
	primaryColor?: string;
	backgroundColor?: string[];
	titlePosition?: 'overlay' | 'separate';
	
	// Outro
	outro?: {
		message: string;
		credits?: string[];
	};
}

export const AnimationShowcaseTemplate: React.FC<AnimationShowcaseTemplateProps> = ({
	title,
	subtitle,
	animations,
	layout = 'single',
	showTitles = true,
	showDescriptions = false,
	primaryColor = '#06b6d4',
	backgroundColor = ['#083344', '#164e63'],
	titlePosition = 'overlay',
	outro,
}) => {
	const {fps} = useVideoConfig();
	const frame = useCurrentFrame();
	
	// Calculate timings
	const introDuration = fps * 3;
	const outroDuration = outro ? fps * 3 : 0;
	
	let currentFrame = introDuration;
	const animationFrames = animations.map(animation => {
		const start = currentFrame;
		currentFrame += animation.duration;
		return {start, duration: animation.duration};
	});

	const renderAnimationSingle = (animation: Animation, index: number) => {
		const frameInSequence = frame - animationFrames[index].start;
		const progress = spring({
			frame: frameInSequence,
			fps,
			from: 0,
			to: 1,
			durationInFrames: 20,
		});

		return (
			<Sequence
				key={animation.id}
				from={animationFrames[index].start}
				durationInFrames={animationFrames[index].duration}
			>
				<AbsoluteFill>
					<Transition 
						type={animation.transitionType || 'fade'} 
						duration={20} 
						direction="in"
					>
						<AbsoluteFill>
							{/* Video Display */}
							<Video
								src={staticFile(animation.video)}
								style={{
									width: '100%',
									height: '100%',
									objectFit: 'contain',
								}}
							/>
							
							{/* Title Overlay */}
							{showTitles && titlePosition === 'overlay' && (
								<div style={{
									position: 'absolute',
									bottom: 0,
									left: 0,
									right: 0,
									background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
									padding: '60px',
									transform: `translateY(${(1 - progress) * 100}px)`,
								}}>
									<h3 style={{
										fontSize: 42,
										color: primaryColor,
										margin: 0,
										fontWeight: 700,
										textShadow: '0 2px 10px rgba(0,0,0,0.5)',
									}}>
										{animation.title}
									</h3>
									{showDescriptions && animation.description && (
										<p style={{
											fontSize: 20,
											color: '#ffffff',
											marginTop: 10,
											opacity: 0.9,
										}}>
											{animation.description}
										</p>
									)}
									<span style={{
										fontSize: 16,
										color: primaryColor,
										opacity: 0.7,
										marginTop: 10,
										display: 'inline-block',
									}}>
										{animation.category}
									</span>
								</div>
							)}
						</AbsoluteFill>
					</Transition>
				</AbsoluteFill>
			</Sequence>
		);
	};

	const renderAnimationGrid = () => {
		// For grid layout, show multiple animations at once
		const gridDuration = Math.max(...animations.map(a => a.duration));
		
		return (
			<Sequence from={introDuration} durationInFrames={gridDuration}>
				<AbsoluteFill style={{
					display: 'grid',
					gridTemplateColumns: 'repeat(2, 1fr)',
					gridTemplateRows: 'repeat(2, 1fr)',
					gap: '20px',
					padding: '40px',
				}}>
					{animations.slice(0, 4).map((animation, index) => {
						const staggerDelay = index * 10;
						const animProgress = spring({
							frame: frame - introDuration - staggerDelay,
							fps,
							from: 0,
							to: 1,
							durationInFrames: 30,
						});
						
						return (
							<div
								key={animation.id}
								style={{
									position: 'relative',
									borderRadius: '16px',
									overflow: 'hidden',
									transform: `scale(${animProgress})`,
									opacity: animProgress,
									boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
								}}
							>
								<Video
									src={staticFile(animation.video)}
									style={{
										width: '100%',
										height: '100%',
										objectFit: 'cover',
									}}
								/>
								{showTitles && (
									<div style={{
										position: 'absolute',
										bottom: 0,
										left: 0,
										right: 0,
										background: 'rgba(0,0,0,0.8)',
										padding: '15px',
									}}>
										<h4 style={{
											fontSize: 20,
											color: primaryColor,
											margin: 0,
										}}>
											{animation.title}
										</h4>
									</div>
								)}
							</div>
						);
					})}
				</AbsoluteFill>
			</Sequence>
		);
	};

	const renderAnimationCarousel = () => {
		// Carousel shows animations with smooth transitions
		const totalDuration = animations.reduce((sum, a) => sum + a.duration, 0);
		
		return (
			<Sequence from={introDuration} durationInFrames={totalDuration}>
				<AbsoluteFill style={{
					padding: '60px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}>
					{animations.map((animation, index) => {
						const isActive = frame >= animationFrames[index].start && 
										frame < animationFrames[index].start + animationFrames[index].duration;
						
						const position = interpolate(
							frame,
							[
								animationFrames[index].start - 30,
								animationFrames[index].start,
								animationFrames[index].start + animationFrames[index].duration,
								animationFrames[index].start + animationFrames[index].duration + 30,
							],
							[100, 0, 0, -100],
							{
								extrapolateLeft: 'clamp',
								extrapolateRight: 'clamp',
							}
						);
						
						return (
							<div
								key={animation.id}
								style={{
									position: 'absolute',
									width: '80%',
									height: '80%',
									transform: `translateX(${position}%)`,
									opacity: isActive ? 1 : 0,
									transition: 'opacity 0.5s',
								}}
							>
								<Video
									src={staticFile(animation.video)}
									style={{
										width: '100%',
										height: '100%',
										objectFit: 'contain',
										borderRadius: '20px',
										boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
									}}
								/>
								{showTitles && isActive && (
									<div style={{
										position: 'absolute',
										top: 40,
										left: 40,
										background: 'rgba(0,0,0,0.8)',
										padding: '20px 30px',
										borderRadius: '12px',
										backdropFilter: 'blur(10px)',
									}}>
										<h3 style={{
											fontSize: 32,
											color: primaryColor,
											margin: 0,
										}}>
											{animation.title}
										</h3>
										<span style={{
											fontSize: 18,
											color: '#ffffff',
											opacity: 0.7,
										}}>
											{animation.category}
										</span>
									</div>
								)}
							</div>
						);
					})}
				</AbsoluteFill>
			</Sequence>
		);
	};

	return (
		<AbsoluteFill>
			<Background type="gradient" colors={backgroundColor} animated />
			
			{/* Intro */}
			<Sequence from={0} durationInFrames={introDuration}>
				<Transition type="scale" duration={25} direction="in">
					<AbsoluteFill style={{
						justifyContent: 'center',
						alignItems: 'center',
					}}>
						<Title
							title={title}
							subtitle={subtitle}
							color="#ffffff"
							fontSize={80}
						/>
					</AbsoluteFill>
				</Transition>
			</Sequence>
			
			{/* Animations Display */}
			{layout === 'single' && animations.map((animation, index) => 
				renderAnimationSingle(animation, index)
			)}
			{layout === 'grid' && renderAnimationGrid()}
			{layout === 'carousel' && renderAnimationCarousel()}
			
			{/* Outro */}
			{outro && (
				<Sequence
					from={currentFrame}
					durationInFrames={outroDuration}
				>
					<Transition type="fade" duration={20} direction="in">
						<AbsoluteFill style={{
							justifyContent: 'center',
							alignItems: 'center',
							background: 'rgba(0,0,0,0.8)',
							padding: '60px',
						}}>
							<div style={{
								textAlign: 'center',
							}}>
								<h2 style={{
									fontSize: 56,
									color: primaryColor,
									marginBottom: 30,
									fontWeight: 700,
								}}>
									{outro.message}
								</h2>
								{outro.credits && (
									<div style={{
										marginTop: 40,
									}}>
										{outro.credits.map((credit, i) => (
											<p
												key={i}
												style={{
													fontSize: 20,
													color: '#ffffff',
													opacity: 0.8,
													margin: '10px 0',
												}}
											>
												{credit}
											</p>
										))}
									</div>
								)}
							</div>
						</AbsoluteFill>
					</Transition>
				</Sequence>
			)}
		</AbsoluteFill>
	);
};