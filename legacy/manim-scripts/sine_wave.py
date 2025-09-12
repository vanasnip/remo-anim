import numpy as np
from manim import *


class SineWaveAnimation(Scene):
    def construct(self):
        # Create axes
        axes = Axes(
            x_range=[-3, 3, 1],
            y_range=[-2, 2, 1],
            axis_config={"color": BLUE},
        )

        # Create sine wave
        sine_curve = axes.plot(lambda x: np.sin(2 * x), color=YELLOW)
        sine_label = Text("sin(2x)", font_size=24).next_to(axes, UP).set_color(YELLOW)

        # Create cosine wave
        cosine_curve = axes.plot(lambda x: np.cos(2 * x), color=GREEN)
        cosine_label = Text("cos(2x)", font_size=24).next_to(axes, UP).set_color(GREEN)

        # Animate
        self.play(Create(axes), run_time=1)
        self.play(Create(sine_curve), Write(sine_label))
        self.wait(0.5)
        self.play(Transform(sine_curve, cosine_curve), Transform(sine_label, cosine_label))
        self.wait(1)
        self.play(FadeOut(axes), FadeOut(sine_curve), FadeOut(sine_label))
