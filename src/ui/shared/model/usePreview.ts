"use client";

import { useEffect, useState } from "react";

import type { Preview, Question } from "@/contract/questions";

import { useSession, useStores } from "./storeContext";

/** Предпросмотр отвечает о нынешнем состоянии: правка состояния переспрашивает его заново. */
export function usePreview(question: Question | null): Preview | null {
  const { session } = useStores();
  const shown = useSession((state) => state.snapshot);
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
  }, [asked, session, shown]);

  return preview;
}
