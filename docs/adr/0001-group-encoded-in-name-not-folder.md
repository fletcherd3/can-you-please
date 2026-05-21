# Group is encoded in the flow name, not the directory hierarchy

A flow's group is read from its `definition.yaml` `name:` field as
`group/flow`, not from the folder structure under
`postman/collections/`. Folders under `collections/` are flat — one
folder per flow, no group folders, no nesting. This matches how
Postman writes Collection 3 to disk: it strips the `/` from the name
when creating the on-disk folder, and keeps the canonical
slash-form in the YAML. Doing the same here means a Postman-authored
collection drops in unmodified, and there's no second source of truth
for what group a flow belongs to. The cost is that the loader can't
discover groups by walking directories — it has to read every flow's
`definition.yaml` first.
