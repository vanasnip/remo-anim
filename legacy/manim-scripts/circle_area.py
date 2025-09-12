from manim import *


class CircleAreaDemo(Scene):
    def construct(self):
        # Create a circle
        circle = Circle(radius=2, color=BLUE, fill_opacity=0.3)

        # Create radius line
        radius = Line(ORIGIN, circle.point_at_angle(0), color=YELLOW, stroke_width=6)
        radius_label = Text("r = 2", font_size=24).next_to(radius, DOWN)

        # Create area formula
        formula = Text("A = πr²", font_size=36).to_edge(UP)
        calculation = Text("A = π × 2² = 4π ≈ 12.57", font_size=28).next_to(formula, DOWN)

        # Animate the demonstration
        self.play(Create(circle))
        self.play(Create(radius), Write(radius_label))
        self.wait(0.5)

        # Show formula
        self.play(Write(formula))
        self.wait(0.5)

        # Animate circle filling to show area
        self.play(circle.animate.set_fill(BLUE, opacity=0.7))
        self.play(Write(calculation))

        # Rotate to show it's a circle
        self.play(Rotate(VGroup(circle, radius, radius_label), angle=2 * PI, run_time=3))

        self.wait(1)
        self.play(FadeOut(VGroup(circle, radius, radius_label, formula, calculation)))
