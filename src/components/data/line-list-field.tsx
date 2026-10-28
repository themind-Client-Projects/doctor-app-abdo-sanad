"use client";

import { useState } from "react";
import { Field, fieldClass } from "@/components/data/form-dialog";


/**
 * A textarea holding a LIST, one item per line.
 *
 * The obvious spelling is a trap, and both list fields on this form had it:
 *
 *     value={items.join("\n")}
 *     onChange={(e) => set(key, e.target.value.split("\n").map(t => t.trim()).filter(Boolean))}
 *
 * The controlled value is re-derived from the TRIMMED array on every render, so
 * typing «تحليل» then a space produces «تحليل », which trims to ["تحليل"], which
 * joins back to «تحليل» — byte-identical to the previous value prop. React then
 * restores the DOM node and the space never lands. `filter(Boolean)` destroys
 * Enter the same way, so a second line cannot be created at all — and the LAB
 * field's own hint asks for «فحص في كل سطر». Its example, «تحليل دم شامل CBC»,
 * could not be typed in the natural order.
 *
 * So the raw text is held locally and only the PARSED array is pushed up. The
 * imaging screen already does exactly this (dashboard/imaging/page.tsx:382).
 */
export function LineListField({
  id,
  label,
  hint,
  items,
  onChange,
  rows = "h-24",
}: {
  id: string;
  label: string;
  hint?: string;
  items: string[];
  onChange: (next: string[]) => void;
  rows?: string;
}) {
  // Seeded once. Re-seeding from `items` on every render is the bug above.
  const [text, setText] = useState(() => items.join("\n"));

  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <textarea
        id={id}
        className={`${fieldClass} ${rows} py-2.5`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(
            e.target.value
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean)
          );
        }}
      />
    </Field>
  );
}

