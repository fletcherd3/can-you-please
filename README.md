# can you please

a friendly TUI for running multi-step API flows against named
environments, sourced from your own git-managed [Collection 3](https://github.com/fletcherd3/can-you-please) repo.

---

## install

```bash
npm install -g can-you-please
```

or run without installing:

```bash
npx can-you-please
```

---

## prerequisites

- **node ≥ 22** — the app will print a clear error and exit if the
  node version is too old
- **a collection 3 workspace** — a git repo containing YAML request,
  environment, and globals files under `postman/`; the setup wizard
  can scaffold one for you if you don't have one yet

---

## quick start

```bash
can-you-please
```

on first launch the setup wizard opens. point it at an existing
workspace directory, or let it scaffold a new one. after that you
land on the flow picker — arrow keys and enter to navigate, `?` for
the full key reference.

---

## workspace layout

```
your-workspace/
  postman/
    collections/
      my-flow/
        definition.yaml       # name, envs, description
        01-create-user.request.yaml
        02-assign-card.request.yaml
    environments/
      dev.yaml
      sand.yaml
    globals/
      globals.yaml
```

---

## key bindings

| key | action |
|-----|--------|
| `↑ ↓` | navigate |
| `enter` | select |
| `esc` | back / clear filter |
| `?` | help overlay |
| `q` | quit |

---

## license

MIT
