import { cn } from "@/lib/utils/text";

/** Decorative: the owning control/region supplies the accessible operation name. */
export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("loading-spinner", className)} />;
}
