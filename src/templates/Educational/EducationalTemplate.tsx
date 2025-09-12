import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig, staticFile, Video, Img} from 'remotion';
import {Title} from '../shared/components/Title';
import {Background} from '../shared/components/Background';
import {Transition} from '../shared/components/Transition';

export interface EducationalTemplateProps {
	// Content
	title: string;
	subtitle?: string;
	sections: Array<{
		title: string;
		content: string;
		media?: {
			type: 'video' | 'image';
			src: string;
		};
		duration: number;
	}>;
	
	// Styling
	primaryColor?: string;
	backgroundColor?: string[];
	fontFamily?: string;
	
	// Conclusion
	conclusion?: {
		title: string;
		points: string[];
	};
}

export const EducationalTemplate: React.FC<EducationalTemplateProps> = ({
	title,
	subtitle,
	sections,
	primaryColor = '#4299e1',
	backgroundColor = ['#1a365d', '#2c5282'],
	fontFamily = 'Inter, sans-serif',
	conclusion,
}) => {
	const {fps} = useVideoConfig();
	
	// Calculate frame positions
	let currentFrame = 0;
	const titleDuration = fps * 3; // 3 seconds for title
	const conclusionDuration = conclusion ? fps * 4 : 0; // 4 seconds for conclusion
	
	const sectionFrames = sections.map(section => {
		const start = currentFrame + titleDuration;
		currentFrame = start + section.duration;
		return {start, duration: section.duration};
	});

	return (
		<AbsoluteFill>
			<Background type="gradient" colors={backgroundColor} />
			
			{/* Title Sequence */}
			<Sequence from={0} durationInFrames={titleDuration}>
				<Transition type="scale" duration={20} direction="in">
					<AbsoluteFill style={{
						justifyContent: 'center',
						alignItems: 'center',
					}}>
						<Title
							title={title}
							subtitle={subtitle}
							color="#ffffff"
							fontSize={80}
							fontFamily={fontFamily}
						/>
					</AbsoluteFill>
				</Transition>
			</Sequence>
			
			{/* Educational Sections */}
			{sections.map((section, index) => (
				<Sequence
					key={index}
					from={sectionFrames[index].start}
					durationInFrames={sectionFrames[index].duration}
				>
					<Transition type="slide" duration={15} direction="in" from="right">
						<AbsoluteFill style={{
							padding: '60px',
							display: 'flex',
							flexDirection: 'column',
							justifyContent: 'center',
						}}>
							{/* Section Title */}
							<div style={{
								marginBottom: '40px',
							}}>
								<h2 style={{
									fontSize: 48,
									color: primaryColor,
									margin: 0,
									fontFamily,
									fontWeight: 700,
									textShadow: '0 2px 10px rgba(0,0,0,0.3)',
								}}>
									{section.title}
								</h2>
							</div>
							
							{/* Content Layout */}
							<div style={{
								display: 'flex',
								gap: '40px',
								alignItems: 'center',
							}}>
								{/* Text Content */}
								<div style={{
									flex: section.media ? 1 : 1,
									maxWidth: section.media ? '50%' : '100%',
								}}>
									<p style={{
										fontSize: 28,
										color: '#ffffff',
										lineHeight: 1.6,
										fontFamily,
										margin: 0,
										textShadow: '0 1px 3px rgba(0,0,0,0.3)',
									}}>
										{section.content}
									</p>
								</div>
								
								{/* Media Content */}
								{section.media && (
									<div style={{
										flex: 1,
										display: 'flex',
										justifyContent: 'center',
										alignItems: 'center',
									}}>
										{section.media.type === 'video' ? (
											<Video
												src={staticFile(section.media.src)}
												style={{
													width: '100%',
													maxWidth: '600px',
													borderRadius: '12px',
													boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
												}}
											/>
										) : (
											<Img
												src={staticFile(section.media.src)}
												style={{
													width: '100%',
													maxWidth: '600px',
													borderRadius: '12px',
													boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
												}}
											/>
										)}
									</div>
								)}
							</div>
						</AbsoluteFill>
					</Transition>
				</Sequence>
			))}
			
			{/* Conclusion */}
			{conclusion && (
				<Sequence
					from={currentFrame + titleDuration}
					durationInFrames={conclusionDuration}
				>
					<Transition type="fade" duration={20} direction="in">
						<AbsoluteFill style={{
							justifyContent: 'center',
							alignItems: 'center',
							padding: '60px',
							background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))',
						}}>
							<div style={{
								textAlign: 'center',
								maxWidth: '900px',
							}}>
								<h2 style={{
									fontSize: 56,
									color: primaryColor,
									marginBottom: '40px',
									fontFamily,
									fontWeight: 700,
								}}>
									{conclusion.title}
								</h2>
								<div style={{
									display: 'flex',
									flexDirection: 'column',
									gap: '20px',
								}}>
									{conclusion.points.map((point, i) => (
										<div
											key={i}
											style={{
												fontSize: 28,
												color: '#ffffff',
												padding: '15px 30px',
												background: `rgba(66, 153, 225, ${0.2 + i * 0.1})`,
												borderRadius: '8px',
												fontFamily,
											}}
										>
											✓ {point}
										</div>
									))}
								</div>
							</div>
						</AbsoluteFill>
					</Transition>
				</Sequence>
			)}
		</AbsoluteFill>
	);
};