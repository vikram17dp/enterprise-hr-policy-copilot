"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Tracks whether the viewport is below the mobile breakpoint.
 * Required by components/ui/sidebar.tsx and available to the employee
 * MobileSidebar. The initial value is read lazily on the client and kept in
 * sync via a media-query listener, so no state is set synchronously inside
 * the effect body.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
