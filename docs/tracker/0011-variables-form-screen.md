# variables form screen

**labels:** needs-triage

## What to build

Implement the variables form screen where users review and fill in
the variables for a flow before running it. Required variables are
at the top; optional below. Each field is a hybrid combobox —
free-text input with an optional arrow-key dropdown for fields that
declare enums.

End-to-end: a user arrives at the form with default values
pre-filled, tabs between fields, expands the dropdown on a field
with enums, picks a value, and presses enter to start the run.
Submitting with a blank required field focuses the first blank one
and shows an inline error.

## Acceptance criteria

- [ ] Screen skipped when the flow references zero variables;
      proceeds directly to `run-view`
- [ ] `EnumInput` component in `src/ui/components/`: free-text
      input + arrow-down opens inline dropdown of enum suggestions;
      selecting a suggestion fills the field; user can still type
      freely; enum is suggestive, not constraining
- [ ] Form renders two sections: **required** (top) and
      **optional** (bottom, de-emphasised); section labels are
      lowercase
- [ ] Field values pre-filled from the five-layer merge
      (`mergeVariables`); form-input layer is editable
- [ ] `tab` / `shift-tab` cycles focus between fields;
      `↑↓` navigates within an open dropdown
- [ ] Submitting with any required field empty focuses the first
      blank field and shows `required` inline next to it
- [ ] `continue-on-error` toggle in the form footer; `c` key
      toggles it; initial value from `definition.yaml`
      `continueOnError` (default `false`); label dimmed when off,
      orange when on
- [ ] Pressing `enter` on the last field (or a dedicated "run"
      action) transitions to `run-view`
- [ ] `esc` returns to `env-picker` (or `flow-picker` if env
      picker was skipped)
- [ ] Footer hints:
      `tab next · ↑↓ dropdown · c continue-on-error · enter run · esc back`

## Blocked by

- [0010 env picker screen](./0010-env-picker-screen.md)
- [0003 variable detection & merge](./0003-variable-detection-and-merge.md)
