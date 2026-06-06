import { useState, useEffect, useRef, useCallback } from "react";
import { ChatMessage } from "../../../../types";

export function useScrollManager(
  history: ChatMessage[],
  isLoading: boolean,
  displayedMessages: ChatMessage[] | any[]
) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const pendingScrollTurnRef = useRef<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastNavigatedTurn, setLastNavigatedTurn] = useState<number | null>(null);

  // Auto switch to last page when new message arrives
  useEffect(() => {
    const turns = Array.from(
      new Set(
        history.map((m) => (m.turnNumber !== undefined ? m.turnNumber : 0)),
      ),
    ).sort((a, b) => a - b);
    const totalP = turns.length > 0 ? turns.length : 1;
    if (history.length > 0) {
      setCurrentPage(totalP);
    }
  }, [history]);

  // Scroll handler to detect if user is at the bottom
  const handleScroll = useCallback(() => {
    if (scrollViewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        scrollViewportRef.current;
      const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 50;
      shouldAutoScrollRef.current = isAtBottom;
    }
  }, []);

  // Smooth scroll to a target turn element after pagination DOM updates
  useEffect(() => {
    if (pendingScrollTurnRef.current !== null) {
      const turnNumber = pendingScrollTurnRef.current;
      const timer = setTimeout(() => {
        const element = document.getElementById(`turn-${turnNumber}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
          pendingScrollTurnRef.current = null;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentPage, displayedMessages]);

  // Auto scroll to bottom/latest turn
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      if (!isLoading && history.length > 0) {
        const lastMsg = history[history.length - 1];
        if (lastMsg.role === "model" && lastMsg.turnNumber !== undefined) {
          const scrollTimeout = setTimeout(() => {
            const element = document.getElementById(
              `turn-${lastMsg.turnNumber}`,
            );
            if (element) {
              element.scrollIntoView({ behavior: "smooth" });
              setLastNavigatedTurn(lastMsg.turnNumber);
            } else if (chatEndRef.current) {
              chatEndRef.current.scrollIntoView({ behavior: "smooth" });
            }
          }, 150);
          return () => clearTimeout(scrollTimeout);
        }
      }

      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [history, isLoading]);

  // Force scroll when page changes (navigating history)
  useEffect(() => {
    if (chatEndRef.current && pendingScrollTurnRef.current === null) {
      chatEndRef.current.scrollIntoView({ behavior: "auto" });
      shouldAutoScrollRef.current = true;
    }
  }, [currentPage]);

  const scrollToTurn = useCallback(
    (turnNumber: number) => {
      const msgIndex = history.findIndex((m) => m.turnNumber === turnNumber);
      if (msgIndex === -1) return;

      const turns = Array.from(
        new Set(
          history.map((m) => (m.turnNumber !== undefined ? m.turnNumber : 0)),
        ),
      ).sort((a, b) => a - b);
      const turnIndex = turns.indexOf(turnNumber);
      const targetPage = turnIndex === -1 ? 1 : turnIndex + 1;

      if (targetPage !== currentPage) {
        setCurrentPage(targetPage);
        pendingScrollTurnRef.current = turnNumber;
      } else {
        const element = document.getElementById(`turn-${turnNumber}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }
      setLastNavigatedTurn(turnNumber);
      shouldAutoScrollRef.current = false;
    },
    [history, currentPage],
  );

  const findCurrentTurnInView = useCallback(() => {
    if (!scrollViewportRef.current) return null;
    const viewport = scrollViewportRef.current;
    const viewportRect = viewport.getBoundingClientRect();
    const midPoint = viewportRect.top + viewportRect.height / 3;

    const turnElements = Array.from(viewport.querySelectorAll('[id^="turn-"]'));
    let closestTurn = null;
    let minDistance = Infinity;

    for (const el of turnElements) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom > viewportRect.top && rect.top < viewportRect.bottom) {
        const distance = Math.abs(rect.top - midPoint);
        if (distance < minDistance) {
          minDistance = distance;
          const turnId = el.id.replace("turn-", "");
          closestTurn = parseInt(turnId, 10);
        }
      }
    }
    return closestTurn;
  }, []);

  const scrollToTop = useCallback(() => {
    const allTurns = Array.from(
      new Set(
        history
          .filter((m) => m.turnNumber !== undefined)
          .map((m) => m.turnNumber as number),
      ),
    ).sort((a, b) => a - b);

    if (allTurns.length === 0) {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    const currentTurn = findCurrentTurnInView() ?? lastNavigatedTurn;

    let targetTurn: number;
    if (currentTurn === null) {
      targetTurn = allTurns[allTurns.length - 1];
    } else {
      const currentIndex = allTurns.indexOf(currentTurn);
      if (currentIndex > 0) {
        targetTurn = allTurns[currentIndex - 1];
      } else {
        targetTurn = allTurns[allTurns.length - 1];
      }
    }

    scrollToTurn(targetTurn);
  }, [history, findCurrentTurnInView, lastNavigatedTurn, scrollToTurn]);

  const scrollToBottom = useCallback(() => {
    const allTurns = Array.from(
      new Set(
        history
          .filter((m) => m.turnNumber !== undefined)
          .map((m) => m.turnNumber as number),
      ),
    ).sort((a, b) => a - b);

    if (allTurns.length === 0) {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    const currentTurn = findCurrentTurnInView() ?? lastNavigatedTurn;

    let targetTurn: number;
    if (currentTurn === null) {
      targetTurn = allTurns[0];
    } else {
      const currentIndex = allTurns.indexOf(currentTurn);
      if (currentIndex !== -1 && currentIndex < allTurns.length - 1) {
        targetTurn = allTurns[currentIndex + 1];
      } else {
        if (chatEndRef.current) {
          chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
        setLastNavigatedTurn(null);
        shouldAutoScrollRef.current = true;
        return;
      }
    }

    scrollToTurn(targetTurn);
  }, [history, findCurrentTurnInView, lastNavigatedTurn, scrollToTurn]);

  return {
    chatEndRef,
    scrollViewportRef,
    shouldAutoScrollRef,
    pendingScrollTurnRef,
    currentPage,
    setCurrentPage,
    lastNavigatedTurn,
    setLastNavigatedTurn,
    handleScroll,
    scrollToTurn,
    findCurrentTurnInView,
    scrollToTop,
    scrollToBottom,
  };
}
