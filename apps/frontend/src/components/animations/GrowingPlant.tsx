import React, { useEffect, useRef } from "react";
import anime from "animejs";

const GrowingPlant = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // We target the SVG elements scoped inside the container
        const stemPath = containerRef.current?.querySelector(".stem-path");
        const leaves = containerRef.current?.querySelectorAll(".leaf");

        if (!stemPath || !leaves) return;

        // Create an anime timeline for sequential animations
        const tl = anime.timeline({
            easing: "easeOutExpo",
            duration: 1500,
        });

        // 1. Draw the stem using strokeDashoffset
        tl.add({
            targets: stemPath,
            strokeDashoffset: [anime.setDashoffset, 0],
            duration: 2000,
            easing: "easeInOutSine",
        })
            // 2. Scale the leaves into view one by one as the stem passes them
            .add(
                {
                    targets: leaves,
                    scale: [0, 1],
                    opacity: [0, 1],
                    delay: anime.stagger(300, { start: 500 }),
                    duration: 1000,
                },
                "-=1500" // Start animating leaves while the stem is still finishing
            );

        // Cleanup isn't strictly necessary for a run-once animation timeline,
        // but good practice if the component unmounts mid-animation
        return () => {
            anime.remove([stemPath, leaves]);
        };
    }, []);

    return (
        <div ref={containerRef} className="flex justify-center items-center w-full h-full min-h-[200px]">
            <svg
                viewBox="0 0 100 200"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full max-w-[150px] overflow-visible"
            >
                {/* Stem */}
                <path
                    className="stem-path"
                    d="M 50 200 Q 60 150 45 100 T 50 10"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="4"
                    strokeLinecap="round"
                />

                {/* Leaves - transform origins are set near the stem connection */}
                <g className="leaf" style={{ transformOrigin: "50px 148px", opacity: 0 }}>
                    <path d="M 52 148 Q 70 140 80 130 Q 75 160 52 148" fill="#22c55e" />
                </g>

                <g className="leaf" style={{ transformOrigin: "47px 98px", opacity: 0 }}>
                    <path d="M 47 98 Q 30 90 20 80 Q 25 110 47 98" fill="#4ade80" />
                </g>

                <g className="leaf" style={{ transformOrigin: "50px 48px", opacity: 0 }}>
                    <path d="M 50 48 Q 65 40 75 30 Q 70 60 50 48" fill="#15803d" />
                </g>
            </svg>
        </div>
    );
};

export default GrowingPlant;
