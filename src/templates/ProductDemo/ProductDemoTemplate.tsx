import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, interpolate, spring, staticFile, Video, Img} from 'remotion';
import {Title} from '../shared/components/Title';
import {Background} from '../shared/components/Background';
import {Transition} from '../shared/components/Transition';

export interface ProductFeature {
	icon?: string;
	title: string;
	description: string;
	demo?: {
		type: 'video' | 'image';
		src: string;
	};
	benefits?: string[];
	duration: number;
}

export interface ProductDemoTemplateProps {
	// Product Info
	productName: string;
	tagline: string;
	logo?: string;
	
	// Features
	features: ProductFeature[];
	
	// Styling
	brandColor?: string;
	accentColor?: string;
	backgroundColor?: string[];
	
	// Call to Action
	cta?: {
		headline: string;
		action: string;
		url?: string;
		benefits?: string[];
	};
}

export const ProductDemoTemplate: React.FC<ProductDemoTemplateProps> = ({
	productName,
	tagline,
	logo,
	features,
	brandColor = '#8b5cf6',
	accentColor = '#ec4899',
	backgroundColor = ['#1e1b4b', '#312e81'],
	cta,
}) => {
	const {fps} = useVideoConfig();
	const frame = useCurrentFrame();
	
	// Calculate timings
	const introDuration = fps * 4;
	const ctaDuration = cta ? fps * 5 : 0;
	
	let currentFrame = introDuration;
	const featureFrames = features.map(feature => {
		const start = currentFrame;
		currentFrame += feature.duration;
		return {start, duration: feature.duration};
	});

	return (
		<AbsoluteFill>
			<Background type="animated-gradient" colors={backgroundColor} animated />
			
			{/* Product Intro */}
			<Sequence from={0} durationInFrames={introDuration}>
				<AbsoluteFill style={{
					justifyContent: 'center',
					alignItems: 'center',
					padding: '60px',
				}}>
					<Transition type="scale" duration={25} direction="in">
						<div style={{
							textAlign: 'center',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '30px',
						}}>
							{logo && (
								<Img
									src={staticFile(logo)}
									style={{
										width: 120,
										height: 120,
										objectFit: 'contain',
									}}
								/>
							)}
							<div>
								<h1 style={{
									fontSize: 86,
									color: '#ffffff',
									margin: 0,
									fontWeight: 800,
									letterSpacing: -2,
									textShadow: `0 0 40px ${brandColor}`,
								}}>
									{productName}
								</h1>
								<p style={{
									fontSize: 32,
									color: accentColor,
									marginTop: 20,
									fontWeight: 400,
									letterSpacing: 0.5,
								}}>
									{tagline}
								</p>
							</div>
						</div>
					</Transition>
				</AbsoluteFill>
			</Sequence>
			
			{/* Feature Showcases */}
			{features.map((feature, index) => {
				const frameInSequence = frame - featureFrames[index].start;
				const progress = spring({
					frame: frameInSequence,
					fps,
					from: 0,
					to: 1,
					durationInFrames: 30,
				});
				
				return (
					<Sequence
						key={index}
						from={featureFrames[index].start}
						durationInFrames={featureFrames[index].duration}
					>
						<AbsoluteFill style={{
							padding: '60px',
						}}>
							{/* Feature Header */}
							<div style={{
								position: 'absolute',
								top: 60,
								left: 60,
								right: 60,
								zIndex: 10,
							}}>
								<Transition type="slide" duration={20} direction="in" from="left">
									<div style={{
										display: 'flex',
										alignItems: 'center',
										gap: '30px',
										background: 'linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.5))',
										padding: '30px',
										borderRadius: '16px',
										backdropFilter: 'blur(20px)',
									}}>
										{feature.icon && (
											<div style={{
												fontSize: 60,
												width: 80,
												height: 80,
												display: 'flex',
												alignItems: 'center',
												justifyContent: 'center',
												background: brandColor,
												borderRadius: '16px',
											}}>
												{feature.icon}
											</div>
										)}
										<div style={{flex: 1}}>
											<h2 style={{
												fontSize: 42,
												color: '#ffffff',
												margin: 0,
												fontWeight: 700,
											}}>
												{feature.title}
											</h2>
											<p style={{
												fontSize: 22,
												color: '#cbd5e1',
												marginTop: 8,
												margin: 0,
											}}>
												{feature.description}
											</p>
										</div>
									</div>
								</Transition>
							</div>
							
							{/* Demo Content */}
							<div style={{
								position: 'absolute',
								top: 240,
								left: 60,
								right: 60,
								bottom: 60,
								display: 'flex',
								gap: '40px',
								alignItems: 'center',
							}}>
								{/* Demo Media */}
								{feature.demo && (
									<div style={{
										flex: 1.5,
										transform: `scale(${0.9 + progress * 0.1})`,
										opacity: progress,
									}}>
										<div style={{
											borderRadius: '20px',
											overflow: 'hidden',
											boxShadow: `0 20px 60px rgba(139, 92, 246, ${progress * 0.3})`,
											border: `2px solid ${brandColor}`,
										}}>
											{feature.demo.type === 'video' ? (
												<Video
													src={staticFile(feature.demo.src)}
													style={{
														width: '100%',
														height: '100%',
													}}
												/>
											) : (
												<Img
													src={staticFile(feature.demo.src)}
													style={{
														width: '100%',
														height: '100%',
														objectFit: 'cover',
													}}
												/>
											)}
										</div>
									</div>
								)}
								
								{/* Benefits List */}
								{feature.benefits && (
									<div style={{
										flex: 1,
										display: 'flex',
										flexDirection: 'column',
										gap: '20px',
									}}>
										<h3 style={{
											fontSize: 28,
											color: accentColor,
											marginBottom: 10,
											fontWeight: 600,
										}}>
											Key Benefits
										</h3>
										{feature.benefits.map((benefit, i) => {
											const benefitProgress = spring({
												frame: frameInSequence - 10 - i * 5,
												fps,
												from: 0,
												to: 1,
												durationInFrames: 20,
											});
											return (
												<div
													key={i}
													style={{
														display: 'flex',
														alignItems: 'center',
														gap: '15px',
														opacity: benefitProgress,
														transform: `translateX(${(1 - benefitProgress) * 30}px)`,
													}}
												>
													<div style={{
														width: 8,
														height: 8,
														borderRadius: '50%',
														background: brandColor,
														flexShrink: 0,
													}} />
													<p style={{
														fontSize: 20,
														color: '#ffffff',
														margin: 0,
														lineHeight: 1.5,
													}}>
														{benefit}
													</p>
												</div>
											);
										})}
									</div>
								)}
							</div>
						</AbsoluteFill>
					</Sequence>
				);
			})}
			
			{/* Call to Action */}
			{cta && (
				<Sequence
					from={currentFrame}
					durationInFrames={ctaDuration}
				>
					<AbsoluteFill style={{
						background: `linear-gradient(135deg, ${brandColor}, ${accentColor})`,
						justifyContent: 'center',
						alignItems: 'center',
						padding: '60px',
					}}>
						<Transition type="scale" duration={25} direction="in">
							<div style={{
								textAlign: 'center',
								maxWidth: '900px',
							}}>
								<h2 style={{
									fontSize: 64,
									color: '#ffffff',
									marginBottom: 30,
									fontWeight: 800,
									textShadow: '0 4px 20px rgba(0,0,0,0.3)',
								}}>
									{cta.headline}
								</h2>
								
								{cta.benefits && (
									<div style={{
										display: 'flex',
										justifyContent: 'center',
										gap: '40px',
										marginBottom: 50,
									}}>
										{cta.benefits.map((benefit, i) => (
											<div
												key={i}
												style={{
													fontSize: 22,
													color: '#ffffff',
													opacity: 0.95,
												}}
											>
												✓ {benefit}
											</div>
										))}
									</div>
								)}
								
								<div style={{
									display: 'inline-block',
									padding: '20px 60px',
									background: '#ffffff',
									borderRadius: '50px',
									fontSize: 28,
									fontWeight: 700,
									color: brandColor,
									boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
									transform: `scale(${spring({
										frame: frame - currentFrame - 20,
										fps,
										from: 0.8,
										to: 1,
										durationInFrames: 30,
									})})`,
								}}>
									{cta.action}
								</div>
								
								{cta.url && (
									<p style={{
										fontSize: 20,
										color: '#ffffff',
										marginTop: 30,
										opacity: 0.9,
									}}>
										{cta.url}
									</p>
								)}
							</div>
						</Transition>
					</AbsoluteFill>
				</Sequence>
			)}
		</AbsoluteFill>
	);
};