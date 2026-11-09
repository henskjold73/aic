import { useEffect, useState } from "react";
import { UI_ZOOM } from "@/lib/constants";

/**
 * Track whether the viewport is at least `breakpoint` pixels wide.
 *
 * The UI is rendered at {@link UI_ZOOM}, so the width the layout actually has
 * is `innerWidth / UI_ZOOM`; breakpoints are in those (zoomed) CSS pixels.
 *
 * @param breakpoint minimum layout width in CSS pixels
 * @returns `true` while `window.innerWidth / UI_ZOOM >= breakpoint`
 */
export function useWide(breakpoint = 600): boolean {
  const [wide, setWide] = useState<boolean>(
    () => window.innerWidth / UI_ZOOM >= breakpoint,
  );

  useEffect(() => {
    const handleResize = (): void => setWide(window.innerWidth / UI_ZOOM >= breakpoint);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return wide;
}
