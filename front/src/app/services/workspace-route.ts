// A shared route boundary: the public library keeps the same layout for every role.
export function isWorkspaceRoute(url:string):boolean {
  const path=url.split(/[?#]/)[0];
  return /^\/(dashboard|admin-dashboard|manager-dashboard|trainer-dashboard|account|course|cv|cart|recommendations)(\/|$)/.test(path);
}
