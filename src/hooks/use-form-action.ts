"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServices } from "./use-services";
import type { Services } from "@/services";
import { errorMessage, fieldErrors } from "@/services/api/client";

/** A confirmed result keeps failed forms open and preserves their entered values. */
export function useFormAction(setErrors: (errors: Record<string, string>) => void) {
  const services = useServices();
  const cache = useQueryClient();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const execute = async (action: (services: Services) => Promise<unknown>, options:{exclude?:string[];invalidate?:string[]}={}) => {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    try {
      const result = await action(services);
      if (result === false) throw new Error("Your changes could not be saved.");
      await cache.invalidateQueries({predicate:(query)=>(!options.invalidate||options.invalidate.includes(String(query.queryKey[0])))&&!options.exclude?.includes(String(query.queryKey[0]))});
      return true;
    } catch (error) {
      const fields = Object.fromEntries(Object.entries(fieldErrors(error)).map(([key, messages]) => [key.replace(/^verification\./, ""), messages[0]]));
      setErrors({ ...fields, _form: errorMessage(error) });
      return false;
    } finally {
      locked.current = false;
      setPending(false);
    }
  };
  return { execute, pending };
}
