import React, { useEffect, useRef } from "react";
import anime from "animejs";

const FarmFieldLines = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const paths = containerRef.current?.querySelectorAll(".field-path");
        if (!paths) return;

        // Use anime to stagger the drawing of each horizontal path
        anime({
            targets: paths,
            // Dashoffset starts at the length of the path (hidden) and animates to 0 (fully drawn)
            strokeDashoffset: [anime.setDashoffset, 0],
            easing: "easeInOutSine",
            duration: 1500,
            // Staggering the draw effect slightly for each field row
            delay: anime.stagger(200),
            direction: "normal",
            loop: false,
        });

        return () => {
            anime.remove(paths);
        };
    }, []);

    return (
        <div ref={containerRef} className="flex justify-center items-center w-full h-full min-h-[150px]">
            <svg
                viewBox="0 0 200 100"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full max-w-[200px]"
            >
                {/*
          We draw gentle sloping curves from left to right simulating a hillside or crop rows. 
          The 'd' path strings define these natural curves.
        */}
                <path
                    className="field-path"
                    d="M 10 20 Q 50 10 100 25 T 190 20"
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
                <path
                    className="field-path"
                    d="M 10 40 Q 60 45 120 35 T 190 40"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="4"
                    strokeLinecap="round"
                />
                <path
                    className="field-path"
                    d="M 10 60 Q 80 50 140 65 T 190 60"
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="5"
                    strokeLinecap="round"
                />
                <path
                    className="field-path"
                    d="M 10 80 Q 50 90 100 75 T 190 80"
                    fill="none"
                    stroke="#15803d"
                    strokeWidth="6"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
};

export default FarmFieldLines;
