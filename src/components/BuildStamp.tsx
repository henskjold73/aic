import type { JSX } from "react";
import { buildStamp } from "@/styles";

/** Fixed-position build hash and timestamp shown in the bottom-right corner. */
export function BuildStamp(): JSX.Element {
  return (
    <div style={buildStamp}>
      {__BUILD_HASH__} · {new Date(__BUILD_TIME__).toLocaleString()}
    </div>
  );
}
