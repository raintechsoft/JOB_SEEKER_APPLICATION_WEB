"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils/text";
import { errorMessage } from "@/services/api/client";
import { toast } from "@/stores/toast-store";
import { Icon, type IconName } from "./icon";
import { Spinner } from "./spinner";

type ButtonProps = Omit<ComponentProps<"button">, "className"> & { variant?: string; icon?: IconName; className?: string; loading?: boolean; loadingLabel?: string; unstyled?: boolean };

function usePendingClick(onClick: ComponentProps<"button">["onClick"], loading: boolean) {
  const [pending, setPending] = useState(false);
  const locked = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const busy = loading || pending;
  const click: NonNullable<ComponentProps<"button">["onClick"]> = event => {
    if (locked.current || busy) { event.preventDefault(); return; }
    const result: unknown = onClick?.(event);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      locked.current = true; setPending(true);
      void Promise.resolve(result).catch(error => toast(errorMessage(error), "error")).finally(() => { locked.current = false; if (mounted.current) setPending(false); });
    }
  };
  return { busy, click };
}

/** Local pending state also covers async click actions such as confirmations. */
export function Button({ variant = "", icon, children, type = "button", className, loading = false, loadingLabel, unstyled = false, disabled, onClick, "aria-label": label, ...rest }: ButtonProps) {
  const { busy, click } = usePendingClick(onClick, loading);
  return <button {...rest} type={type} className={cn(unstyled ? "action-button" : "btn", variant, className)} disabled={disabled || busy} aria-busy={busy || undefined} aria-label={busy ? loadingLabel ?? label ?? (typeof children === "string" ? children : "Working") : label} onClick={click}>
    {icon && <Icon name={icon} className={busy ? "button-content-hidden" : undefined} />}
    <span className={cn("button-label", busy && "button-content-hidden")}>{children}</span>
    {busy && <Spinner className="button-spinner" />}
  </button>;
}

type IconButtonProps = Omit<ComponentProps<"button">, "className" | "children"> & { icon: IconName; label: string; extra?: string; loading?: boolean };

export function IconButton({ icon, label, extra, loading = false, type = "button", disabled, onClick, ...rest }: IconButtonProps) {
  const { busy, click } = usePendingClick(onClick, loading);
  return <button {...rest} type={type} className={cn("iconbtn", extra)} aria-label={label} title={label} aria-busy={busy || undefined} disabled={disabled || busy} onClick={click}>{busy ? <Spinner /> : <Icon name={icon} />}</button>;
}
