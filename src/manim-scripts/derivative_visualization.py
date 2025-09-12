from manim import *
import numpy as np


class DerivativeVisualization(Scene):
    """Shows the concept of derivative as the slope of tangent line"""
    
    def construct(self):
        # Create axes
        axes = Axes(
            x_range=[-1, 5, 1],
            y_range=[-1, 9, 1],
            axis_config={"color": BLUE},
            tips=False,
        )
        axes_labels = axes.get_axis_labels(x_label="x", y_label="f(x)")
        
        # Function: f(x) = x^2
        def func(x):
            return x**2
        
        # Derivative: f'(x) = 2x
        def derivative(x):
            return 2*x
        
        # Plot the function
        graph = axes.plot(func, color=WHITE, x_range=[0, 3])
        graph_label = MathTex("f(x) = x^2").next_to(graph, UR).set_color(WHITE)
        
        # Moving point on the curve
        x_tracker = ValueTracker(0.5)
        
        def get_tangent_line():
            x = x_tracker.get_value()
            slope = derivative(x)
            # Create tangent line at point (x, f(x))
            tangent = axes.plot(
                lambda t: slope * (t - x) + func(x),
                color=YELLOW,
                x_range=[max(-1, x-1), min(5, x+1)]
            )
            return tangent
        
        def get_point():
            x = x_tracker.get_value()
            return Dot(axes.coords_to_point(x, func(x)), color=RED)
        
        def get_slope_text():
            x = x_tracker.get_value()
            slope = derivative(x)
            return MathTex(f"f'({x:.1f}) = {slope:.1f}").to_edge(UP).set_color(YELLOW)
        
        # Initial tangent line and point
        tangent_line = always_redraw(get_tangent_line)
        moving_point = always_redraw(get_point)
        slope_text = always_redraw(get_slope_text)
        
        # Title
        title = Text("Derivative as Slope of Tangent", font_size=30).to_edge(UP).shift(UP*0.5)
        
        # Animate
        self.play(Write(title))
        self.play(Create(axes), Write(axes_labels))
        self.play(Create(graph), Write(graph_label))
        self.wait(0.5)
        
        # Add tangent line and point
        self.play(
            Create(tangent_line),
            Create(moving_point),
            Write(slope_text)
        )
        self.wait(0.5)
        
        # Move the point along the curve
        self.play(x_tracker.animate.set_value(2.5), run_time=4)
        self.wait(0.5)
        self.play(x_tracker.animate.set_value(0.5), run_time=3)
        self.wait(0.5)
        self.play(x_tracker.animate.set_value(1.5), run_time=2)
        self.wait(1)
        
        # Fade out
        self.play(
            FadeOut(axes), FadeOut(axes_labels),
            FadeOut(graph), FadeOut(graph_label),
            FadeOut(tangent_line), FadeOut(moving_point),
            FadeOut(slope_text), FadeOut(title)
        )