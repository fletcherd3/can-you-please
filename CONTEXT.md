# can-you-please

A TUI for running multi-step API flows against named environments,
sourced from a developer's own git-managed Collection 3 repo.

## Language

**Workspace**:
The user's git repo containing Collection 3 YAML under `postman/`.
The app is configured against one workspace at a time.
_Avoid_: collection repo, project, source.

**Flow**:
A leaf folder under `postman/collections/` containing one or more
`*.request.yaml` files. Every flow has a `definition.yaml` whose
`name` field carries the canonical display name.
_Avoid_: collection (overloaded), task, script.

**Group**:
An optional namespace for a flow, encoded in the flow's `name` field
as `group/flow`. Groups are *names*, not folders — there is no group
directory. Postman writes the on-disk folder name with a dash
substituted for the slash; the `name` field in `definition.yaml` is
the source of truth.
_Avoid_: folder, category, namespace.

**Request**:
A single HTTP call within a flow, declared in a `*.request.yaml`
file with method, url, headers, body, scripts and explicit `order`.

**Environment**:
A `*.environment.yaml` file under `postman/environments/` providing
a named set of variable values (e.g. `dev`, `sand`).

**Globals**:
A `*.globals.yaml` file under `postman/globals/` providing variable
values that apply across every environment.
`workspace.globals.yaml` is preferred when present.

**Variable**:
A `{{name}}` placeholder that may appear in a request's url, headers
or body. The set of variables for a flow is **auto-detected** by
scanning its requests. A flow's `definition.yaml` may mark a subset
as **required** and may attach an **enum** of suggested values to
any variable.

**Workspace env file**:
A `.env` file at the **Workspace** root whose key/value pairs are
injected into **Globals** only when running flows in that workspace.
_Avoid_: shell env, secret injection, local env

**Required variable**:
A variable explicitly listed under `required` in the flow's
`definition.yaml`. The variables form blocks the run until every
required variable has a non-empty value.

**Enum (variable)**:
A list of pre-filled quick-pick values for a variable, declared in
`definition.yaml`. The form lets the user pick one with arrow keys
or type a free-form value instead — the enum is suggestive, not
constraining.

## Relationships

- A **Workspace** contains many **Flows**, many **Environments**, and
  zero or more **Globals** files.
- A **Flow** contains one or more **Requests** and exactly one
  `definition.yaml`.
- A **Flow** belongs to at most one **Group**, by virtue of its
  `name` field.
- A **Request** references zero or more **Variables**.
- A **Variable**'s value resolves at run time, lowest precedence
  first:
  `flow defaults < globals (including workspace env file) < environment < form input < pm.variables.set()`

## Example dialogue

> **Dev:** "Where do I put a default token for every flow in the
> `user-flows` group?"
> **Domain expert:** "There's no group-level config — groups are
> just naming. Put it in **globals**, or as a default in each
> flow's `definition.yaml`."

## Flagged ambiguities

- "collection" was used to mean both the **Workspace** repo (as in
  "Collection 3 repo") and an individual **Flow** (as in `$kind:
  collection` in `definition.yaml`). Resolved: a *Flow* is the unit
  inside `postman/collections/`; the repo as a whole is the
  *Workspace*. The on-disk `$kind: collection` marker is a Postman
  artefact and not part of our domain language.
- "shell environment variable" was used for values supplied to runs.
  Resolved: inherited process environment is not part of the model;
  the supported source is the **Workspace env file**.
