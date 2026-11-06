import { useCallback, useEffect, useRef } from 'react';

/**
 * 在首页累计浏览时长，到达阈值后触发一次（N4 延后介入）。
 * 阈值改变时重新计时，便于演示；cancel 用于用户已主动打开推荐的情况。
 */
export function useBrowseTimer(active: boolean, seconds: number, onFire: () => void) {
  const elapsed = useRef(0);
  const done = useRef(false);
  const callback = useRef(onFire);
  callback.current = onFire;

  useEffect(() => {
    elapsed.current = 0;
    done.current = false;
  }, [seconds]);

  useEffect(() => {
    if (!active || seconds <= 0 || done.current) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      elapsed.current += 1;
      if (elapsed.current >= seconds) {
        done.current = true;
        window.clearInterval(id);
        callback.current();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [active, seconds]);

  return useCallback(() => {
    done.current = true;
  }, []);
}
