import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig, useCurrentFrame, interpolate, staticFile, Video} from 'remotion';
import {Title} from '../shared/components/Title';
import {Background} from '../shared/components/Background';
import {Transition} from '../shared/components/Transition';

export interface TutorialStep {
	stepNumber: number;
	title: string;
	description: string;
	code?: {
		language: string;
		snippet: string;
	};
	screenRecording?: string;
	highlightAreas?: Array<{
		x: number;
		y: number;
		width: number;
		height: number;
	}>;
	duration: number;
}

export interface TutorialTemplateProps {
	// Tutorial Info
	title: string;
	subtitle?: string;
	instructor?: string;
	
	// Steps
	steps: TutorialStep[];
	
	// Styling
	primaryColor?: string;
	accentColor?: string;
	backgroundColor?: string[];
	codeTheme?: 'dark' | 'light';
	
	// Summary
	summary?: {
		title: string;
		keyTakeaways: string[];
		nextSteps?: string[];
	};
}

export const TutorialTemplate: React.FC<TutorialTemplateProps> = ({
	title,
	subtitle,
	instructor,
	steps,
	primaryColor = '#10b981',
	accentColor = '#f59e0b',
	backgroundColor = ['#064e3b', '#065f46'],
	codeTheme = 'dark',
	summary,
}) => {
	const {fps} = useVideoConfig();
	const frame = useCurrentFrame();
	
	// Calculate frame positions
	const introDuration = fps * 3;
	const summaryDuration = summary ? fps * 5 : 0;
	
	let currentFrame = introDuration;
	const stepFrames = steps.map(step => {
		const start = currentFrame;
		currentFrame += step.duration;
		return {start, duration: step.duration};
	});

	// Code syntax highlighting colors
	const codeColors = codeTheme === 'dark' ? {
		background: '#1e293b',
		text: '#e2e8f0',
		keyword: '#f472b6',
		string: '#a5f3fc',
		comment: '#64748b',
		number: '#fbbf24',
	} : {
		background: '#f8fafc',
		text: '#1e293b',
		keyword: '#ec4899',
		string: '#0891b2',
		comment: '#94a3b8',
		number: '#f59e0b',
	};

	return (
		<AbsoluteFill>
			<Background type="gradient" colors={backgroundColor} animated />
			
			{/* Intro */}
			<Sequence from={0} durationInFrames={introDuration}>
				<Transition type="scale" duration={20} direction="in">
					<AbsoluteFill style={{
						justifyContent: 'center',
						alignItems: 'center',
						padding: '60px',
					}}>
						<div style={{textAlign: 'center'}}>
							<Title
								title={title}
								subtitle={subtitle}
								color="#ffffff"
								fontSize={72}
							/>
							{instructor && (
								<p style={{
									fontSize: 24,
									color: accentColor,
									marginTop: 40,
									fontWeight: 500,
								}}>
									Instructor: {instructor}
								</p>
							)}
						</div>
					</AbsoluteFill>
				</Transition>
			</Sequence>
			
			{/* Tutorial Steps */}
			{steps.map((step, index) => (
				<Sequence
					key={index}
					from={stepFrames[index].start}
					durationInFrames={stepFrames[index].duration}
				>
					<AbsoluteFill>
						{/* Step Header */}
						<div style={{
							position: 'absolute',
							top: 40,
							left: 40,
							right: 40,
							zIndex: 10,
						}}>
							<Transition type="slide" duration={15} direction="in" from="top">
								<div style={{
									background: 'rgba(0,0,0,0.8)',
									borderRadius: '12px',
									padding: '20px 30px',
									backdropFilter: 'blur(10px)',
								}}>
									<div style={{
										display: 'flex',
										alignItems: 'center',
										gap: '20px',
									}}>
										<div style={{
											width: 50,
											height: 50,
											borderRadius: '50%',
											background: primaryColor,
											display: 'flex',
											alignItems: 'center',
											justifyContent: 'center',
											fontSize: 24,
											fontWeight: 700,
											color: '#ffffff',
										}}>
											{step.stepNumber}
										</div>
										<div style={{flex: 1}}>
											<h3 style={{
												fontSize: 32,
												color: '#ffffff',
												margin: 0,
												fontWeight: 600,
											}}>
												{step.title}
											</h3>
											<p style={{
												fontSize: 18,
												color: '#cbd5e1',
												margin: '5px 0 0 0',
											}}>
												{step.description}
											</p>
										</div>
									</div>
								</div>
							</Transition>
						</div>
						
						{/* Main Content Area */}
						<div style={{
							position: 'absolute',
							top: 180,
							left: 40,
							right: 40,
							bottom: 40,
							display: 'flex',
							gap: '30px',
						}}>
							{/* Code Panel */}
							{step.code && (
								<Transition type="slide" duration={20} direction="in" from="left">
									<div style={{
										flex: 1,
										background: codeColors.background,
										borderRadius: '12px',
										padding: '30px',
										boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
										overflow: 'auto',
									}}>
										<div style={{
											fontSize: 14,
											color: codeColors.comment,
											marginBottom: 10,
											fontFamily: 'monospace',
										}}>
											{step.code.language}
										</div>
										<pre style={{
											margin: 0,
											fontFamily: 'Fira Code, monospace',
											fontSize: 18,
											lineHeight: 1.6,
											color: codeColors.text,
										}}>
											<code>{step.code.snippet}</code>
										</pre>
									</div>
								</Transition>
							)}
							
							{/* Screen Recording */}
							{step.screenRecording && (
								<Transition type="fade" duration={20} direction="in">
									<div style={{
										flex: 1,
										position: 'relative',
										borderRadius: '12px',
										overflow: 'hidden',
										boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
									}}>
										<Video
											src={staticFile(step.screenRecording)}
											style={{
												width: '100%',
												height: '100%',
												objectFit: 'cover',
											}}
										/>
										
										{/* Highlight Areas */}
										{step.highlightAreas?.map((area, i) => {
											const pulse = interpolate(
												frame % 60,
												[0, 30, 60],
												[1, 1.2, 1],
											);
											return (
												<div
													key={i}
													style={{
														position: 'absolute',
														left: area.x,
														top: area.y,
														width: area.width,
														height: area.height,
														border: `3px solid ${accentColor}`,
														borderRadius: '8px',
														transform: `scale(${pulse})`,
														transformOrigin: 'center',
														pointerEvents: 'none',
													}}
												/>
											);
										})}
									</div>
								</Transition>
							)}
						</div>
					</AbsoluteFill>
				</Sequence>
			))}
			
			{/* Summary */}
			{summary && (
				<Sequence
					from={currentFrame}
					durationInFrames={summaryDuration}
				>
					<Transition type="fade" duration={20} direction="in">
						<AbsoluteFill style={{
							background: 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(0,0,0,0.7))',
							padding: '60px',
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
						}}>
							<div style={{
								maxWidth: '1000px',
								width: '100%',
							}}>
								<h2 style={{
									fontSize: 56,
									color: primaryColor,
									marginBottom: 40,
									textAlign: 'center',
									fontWeight: 700,
								}}>
									{summary.title}
								</h2>
								
								<div style={{
									display: 'grid',
									gridTemplateColumns: summary.nextSteps ? '1fr 1fr' : '1fr',
									gap: '40px',
								}}>
									{/* Key Takeaways */}
									<div>
										<h3 style={{
											fontSize: 28,
											color: accentColor,
											marginBottom: 20,
										}}>
											Key Takeaways
										</h3>
										{summary.keyTakeaways.map((takeaway, i) => (
											<div
												key={i}
												style={{
													fontSize: 20,
													color: '#ffffff',
													padding: '12px 0',
													borderLeft: `3px solid ${primaryColor}`,
													paddingLeft: 20,
													marginBottom: 10,
												}}
											>
												{takeaway}
											</div>
										))}
									</div>
									
									{/* Next Steps */}
									{summary.nextSteps && (
										<div>
											<h3 style={{
												fontSize: 28,
												color: accentColor,
												marginBottom: 20,
											}}>
												Next Steps
											</h3>
											{summary.nextSteps.map((step, i) => (
												<div
													key={i}
													style={{
														fontSize: 20,
														color: '#ffffff',
														padding: '12px 0',
														borderLeft: `3px solid ${accentColor}`,
														paddingLeft: 20,
														marginBottom: 10,
													}}
												>
													→ {step}
												</div>
											))}
										</div>
									)}
								</div>
							</div>
						</AbsoluteFill>
					</Transition>
				</Sequence>
			)}
		</AbsoluteFill>
	);
};