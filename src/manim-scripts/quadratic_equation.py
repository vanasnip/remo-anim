from manim import *
import numpy as np


class QuadraticEquation(Scene):
    """Visualizes the quadratic equation and its roots"""
    
    def construct(self):
        # Create axes
        axes = Axes(
            x_range=[-5, 5, 1],
            y_range=[-10, 10, 2],
            axis_config={"color": BLUE},
            tips=False,
        )
        axes_labels = axes.get_axis_labels(x_label="x", y_label="y")
        
        # Quadratic function: y = x^2 - 2x - 3
        def quad_func(x):
            return x**2 - 2*x - 3
        
        # Create the parabola
        parabola = axes.plot(quad_func, color=YELLOW, x_range=[-2, 4])
        
        # Formula text
        formula = MathTex("y = x^2 - 2x - 3").to_edge(UP)
        formula.set_color(YELLOW)
        
        # Factored form
        factored = MathTex("y = (x - 3)(x + 1)").next_to(formula, DOWN)
        factored.set_color(GREEN)
        
        # Mark the roots
        root1 = Dot(axes.coords_to_point(-1, 0), color=RED)
        root2 = Dot(axes.coords_to_point(3, 0), color=RED)
        root1_label = Text("x = -1", font_size=20).next_to(root1, DOWN)
        root2_label = Text("x = 3", font_size=20).next_to(root2, DOWN)
        
        # Mark the vertex
        vertex = Dot(axes.coords_to_point(1, -4), color=GREEN)
        vertex_label = Text("Vertex (1, -4)", font_size=20).next_to(vertex, DOWN)
        
        # Animate
        self.play(Create(axes), Write(axes_labels))
        self.play(Write(formula))
        self.wait(0.5)
        
        self.play(Create(parabola), run_time=2)
        self.wait(0.5)
        
        # Show roots
        self.play(
            Create(root1), 
            Create(root2),
            Write(root1_label),
            Write(root2_label)
        )
        self.wait(0.5)
        
        # Show factored form
        self.play(Write(factored))
        self.wait(0.5)
        
        # Show vertex
        self.play(
            Create(vertex),
            Write(vertex_label)
        )
        self.wait(1)
        
        # Fade out
        self.play(
            FadeOut(axes), FadeOut(axes_labels),
            FadeOut(parabola), FadeOut(formula),
            FadeOut(factored), FadeOut(root1),
            FadeOut(root2), FadeOut(root1_label),
            FadeOut(root2_label), FadeOut(vertex),
            FadeOut(vertex_label)
        )