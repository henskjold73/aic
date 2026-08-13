import { useEffect, useState } from "react";

/**
 * Track whether the viewport is at least `breakpoint` pixels wide.
 *
 * @param breakpoint minimum width in CSS pixels
 * @returns `true` while `window.innerWidth >= breakpoint`
 */
export function useWide(breakpoint = 600): boolean {
  const [wide, setWide] = useState<boolean>(
    () => window.innerWidth >= breakpoint,
  );

  useEffect(() => {
    const handleResize = (): void => setWide(window.innerWidth >= breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return wide;
}
