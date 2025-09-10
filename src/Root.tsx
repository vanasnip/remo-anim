import {Composition} from 'remotion';
import {HelloWorld, myCompSchema} from './HelloWorld';
import {Logo, myCompSchema2} from './HelloWorld/Logo';
import {ProductPromo} from './compositions/ProductPromo';
import {MathLesson} from './compositions/MathLesson';
import {TransitionShowcase} from './compositions/TransitionShowcase';
import {z} from 'zod';

// Each <Composition> is an entry in the sidebar!

export const RemotionRoot: React.FC = () => {
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
		</>
	);
};