from manim import *


class TestAnimation(Scene):
    def construct(self):
        # Create a circle that transforms into a square
        circle = Circle(color=BLUE)
        square = Square(color=RED)

        # Add text
        text = Text("Manim + Remotion", font_size=36)
        text.next_to(circle, DOWN, buff=1)

        # Animate the transformation
        self.play(Create(circle))
        self.play(Write(text))
        self.wait(1)
        self.play(Transform(circle, square))
        self.wait(1)
        self.play(FadeOut(circle), FadeOut(text))
