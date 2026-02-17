"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export function AnimatedLogo() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation on mount
    setMounted(true);
  }, []);

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes corner-slide-in {
          0% {
            opacity: 0;
            transform: translateX(-120px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes un20-roll-in {
          0% {
            opacity: 0;
            transform: translateX(-60px) rotate(-360deg) scale(0.3);
          }
          70% {
            opacity: 0.8;
            transform: translateX(0) rotate(0deg) scale(1.1);
          }
          100% {
            opacity: 1;
            transform: translateX(0) rotate(0deg) scale(1);
          }
        }

        .animated-logo-corner-entrance {
          animation: corner-slide-in 0.8s ease-out forwards;
          animation-delay: 3s;
          opacity: 0;
          transform: translateX(-120px);
        }

        .animated-logo-corner-hidden {
          opacity: 0;
          transform: translateX(-120px);
        }

        .animated-logo-sprite-entrance {
          animation: un20-roll-in 1s ease-out forwards;
          animation-delay: 4s;
          opacity: 0;
          transform: translateX(-60px) rotate(-360deg) scale(0.3);
        }

        .animated-logo-sprite-hidden {
          opacity: 0;
          transform: translateX(-60px) rotate(-360deg) scale(0.3);
        }
      `,
        }}
      />
      <div suppressHydrationWarning>
        <a
          href="https://un-two-zero.network/"
          target="_blank"
          rel="noopener noreferrer"
          className={`fixed bottom-0 left-0 z-30 cursor-pointer transition-opacity hover:opacity-80 ${
            mounted
              ? "animated-logo-corner-entrance"
              : "animated-logo-corner-hidden"
          }`}
          aria-label="Visit UN 2.0 Network"
        >
          {/* Base corner logo */}
          <Image
            src="/images/corner_un80.svg"
            alt="UN80 Logo"
            width={110}
            height={110}
            className="block"
          />
          {/* UN20 Animation Sprite on top */}
          <div className="absolute inset-0 flex items-center justify-start pt-2 pl-3">
            <Image
              src="/images/un20animation.svg"
              alt="UN20 Animation"
              width={30}
              height={30}
              className={`block ${mounted ? "animated-logo-sprite-entrance" : "animated-logo-sprite-hidden"}`}
            />
          </div>
        </a>
      </div>
    </>
  );
}
