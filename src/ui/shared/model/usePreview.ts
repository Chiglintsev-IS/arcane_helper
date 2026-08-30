"use client";

import { useEffect, useState } from "react";

import type { Preview, Question } from "@/contract/questions";

import { useStores } from "./storeContext";

export function usePreview(question: Question | null): Preview | null {
  const { session } = useStores();
  const [preview, setPreview] = useState<Preview | null>(null);
  const asked = question === null ? null : JSON.stringify(question);

  useEffect(() => {
    if (question === null) {
      setPreview(null);
      return;
    }

    let current = true;
    void session
      .getState()
      .ask(question)
      .then((answer) => {
        if (current) setPreview(answer);
      });
    return () => {
      current = false;
    };
  }, [asked, session]);

  return preview;
}
