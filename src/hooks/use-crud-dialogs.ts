"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * The create / edit / delete dialog state every CRUD screen keeps.
 *
 * Seventeen admin and operations pages had written the same fifteen lines by
 * hand: three pieces of dialog state, a form object, a `close` that has to
 * reset all four, and a `done` that closes then refetches. Copies drift — one
 * page forgets to clear the form on close, so reopening "create" shows the last
 * edited row's values; another forgets a refetch, so the table silently lies
 * until a reload.
 *
 * `TRow` is the table's row type; `TForm` the shape the dialog edits.
 *
 * ```ts
 * const crud = useCrudDialogs<Banner, FormState>(EMPTY, refetch);
 *
 * crud.openCreate();
 * crud.openEdit(row, (r) => ({ title: r.title, ... }));   // seeds the form
 * crud.openDelete(row);
 *
 * <FormDialog open={crud.isFormOpen} onClose={crud.close} … />
 * ```
 */
export type CrudDialogs<TRow, TForm> = {
  /** The row being edited, or null when creating / idle. */
  editing: TRow | null;
  /** True while the create dialog is open. */
  creating: boolean;
  /** The row awaiting delete confirmation. */
  deleting: TRow | null;
  /** Either dialog that edits fields is open — what `FormDialog` needs. */
  isFormOpen: boolean;
  form: TForm;
  setForm: React.Dispatch<React.SetStateAction<TForm>>;
  /** Patch one field without spelling out the spread at every call site. */
  setField: <K extends keyof TForm>(key: K, value: TForm[K]) => void;
  openCreate: () => void;
  /** `seed` maps the row onto the form — the one part that differs per screen. */
  openEdit: (row: TRow, seed: (row: TRow) => TForm) => void;
  openDelete: (row: TRow) => void;
  /** Close everything and reset the form to `empty`. */
  close: () => void;
  /** Close, then refetch. Pass as a mutation's `onSuccess`. */
  done: () => void;
};

export function useCrudDialogs<TRow, TForm>(
  empty: TForm,
  refetch?: () => void | Promise<unknown>
): CrudDialogs<TRow, TForm> {
  const [editing, setEditing] = useState<TRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TRow | null>(null);
  const [form, setForm] = useState<TForm>(empty);

  // `empty` is a module constant at every call site, but it is not referenced
  // in the deps: taking it as a dependency would rebuild `close` — and with it
  // `done` — on any caller that passes an inline object, which in turn
  // re-renders every memoized row.
  const close = useCallback(() => {
    setEditing(null);
    setCreating(false);
    setDeleting(null);
    setForm(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = useCallback(() => {
    close();
    void refetch?.();
  }, [close, refetch]);

  const openCreate = useCallback(() => {
    setForm(empty);
    setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = useCallback((row: TRow, seed: (row: TRow) => TForm) => {
    setEditing(row);
    setForm(seed(row));
  }, []);

  const openDelete = useCallback((row: TRow) => setDeleting(row), []);

  const setField = useCallback(
    <K extends keyof TForm>(key: K, value: TForm[K]) =>
      setForm((f) => ({ ...f, [key]: value })),
    []
  );

  return useMemo(
    () => ({
      editing,
      creating,
      deleting,
      isFormOpen: creating || editing !== null,
      form,
      setForm,
      setField,
      openCreate,
      openEdit,
      openDelete,
      close,
      done,
    }),
    [editing, creating, deleting, form, setField, openCreate, openEdit, openDelete, close, done]
  );
}
