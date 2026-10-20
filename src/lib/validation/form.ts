"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues } from "react-hook-form";
import type { z } from "zod";

/**
 * React Hook Form + Zod with native constraint reporting.
 *
 * `shouldUseNativeValidation` surfaces schema messages through the browser's validation bubbles,
 * which is how the prototype reported invalid fields (`form.reportValidity()`), so the UX is
 * unchanged while the rules live in typed schemas.
 */
export function useZodForm<TInput extends FieldValues, TOutput extends FieldValues>(schema: z.ZodType<TOutput, TInput>, defaultValues: DefaultValues<TInput>) {
  return useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
    shouldUseNativeValidation: true,
    mode: "onSubmit",
  });
}
