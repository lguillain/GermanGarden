import { useEffect, useState } from 'react';

export function useGardenTime(fixedTime?: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (fixedTime !== undefined) return;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [fixedTime]);
  return fixedTime ?? now;
}
