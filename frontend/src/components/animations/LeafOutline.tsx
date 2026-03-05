import React, { useEffect, useRef } from "react";
import anime from "animejs";

const LeafOutline = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const outlinePath = containerRef.current?.querySelector(".leaf-outline");
        const fillPath = containerRef.current?.querySelector(".leaf-fill");

        if (!outlinePath || !fillPath) return;

        // Use anime timeline for drawing outline and fading fill sequentially
        const tl = anime.timeline({
            easing: "easeInOutSine",
        });

        // Animate outline line-drawing
        tl.add({
            targets: outlinePath,
            strokeDashoffset: [anime.setDashoffset, 0],
            duration: 2000,
            direction: "normal",
            loop: false,
        })
            // Fade in fill after the outline is fully drawn
            .add(
                {
                    targets: fillPath,
                    opacity: [0, 1],
                    duration: 1000,
                    easing: "linear",
                    color: "#22c55e", // Example property, anime.js handles color transitions too
                },
                "-=500" // start the fade when 500ms remain of the drawing phase
            );

        return () => {
            anime.remove([outlinePath, fillPath]);
        };
    }, []);

    return (
        <div ref={containerRef} className="flex justify-center items-center w-full h-full min-h-[150px]">
            <svg
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full max-w-[100px] overflow-visible"
            >
                {/* Fill (hidden at start) */}
                <path
                    className="leaf-fill"
                    d="M 50 10 Q 80 40 50 90 Q 20 40 50 10 Z"
                    fill="#4ade80"
                    style={{ opacity: 0 }} // Start faded out
                />
                {/* Outline (drawn via animation) */}
                <path
                    className="leaf-outline"
                    d="M 50 10 Q 80 40 50 90 Q 20 40 50 10 Z"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};

export default LeafOutline;
