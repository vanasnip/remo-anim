#!/usr/bin/env python3
"""
Simple Manim example for testing the bridge
"""

from manim import *

class SimpleExample(Scene):
    def construct(self):
        # Create a circle
        circle = Circle(radius=2, color=BLUE)
        
        # Create text
        text = Text("Hello from Manim!", font_size=48)
        text.next_to(circle, DOWN, buff=0.5)
        
        # Animate
        self.play(Create(circle))
        self.play(Write(text))
        self.wait(1)
        
        # Transform
        square = Square(side_length=4, color=RED)
        self.play(Transform(circle, square))
        self.wait(1)
        
        # Fade out
        self.play(FadeOut(circle), FadeOut(text))
        self.wait(0.5)

if __name__ == "__main__":
    # Run with: manim -pql simple_example.py SimpleExample
    pass