"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import type { z } from "zod";
import { errorMessage, fieldErrors } from "@/services/api/client";
import { toast } from "@/stores/toast-store";

/** Submit validation runs before the caller can reach a service. Server failures are shown as error toasts. */
export function useAuthForm<T extends FieldValues>(schema: z.ZodType<T, T>, defaultValues: DefaultValues<T>) {
  const form = useForm<T>({ resolver: zodResolver(schema), defaultValues, mode: "onSubmit", reValidateMode: "onChange" });
  const submit = (action: (values: T) => Promise<void>) => form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try { await action(values); } catch (error) {
      const messages = [...new Set(Object.values(fieldErrors(error)).map((items) => items[0]).filter(Boolean))];
      toast(messages[0] || errorMessage(error), "error");
    }
  });
  const props = (name: Path<T>) => ({
    ...form.register(name),
    "aria-invalid": !!form.formState.errors[name],
    "aria-describedby": form.formState.errors[name] ? `auth-error-${name}` : undefined,
  });
  return { ...form, submit, props };
}
