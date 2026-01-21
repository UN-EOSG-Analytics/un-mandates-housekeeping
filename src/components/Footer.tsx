"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  const showFootnote = pathname === "/" || pathname.startsWith("/entity");

  return (
    <footer className={`w-full ${showFootnote ? "mt-8" : ""}`}>
      {showFootnote && (
        <div className="mx-auto w-full max-w-7xl px-3 sm:px-4">
          <p className="pb-6 text-xs text-gray-400">
            <sup>*</sup> All current mandate citations have been extracted from
            the{" "}
            <a
              href="https://www.un.org/en/ga/fifth/80/ppb2026.shtml"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-un-blue"
            >
              List of documents relating to the proposed programme plan and
              budget for 2026
            </a>
            .
            <br />
            Only showing parts, sections, and entities that include
            &apos;Legislative mandates&apos;.
          </p>
        </div>
      )}
      <div className="border-t border-gray-200 py-8">
        <p className="text-center text-sm text-gray-500">
          © 2026 United Nations. All rights reserved worldwide.
        </p>
      </div>
    </footer>
  );
}
