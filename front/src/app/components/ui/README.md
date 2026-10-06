# Spartan UI — Angular shadcn implementation

Vendored MIT-licensed Spartan brain + helm source from
https://github.com/spartan-ng/spartan/tree/07933569c63f201b0c64f0de5e2fc68a22711dbf/libs/ui
(Angular 17-compatible snapshot, 2024-02).

This is actual upstream component source, not a CSS imitation and not the React shadcn package.
TypeScript path aliases resolve the upstream imports locally. Source ownership follows
shadcn's copy-and-own model. Preserve LICENSE when redistributing.

Application-specific compositions belong outside this folder.
Local patches: determinate zero progress must render empty rather than indeterminate.

Angular 17.3 compatibility patch: signal input fields are public rather than private
(as required by the Angular compiler). No component behavior changes other than the
zero-progress correction above.
