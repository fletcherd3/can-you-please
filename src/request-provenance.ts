import type { Request } from "./domain.js";
import type {
  RequestCompletedEvent,
  RequestSnapshot,
  RequestStartedEvent,
} from "./runner/index.js";

export type RequestProvenance = "definition" | "resolved" | "sent";

export interface RequestProvenanceSelection {
  source: RequestProvenance;
  snapshot: RequestSnapshot | null;
}

function requestToSnapshot(requestDef: Request): RequestSnapshot {
  return {
    method: requestDef.method,
    url: requestDef.url,
    headers: requestDef.headers,
    body:
      requestDef.body != null
        ? {
            mode: requestDef.body.type,
            content: requestDef.body.content,
          }
        : undefined,
  };
}

export function selectRequestProvenance(
  completedEvent: RequestCompletedEvent | null,
  requestDef: Request | null,
  startedEvent?: RequestStartedEvent | null,
): RequestProvenanceSelection {
  if (completedEvent?.sentRequest != null) {
    return { source: "sent", snapshot: completedEvent.sentRequest };
  }

  if (
    completedEvent?.resolvedRequest != null ||
    startedEvent?.resolvedRequest != null
  ) {
    return {
      source: "resolved",
      snapshot: completedEvent?.resolvedRequest ?? startedEvent?.resolvedRequest ?? null,
    };
  }

  return {
    source: "definition",
    snapshot: requestDef != null ? requestToSnapshot(requestDef) : null,
  };
}
