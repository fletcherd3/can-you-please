export interface Script {
  type: "beforeRequest" | "afterResponse";
  language: string;
  code: string;
}

export type RequestBodyType = "json" | "text";

export interface RequestBody {
  type: RequestBodyType;
  content: string;
}

export interface RequestAuth {
  type: "basic" | "bearer";
  credentials: Record<string, string>;
}

export interface Request {
  /** Filename stem — e.g. "01-create-user" from "01-create-user.request.yaml" */
  name: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  auth?: RequestAuth;
  body?: RequestBody;
  scripts: Script[];
  order: number;
}

export interface Flow {
  kind: "flow";
  /** Absolute (or cwd-relative) path to the flow folder on disk */
  folderPath: string;
  /** Bare name without group prefix */
  name: string;
  group: string | null;
  description?: string;
  order: number;
  /** Empty array means "runs anywhere" */
  environments: string[];
  continueOnError: boolean;
  /** Default variable values declared in definition.yaml */
  variables: Record<string, string>;
  requires: string[];
  enums: Record<string, string[]>;
  requests: Request[];
  /** Folder path of the other flow sharing this fully-qualified name, if any */
  duplicateWarning?: string;
}

export interface BrokenFlow {
  kind: "broken-flow";
  folderPath: string;
  reason: string;
}

export type AnyFlow = Flow | BrokenFlow;

export interface EnvValue {
  key: string;
  value: string;
  enabled: boolean;
  source?: "globals-file" | "workspace-env";
}

export interface Environment {
  /** File basename without ".environment.yaml" — e.g. "dev" */
  id: string;
  /** Inner name field from the YAML */
  name: string;
  values: EnvValue[];
  filePath: string;
}

export interface Globals {
  values: EnvValue[];
  filePath: string;
}

export interface Workspace {
  rootPath: string;
  /**
   * Sorted: ungrouped valid flows first (by order asc then name),
   * then grouped flows (groups alphabetical; within each group by order then name).
   * Broken flows appended at the end.
   */
  flows: AnyFlow[];
  environments: Environment[];
  globals: Globals | null;
}
