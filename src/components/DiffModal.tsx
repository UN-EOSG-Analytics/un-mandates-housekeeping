"use client";

import { X, Loader2, Search, ChevronUp, ChevronDown } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { computeDocumentDiffAction } from "@/features/mandates/services/documents/document-fetching";
import { DiffViewer } from "undifferent/react";
import type { DiffResult } from "undifferent/core";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  originalSymbol: string;
  originalYear: number;
  originalTitle?: string;
  compareSymbol: string;
  compareYear: number;
  compareTitle?: string;
}

export function DiffModal({
  isOpen,
  onClose,
  originalSymbol,
  originalYear,
  originalTitle,
  compareSymbol,
  compareYear,
  compareTitle,
}: Props) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    diffResult: DiffResult | null;
  }>({ loading: true, error: null, diffResult: null });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const [totalMatches, setTotalMatches] = useState<number>(0);
  const diffContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    computeDocumentDiffAction(originalSymbol, compareSymbol)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setState({ loading: false, error: result.error, diffResult: null });
        } else {
          setState({
            loading: false,
            error: null,
            diffResult: result.data ?? null,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setState({
          loading: false,
          error: "Failed to compute diff",
          diffResult: null,
        });
      });

    return () => {
      cancelled = true;
      // Reset state for next open
      setState({ loading: true, error: null, diffResult: null });
    };
  }, [isOpen, originalSymbol, compareSymbol]);

  // Highlight search matches
  useEffect(() => {
    if (!diffContainerRef.current || !searchQuery.trim()) {
      // Remove existing highlights
      diffContainerRef.current?.querySelectorAll('mark.search-highlight, mark.search-highlight-current').forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize();
        }
      });
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    const container = diffContainerRef.current;
    const query = searchQuery.trim().toLowerCase();

    // Remove existing highlights
    container.querySelectorAll('mark.search-highlight, mark.search-highlight-current').forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
        parent.normalize();
      }
    });

    // Function to highlight text in a text node
    const highlightTextNode = (node: Text) => {
      const text = node.textContent || '';
      const lowerText = text.toLowerCase();
      let index = lowerText.indexOf(query);
      
      if (index === -1) return;

      const parent = node.parentNode;
      if (!parent) return;

      const fragments: Node[] = [];
      let lastIndex = 0;

      while (index !== -1) {
        // Add text before match
        if (index > lastIndex) {
          fragments.push(document.createTextNode(text.substring(lastIndex, index)));
        }

        // Add highlighted match
        const mark = document.createElement('mark');
        mark.className = 'search-highlight bg-yellow-200 rounded px-0.5';
        mark.textContent = text.substring(index, index + query.length);
        fragments.push(mark);

        lastIndex = index + query.length;
        index = lowerText.indexOf(query, lastIndex);
      }

      // Add remaining text
      if (lastIndex < text.length) {
        fragments.push(document.createTextNode(text.substring(lastIndex)));
      }

      // Replace the text node with fragments
      fragments.forEach(fragment => parent.insertBefore(fragment, node));
      parent.removeChild(node);
    };

    // Walk through all text nodes and highlight matches
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // Skip script and style elements
          const parent = node.parentElement;
          if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE')) {
            return NodeFilter.FILTER_REJECT;
          }
          // Skip if already highlighted
          if (parent?.tagName === 'MARK') {
            return NodeFilter.FILTER_REJECT;
          }
          // Only include if contains search query
          const text = node.textContent || '';
          if (text.toLowerCase().includes(query)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_REJECT;
        }
      }
    );

    const textNodes: Text[] = [];
    let currentNode = walker.nextNode();
    while (currentNode) {
      textNodes.push(currentNode as Text);
      currentNode = walker.nextNode();
    }

    // Highlight all matching text nodes
    textNodes.forEach(highlightTextNode);
    
    // Count total matches and reset current index
    const matches = container.querySelectorAll('mark.search-highlight');
    setTotalMatches(matches.length);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [searchQuery, state.diffResult]);

  // Update current match highlighting and scroll
  useEffect(() => {
    if (!diffContainerRef.current || totalMatches === 0 || currentMatchIndex < 0) return;

    const container = diffContainerRef.current;
    const matches = container.querySelectorAll('mark.search-highlight');
    
    // Remove current highlight from all matches
    matches.forEach(mark => {
      mark.classList.remove('search-highlight-current', 'bg-un-blue', 'text-white');
      mark.classList.add('bg-yellow-200');
    });

    // Highlight current match
    const currentMatch = matches[currentMatchIndex];
    if (currentMatch) {
      currentMatch.classList.remove('bg-yellow-200');
      currentMatch.classList.add('search-highlight-current', 'bg-un-blue', 'text-white');
      
      // Scroll to current match
      currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, totalMatches]);

  // Navigation functions
  const goToNextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
  }, [totalMatches]);

  const goToPreviousMatch = useCallback(() => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
  }, [totalMatches]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen || totalMatches === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter or F3 for next
      if (e.key === 'Enter' || e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPreviousMatch();
        } else {
          goToNextMatch();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, totalMatches, goToNextMatch, goToPreviousMatch]);

  const { loading, error, diffResult } = state;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Compare Document Versions
              </h2>
              <p className="mt-1 truncate text-sm text-gray-500">
                {originalSymbol} ({originalYear}) → {compareSymbol} ({compareYear}
                )
              </p>
              {(originalTitle || compareTitle) && (
                <p className="truncate text-xs text-gray-400">
                  {originalTitle || compareTitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Search Bar */}
          {!loading && !error && diffResult && (
            <div className="border-t border-gray-100 px-6 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search in differences..."
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-un-blue focus:outline-none focus:ring-2 focus:ring-un-blue/20"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {totalMatches > 0 && (
                  <>
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                      {currentMatchIndex + 1} of {totalMatches}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={goToPreviousMatch}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Previous match (Shift+Enter)"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={goToNextMatch}
                        className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        title="Next match (Enter)"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto rounded-b-xl">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
          ) : error ? (
            <div className="py-20 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <p className="mt-2 text-xs text-gray-400">
                Document content may not be available from UN ODS.
              </p>
            </div>
          ) : diffResult ? (
            <div
              ref={diffContainerRef}
              className="p-6"
              style={
                {
                  "--diff-item-bg": "#ffffff",
                  "--diff-added-bg": "#dcfce7",
                  "--diff-removed-bg": "#fee2e2",
                  "--diff-moved-bg": "#fefce8",
                  "--diff-aligned-bg": "#eff6ff",
                  "--diff-score-color": "#009edb",
                } as React.CSSProperties
              }
            >
              <DiffViewer
                data={diffResult}
                left={{ symbol: originalSymbol }}
                right={{ symbol: compareSymbol }}
              />
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-sm text-gray-500">No content to compare</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
