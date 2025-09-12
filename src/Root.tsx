import {Composition} from 'remotion';
import {HelloWorld, myCompSchema} from './HelloWorld';
import {Logo, myCompSchema2} from './HelloWorld/Logo';
import {ProductPromo} from './compositions/ProductPromo';
import {MathLesson} from './compositions/MathLesson';
import {TransitionShowcase} from './compositions/TransitionShowcase';
import {ContentAugmentation} from './Augmented/ContentAugmentation';
import {ContentAugmentationAdvanced} from './Augmented/ContentAugmentationAdvanced';
import {ContentAugmentationInteractive} from './Augmented/ContentAugmentationInteractive';
import {exampleAnnotations, advancedAnnotations} from './Augmented/ContentAugmentationExample';
import {VideoEffects} from './compositions/Effects/VideoEffects';
import {TutorialVideo} from './compositions/Instructional/TutorialVideo';
import {PythonManimTutorial, ReactComponentTutorial} from './compositions/Instructional/PythonTutorial';
import {PythonManimTutorial as AdvancedPythonTutorial} from './compositions/Instructional/PythonManimTutorial';
import {ReactComponentTutorial as ModernReactTutorial} from './compositions/Instructional/ReactComponentTutorial';
import {AudioTriggeredContent, RhythmVisualization, EmojiRhythm} from './compositions/AudioSync';
import {ManimShowcase} from './compositions/ManimShowcase';
import {z} from 'zod';
import React, {useEffect} from 'react';
import performanceConfig from './config/performance.config';
import AggressiveOptimizations from './utils/performance/aggressive-optimizations';

// Import Templates
import {
	EducationalTemplate,
	TutorialTemplate,
	ProductDemoTemplate,
	AnimationShowcaseTemplate,
} from './templates';

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
	// Initialize aggressive optimizations
	useEffect(() => {
		if (typeof window !== 'undefined') {
			// Log performance configuration
			console.log('🚀 Remotion Performance Mode:', performanceConfig.mode);
			console.log('⚡ Active Optimizations:', performanceConfig.getActiveOptimizations());
			
			// Get optimization stats after initialization
			const optimizer = AggressiveOptimizations.getInstance();
			setTimeout(() => {
				console.log('📊 Optimization Stats:', optimizer.getStats());
			}, 1000);
		}
	}, []);
	return (
		<>
			<Composition
				// You can take the "id" to render a video:
				// npx remotion render HelloWorld
				id="HelloWorld"
				component={HelloWorld}
				durationInFrames={150}
				fps={30}
				width={1920}
				height={1080}
				// You can override these props for each render:
				// https://www.remotion.dev/docs/parametrized-rendering
				schema={myCompSchema}
				defaultProps={{
					titleText: 'Welcome to Remotion',
					titleColor: '#000000',
					logoColor1: '#91EAE4',
					logoColor2: '#86A8E7',
				}}
			/>
			{/* Mount any React component to make it show up in the sidebar and work on it individually! */}
			<Composition
				id="OnlyLogo"
				component={Logo}
				durationInFrames={150}
				fps={30}
				width={1920}
				height={1080}
				schema={myCompSchema2}
				defaultProps={{
					logoColor1: '#91dAE2' as const,
					logoColor2: '#86A8E7' as const,
				}}
			/>
			{/* Product Promo - 30 seconds */}
			<Composition
				id="ProductPromo"
				component={ProductPromo}
				durationInFrames={900} // 30 seconds at 30fps
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({
					productName: z.string(),
					features: z.array(z.string()),
					brandColors: z.object({
						primary: z.string().optional(),
						secondary: z.string().optional(),
					}).optional(),
					tagline: z.string().optional(),
					manimVideo: z.string().optional(),
				})}
				defaultProps={{
					productName: "Remotion + Manim",
					features: [
						"Mathematical Animations",
						"React Components",
						"Production Ready",
					],
					brandColors: {
						primary: "#1976d2",
						secondary: "#42a5f5",
					},
					tagline: "Create stunning videos with code",
					manimVideo: "/assets/manim/SineWaveAnimation_480p15_20250902_220341.mp4",
				}}
			/>
			{/* Math Lesson - Educational */}
			<Composition
				id="MathLesson"
				component={MathLesson}
				durationInFrames={540} // 18 seconds (3s intro + 15s chapter)
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({
					title: z.string(),
					subtitle: z.string().optional(),
					chapters: z.array(z.object({
						title: z.string(),
						description: z.string(),
						manimVideo: z.string().optional(),
						keyPoints: z.array(z.string()),
						duration: z.number(),
					})),
					instructor: z.string().optional(),
				})}
				defaultProps={{
					title: "Understanding Trigonometry",
					subtitle: "Mathematical Animations with Manim",
					chapters: [{
						title: "Sine and Cosine Functions",
						description: "Exploring periodic functions and their transformations",
						manimVideo: "/assets/manim/SineWaveAnimation_480p15_20250902_220341.mp4",
						keyPoints: [
							"Sine waves are periodic functions",
							"They oscillate between -1 and 1",
							"Period is 2π radians",
						],
						duration: 450, // 15 seconds
					}],
					instructor: "Remotion + Manim",
				}}
			/>
			{/* Transition Showcase - Effects Demo */}
			<Composition
				id="TransitionShowcase"
				component={TransitionShowcase}
				durationInFrames={540} // 18 seconds (6 transitions x 3 seconds)
				fps={30}
				width={1920}
				height={1080}
			/>
			{/* Basic ContentAugmentation */}
			<Composition
				id="ContentAugmentation-Basic"
				component={() => (
					<ContentAugmentation
						sourceVideo="/assets/manim/TestAnimation.mp4"
						annotations={exampleAnnotations}
						showTimeline={true}
						enableZoomEffects={true}
					/>
				)}
				durationInFrames={900} // 30 seconds
				fps={30}
				width={1920}
				height={1080}
			/>
			{/* Advanced ContentAugmentation with FFmpeg effects */}
			<Composition
				id="ContentAugmentation-Advanced"
				component={() => (
					<ContentAugmentationAdvanced
						sourceVideo="/assets/manim/TestAnimation.mp4"
						annotations={advancedAnnotations}
						showTimeline={true}
						enableZoomEffects={true}
						globalVideoFilters={{
							brightness: -0.05,
							contrast: 1.1,
							saturation: 1.05,
							gamma: 0.95,
						}}
						transitionEffect={{
							type: "fade",
							duration: 30,
							easing: "ease-in-out",
						}}
						enableRealTimeProcessing={true}
					/>
				)}
				durationInFrames={900} // 30 seconds
				fps={30}
				width={1920}
				height={1080}
			/>
			{/* Interactive ContentAugmentation */}
			<Composition
				id="ContentAugmentation-Interactive"
				component={() => (
					<ContentAugmentationInteractive
						sourceVideo="/assets/manim/TestAnimation.mp4"
						annotations={exampleAnnotations}
						showTimeline={true}
						enableZoomEffects={true}
						timelineHeight={100}
						showAnnotationLabels={true}
						showFrameNumbers={true}
						enableInteractiveTimeline={true}
						showAnnotationPreview={true}
					/>
				)}
				durationInFrames={900} // 30 seconds
				fps={30}
				width={1920}
				height={1080}
			/>
			{/* Video Effects - 8 different visual effects showcase */}
			<Composition
				id="VideoEffects"
				component={VideoEffects}
				durationInFrames={540} // 18 seconds for 6 effects (90 frames each)
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({
					sourceVideo: z.string().optional(),
					effects: z.array(z.object({
						type: z.enum(["blur", "pixelate", "chromatic", "vhs", "neon", "matrix", "split", "kaleidoscope"]),
						intensity: z.number().min(0).max(1),
						startFrame: z.number(),
						endFrame: z.number(),
					})).optional(),
					showEffectName: z.boolean().optional(),
				})}
				defaultProps={{
					sourceVideo: "/assets/manim/CircleAreaDemo_480p15_20250902_222354.mp4",
					effects: [
						{ type: "blur" as const, intensity: 0.5, startFrame: 0, endFrame: 90 },
						{ type: "chromatic" as const, intensity: 0.7, startFrame: 90, endFrame: 180 },
						{ type: "vhs" as const, intensity: 0.8, startFrame: 180, endFrame: 270 },
						{ type: "neon" as const, intensity: 0.6, startFrame: 270, endFrame: 360 },
						{ type: "matrix" as const, intensity: 0.9, startFrame: 360, endFrame: 450 },
						{ type: "split" as const, intensity: 0.5, startFrame: 450, endFrame: 540 },
					],
					showEffectName: true,
				}}
			/>
			{/* Tutorial Components - Instructional Video Templates */}
			<Composition
				id="PythonManimTutorial-Basic"
				component={PythonManimTutorial}
				durationInFrames={2130} // ~71 seconds for all tutorial steps
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ReactComponentTutorial-Basic"
				component={ReactComponentTutorial}
				durationInFrames={1140} // ~38 seconds for all tutorial steps
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="PythonManimTutorial-Advanced"
				component={AdvancedPythonTutorial}
				durationInFrames={1260} // ~42 seconds for all tutorial steps
				fps={30}
				width={1920}
				height={1080}
			/>
			<Composition
				id="ReactComponentTutorial-Modern"
				component={ModernReactTutorial}
				durationInFrames={1350} // ~45 seconds for all tutorial sections
				fps={30}
				width={1920}
				height={1080}
			/>
			{/* Custom Tutorial Video Template - Use for creating custom tutorials */}
			<Composition
				id="TutorialVideo-Template"
				component={() => (
					<TutorialVideo
						title="Custom Tutorial Title"
						subtitle="Learn something amazing"
						author="Tutorial Creator"
						steps={[
							{
								title: "Getting Started",
								description: "Welcome to this tutorial. We'll learn something awesome together.",
								duration: 180, // 6 seconds
								codeSnippet: {
									language: "javascript",
									code: `console.log("Hello, world!");
// Your first line of code
const greeting = "Welcome to coding!";`,
									filename: "hello.js",
									highlights: [1, 3],
								},
								tipText: "This is just the beginning of your coding journey",
							},
							{
								title: "Next Steps",
								description: "Now that you're familiar with the basics, let's explore more advanced concepts.",
								duration: 240, // 8 seconds
								terminalOutput: `$ node hello.js
Hello, world!
Welcome to coding!`,
								keyboardShortcut: "Ctrl+Enter to run code",
							},
						]}
						theme={{
							primaryColor: "#2196f3",
							secondaryColor: "#64b5f6",
							codeTheme: "dark",
						}}
					/>
				)}
				durationInFrames={420} // 14 seconds total
				fps={30}
				width={1920}
				height={1080}
			/>
			{/* AudioSync compositions - Pure visual beat demonstrations */}
			<Composition
				id="AudioTriggeredContent-Basic"
				component={() => (
					<AudioTriggeredContent 
						audioStartFrame={0}
					/>
				)}
				durationInFrames={1800} // 60 seconds for full visual experience
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({
					audioStartFrame: z.number().optional(),
				})}
				defaultProps={{
					audioStartFrame: 0,
				}}
			/>
			<Composition
				id="RhythmVisualization-Full"
				component={() => (
					<RhythmVisualization />
				)}
				durationInFrames={1800} // 60 seconds for full rhythm visualization
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({})}
				defaultProps={{}}
			/>
			<Composition
				id="EmojiRhythm-Fun"
				component={() => (
					<EmojiRhythm />
				)}
				durationInFrames={900} // 30 seconds for emoji rhythm demo
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({})}
				defaultProps={{}}
			/>
			{/* Manim Animation Gallery - Browse and integrate Manim videos */}
			<Composition
				id="ManimShowcase-Gallery"
				component={() => (
					<ManimShowcase
						columns={3}
						showSearch={true}
						showFilters={true}
						autoplay={false}
					/>
				)}
				durationInFrames={1800} // 60 seconds for gallery exploration
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({
					columns: z.number().min(1).max(6).optional(),
					showSearch: z.boolean().optional(),
					showFilters: z.boolean().optional(),
					autoplay: z.boolean().optional(),
					defaultCategory: z.enum(['geometry', 'algebra', 'calculus', 'trigonometry', 'physics', 'general']).optional(),
				})}
				defaultProps={{
					columns: 3,
					showSearch: true,
					showFilters: true,
					autoplay: false,
				}}
			/>
			{/* Manim Showcase - Geometry Focus */}
			<Composition
				id="ManimShowcase-Geometry"
				component={() => (
					<ManimShowcase
						columns={2}
						defaultCategory="geometry" as any
						showSearch={false}
						showFilters={false}
					/>
				)}
				durationInFrames={900} // 30 seconds for focused geometry showcase
				fps={30}
				width={1920}
				height={1080}
				schema={z.object({
					columns: z.number().min(1).max(6).optional(),
					showSearch: z.boolean().optional(),
					showFilters: z.boolean().optional(),
					defaultCategory: z.enum(['geometry', 'algebra', 'calculus', 'trigonometry', 'physics', 'general']).optional(),
				})}
				defaultProps={{
					columns: 2,
					showSearch: false,
					showFilters: false,
					defaultCategory: "geometry" as any,
				}}
			/>
			
			{/* === COMPOSITION TEMPLATES === */}
			
			{/* Educational Content Template */}
			<Composition
				id="Template-Educational"
				component={EducationalTemplate}
				durationInFrames={600}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{
					title: "Introduction to Calculus",
					subtitle: "Understanding Derivatives",
					sections: [
						{
							title: "What is a Derivative?",
							content: "A derivative represents the rate of change of a function. It tells us how fast something is changing at any given point.",
							duration: 150,
						},
						{
							title: "The Power Rule",
							content: "For f(x) = x^n, the derivative is f'(x) = n*x^(n-1). This is one of the most fundamental rules in calculus.",
							duration: 150,
						},
					],
					conclusion: {
						title: "Key Takeaways",
						points: [
							"Derivatives measure rate of change",
							"The power rule simplifies differentiation",
							"Applications in physics and optimization",
						],
					},
				}}
			/>
			
			{/* Tutorial Video Template */}
			<Composition
				id="Template-Tutorial"
				component={TutorialTemplate}
				durationInFrames={900}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{
					title: "React Hooks Tutorial",
					subtitle: "Master useState and useEffect",
					instructor: "John Doe",
					steps: [
						{
							stepNumber: 1,
							title: "Understanding useState",
							description: "Learn how to manage component state",
							code: {
								language: "javascript",
								snippet: "const [count, setCount] = useState(0);",
							},
							duration: 180,
						},
						{
							stepNumber: 2,
							title: "Working with useEffect",
							description: "Handle side effects in functional components",
							code: {
								language: "javascript",
								snippet: "useEffect(() => {\n  // Side effect code\n}, [dependencies]);",
							},
							duration: 180,
						},
					],
					summary: {
						title: "Summary",
						keyTakeaways: [
							"useState manages local state",
							"useEffect handles side effects",
							"Dependencies control re-renders",
						],
						nextSteps: [
							"Explore useContext",
							"Learn custom hooks",
						],
					},
				}}
			/>
			
			{/* Product Demo Template */}
			<Composition
				id="Template-ProductDemo"
				component={ProductDemoTemplate}
				durationInFrames={750}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{
					productName: "VideoMaker Pro",
					tagline: "Create Stunning Videos in Minutes",
					features: [
						{
							icon: "🎬",
							title: "Easy Video Editing",
							description: "Intuitive drag-and-drop interface",
							benefits: [
								"No learning curve",
								"Professional results",
								"Save hours of work",
							],
							duration: 180,
						},
						{
							icon: "✨",
							title: "AI-Powered Effects",
							description: "Automatic enhancement and filters",
							benefits: [
								"One-click improvements",
								"Smart color grading",
								"Background removal",
							],
							duration: 180,
						},
					],
					cta: {
						headline: "Start Creating Today",
						action: "Get Started Free",
						benefits: ["No credit card", "Unlimited exports", "Premium support"],
					},
				}}
			/>
			
			{/* Animation Showcase Template */}
			<Composition
				id="Template-AnimationShowcase"
				component={AnimationShowcaseTemplate}
				durationInFrames={600}
				fps={30}
				width={1920}
				height={1080}
				defaultProps={{
					title: "Animation Gallery",
					subtitle: "Our Best Work",
					animations: [
						{
							id: "anim1",
							title: "Circle Area Demo",
							category: "Mathematics",
							video: "assets/manim/CircleAreaDemo.mp4",
							duration: 180,
						},
						{
							id: "anim2",
							title: "Sine Wave",
							category: "Trigonometry",
							video: "assets/manim/SineWaveAnimation.mp4",
							duration: 120,
						},
					],
					layout: "single",
					showTitles: true,
					outro: {
						message: "Thanks for Watching",
						credits: ["Created with Remotion", "Powered by React"],
					},
				}}
			/>
		</>
	);
};