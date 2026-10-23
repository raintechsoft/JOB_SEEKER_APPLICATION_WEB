"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils/text";

type Props = ComponentProps<"img"> & { fallback?: ReactNode };

export function MediaImage(props: Props) { return <ImageResource key={String(props.src)} {...props} />; }

function ImageResource({ fallback, onLoad, onError, className, alt = "", loading = "lazy", ...props }: Props) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (image.current?.complete) setState(image.current.naturalWidth > 0 ? "ready" : "error");
  }, []);
  if (state === "error") return <>{fallback ?? <span className="media-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined} style={{ aspectRatio: props.width && props.height ? `${props.width}/${props.height}` : undefined }}>Image unavailable</span>}</>;
  // Existing image containers supply fixed dimensions/aspect ratios. The image's
  // background remains a neutral placeholder if animations are disabled.
  // eslint-disable-next-line @next/next/no-img-element -- existing API-managed/local media URLs
  return <img {...props} ref={image} alt={alt} loading={loading} decoding="async" className={cn("media-image", state === "loading" && "media-image-loading", className)} onLoad={event => { setState("ready"); onLoad?.(event); }} onError={event => { setState("error"); onError?.(event); }} />;
}
