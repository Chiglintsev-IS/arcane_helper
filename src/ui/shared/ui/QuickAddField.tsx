"use client";

import { useState, type FormEvent } from "react";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

export function QuickAddField({
  labelRu,
  onAdd,
}: {
  labelRu: string;
  onAdd: (nameRu: string) => void;
}) {
  const [value, setValue] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const nameRu = value.trim();
    if (nameRu === "") return;
    onAdd(nameRu);
    setValue("");
  };

  return (
    <form onSubmit={submit}>
      <label className={`flex min-h-11 items-center gap-2 px-2 text-xs ${SURFACE_CONTROL}`}>
        <span className="shrink-0 text-ink-quiet">{labelRu}</span>
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
      </label>
    </form>
  );
}
