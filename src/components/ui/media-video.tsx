"use client";

import type { ComponentProps } from "react";
import { isManagedMediaUrl } from "@/lib/utils/url";
import { apiConfig } from "@/services/api/config";

/** Establish the API session for private/draft videos; external URLs receive no credentials. */
export function MediaVideo({
  src,
  crossOrigin,
  ...props
}: ComponentProps<"video">) {
  let managed = false;
  try {
    managed =
      typeof src === "string" &&
      isManagedMediaUrl(src) &&
      new URL(src).origin === new URL(apiConfig.baseUrl).origin;
  } catch {
    /* Local/external source. */
  }
  return (
    <video
      {...props}
      src={src}
      crossOrigin={crossOrigin ?? (managed ? "use-credentials" : undefined)}
    />
  );
}
