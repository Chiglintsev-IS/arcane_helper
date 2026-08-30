"use client";

import { useState } from "react";

export function requiredFieldNumber(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

const NOT_TYPED = "Наберите число";

type RequiredNumbers = {
  typed: (value: number) => boolean;
  allTyped: (values: readonly number[]) => boolean;
  reasonOf: (value: number) => string | null;
  touching: <TNext>(write: (next: TNext) => void) => (next: TNext) => void;
  ask: (values: readonly number[], send: () => void) => void;
};

export function useRequiredNumbers(): RequiredNumbers {
  const [asked, setAsked] = useState(false);
  const typed = (value: number): boolean => !Number.isNaN(value);
  const allTyped = (values: readonly number[]): boolean => values.every(typed);

  return {
    typed,
    allTyped,
    reasonOf: (value) => (asked && !typed(value) ? NOT_TYPED : null),
    touching:
      (write) =>
      (next) => {
        setAsked(false);
        write(next);
      },
    ask: (values, send) => {
      setAsked(true);
      if (allTyped(values)) send();
    },
  };
}
