"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  content: string;
  children: React.ReactNode;
}

export function Tooltip({ content, children }: Props) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"top" | "bottom">("top");
  const [align, setAlign] = useState<"left" | "center" | "right">("center");
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Vertical position
      setPosition(rect.top < 80 ? "bottom" : "top");

      // Horizontal alignment - estimate tooltip width (max 320px)
      const tooltipWidth = Math.min(320, content.length * 6 + 16);
      const centerX = rect.left + rect.width / 2;

      if (centerX - tooltipWidth / 2 < 8) {
        setAlign("left");
      } else if (centerX + tooltipWidth / 2 > viewportWidth - 8) {
        setAlign("right");
      } else {
        setAlign("center");
      }
    }
  }, [show, content]);

  const alignClasses = {
    left: "left-0",
    center: "left-1/2 -translate-x-1/2",
    right: "right-0",
  };

  const arrowAlignClasses = {
    left: "left-3",
    center: "left-1/2 -translate-x-1/2",
    right: "right-3",
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-block max-w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          ref={tooltipRef}
          className={`absolute z-50 w-max max-w-xs rounded bg-gray-800 px-2 py-1.5 text-left text-xs text-white ${alignClasses[align]} ${
            position === "top" ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {content}
          <span
            className={`absolute ${arrowAlignClasses[align]} border-4 border-transparent ${
              position === "top"
                ? "top-full border-t-gray-800"
                : "bottom-full border-b-gray-800"
            }`}
          />
        </span>
      )}
    </span>
  );
}
