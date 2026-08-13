import { useEffect, useState, type JSX } from "react";
import { timeAgo } from "@/lib/date";
import type { IsoTimestamp } from "@/types";

export interface LiveAgoProps {
  /** Timestamp to count up from. */
  iso: IsoTimestamp;
}

/** Relative timestamp that re-renders itself, ticking faster when recent. */
export function LiveAgo({ iso }: LiveAgoProps): JSX.Element {
  const [label, setLabel] = useState<string>(() => timeAgo(iso));

  useEffect(() => {
    const elapsedSeconds = (): number =>
      Math.floor((Date.now() - new Date(iso).getTime()) / 1000);

    // Tick every second under a minute, every 10s under an hour, else per minute.
    const seconds = elapsedSeconds();
    const period = seconds < 60 ? 1_000 : seconds < 3_600 ? 10_000 : 60_000;

    const interval = window.setInterval(() => setLabel(timeAgo(iso)), period);
    return () => window.clearInterval(interval);
  }, [iso]);

  return <>{label}</>;
}
