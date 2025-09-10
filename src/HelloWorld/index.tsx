import {AbsoluteFill} from 'remotion';
import {Logo} from './Logo';
import {Subtitle} from './Subtitle';
import {Title} from './Title';
import {z} from 'zod';
import {FONT_FAMILY} from './constants';

export const myCompSchema = z.object({
	titleText: z.string(),
	titleColor: z.string(),
	logoColor1: z.string(),
	logoColor2: z.string(),
});

export const HelloWorld: React.FC<z.infer<typeof myCompSchema>> = ({
	titleText: propOne,
	titleColor: propTwo,
	logoColor1,
	logoColor2,
}) => {
	return (
		<AbsoluteFill style={{backgroundColor: 'white'}}>
			<AbsoluteFill>
				<Logo logoColor1={logoColor1} logoColor2={logoColor2} />
			</AbsoluteFill>
			<AbsoluteFill
				style={{
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				<div>
					<Title titleText={propOne} titleColor={propTwo} />
					<Subtitle />
				</div>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};