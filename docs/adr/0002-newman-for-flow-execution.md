# Newman runs the flows

Flows are executed by Newman against an in-memory Postman v2.1
collection assembled from the workspace YAML. We considered rolling
our own HTTP runner (faster cold start, smaller dep tree, native
async-iterable events) but rejected it because flow scripts already
depend on Postman's `pm.*` API for variables, tests and chaining
between requests — and Newman ships that runtime for free.
Replacing Newman later would mean re-implementing `pm.*` or breaking
every existing flow's scripts.
