import React from 'react';

export function useAdminV4ScrollMemory(activeViewScrollKey: string) {
  const mainScrollRef = React.useRef<HTMLElement | null>(null);
  const activeViewScrollKeyRef = React.useRef(activeViewScrollKey);
  const viewScrollPositionsRef = React.useRef<Record<string, number>>({});

  const rememberMainScroll = React.useCallback((key = activeViewScrollKey) => {
    const scrollContainer = mainScrollRef.current;
    if (!scrollContainer) return;
    viewScrollPositionsRef.current[key] = scrollContainer.scrollTop;
  }, [activeViewScrollKey]);

  const createScrollSnapshot = React.useCallback((preserveScroll = false) => {
    const scrollContainer = mainScrollRef.current;
    const scrollKey = preserveScroll ? activeViewScrollKeyRef.current : null;
    const scrollTop = scrollKey
      ? viewScrollPositionsRef.current[scrollKey] ?? scrollContainer?.scrollTop ?? null
      : null;

    return {
      restore() {
        if (scrollTop == null || !scrollContainer || !scrollKey) return;
        const restoreScroll = () => {
          if (activeViewScrollKeyRef.current !== scrollKey) return;
          const savedScrollTop = viewScrollPositionsRef.current[scrollKey] ?? scrollTop;
          const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
          const nextScrollTop = Math.min(savedScrollTop, maxScrollTop);
          scrollContainer.scrollTop = nextScrollTop;
          viewScrollPositionsRef.current[scrollKey] = nextScrollTop;
        };
        window.requestAnimationFrame(() => {
          restoreScroll();
          window.requestAnimationFrame(restoreScroll);
        });
      }
    };
  }, []);

  React.useLayoutEffect(() => {
    activeViewScrollKeyRef.current = activeViewScrollKey;
    const scrollContainer = mainScrollRef.current;
    if (!scrollContainer) return;
    const requestedScrollTop = viewScrollPositionsRef.current[activeViewScrollKey] ?? 0;
    const restoreScroll = () => {
      const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
      scrollContainer.scrollTop = Math.min(requestedScrollTop, maxScrollTop);
    };
    restoreScroll();
    let animationFrame = window.requestAnimationFrame(() => {
      restoreScroll();
      animationFrame = window.requestAnimationFrame(restoreScroll);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [activeViewScrollKey]);

  React.useEffect(() => {
    const scrollContainer = mainScrollRef.current;
    if (!scrollContainer) return;
    const saveScroll = () => {
      viewScrollPositionsRef.current[activeViewScrollKey] = scrollContainer.scrollTop;
    };
    scrollContainer.addEventListener('scroll', saveScroll, { passive: true });
    saveScroll();
    return () => {
      scrollContainer.removeEventListener('scroll', saveScroll);
    };
  }, [activeViewScrollKey]);

  return {
    mainScrollRef,
    rememberMainScroll,
    createScrollSnapshot
  };
}

export default useAdminV4ScrollMemory;
