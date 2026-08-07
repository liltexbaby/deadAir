/**
 * Shared shapes for Server Action results.
 *
 * Deliberately NOT in a 'use server' module: every export of such a module is
 * compiled into the Server Actions manifest as a callable reference, so a type
 * export there becomes a runtime binding for something that doesn't exist and
 * the route 500s. TypeScript can't catch it — the build only fails at runtime.
 */
export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
  ok?: boolean;
}
