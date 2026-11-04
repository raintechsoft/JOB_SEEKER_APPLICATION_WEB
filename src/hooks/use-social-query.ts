"use client";
import { useCommunicationQuery } from "./use-communication-query";

// The same identity scope and cancellation contract applies to private social snapshots.
export const useSocialQuery = useCommunicationQuery;
