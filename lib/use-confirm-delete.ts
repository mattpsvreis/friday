"use client";

import { useCallback, useState } from "react";

type PendingDelete<T> = {
  target: T;
  title: string;
  description?: string;
};

export function useConfirmDelete<T>() {
  const [pending, setPending] = useState<PendingDelete<T> | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);

  const requestDelete = useCallback(
    (target: T, title: string, description?: string) => {
      setPending({ target, title, description });
      setStep(1);
      setBusy(false);
    },
    [],
  );

  const cancel = useCallback(() => {
    if (busy) return;
    setPending(null);
    setStep(1);
  }, [busy]);

  const continueToStep2 = useCallback(() => {
    setStep(2);
  }, []);

  const runConfirm = useCallback(
    async (action: (target: T) => Promise<void>) => {
      if (!pending) return;
      setBusy(true);
      try {
        await action(pending.target);
        setPending(null);
        setStep(1);
      } finally {
        setBusy(false);
      }
    },
    [pending],
  );

  return {
    pending,
    step,
    busy,
    open: pending !== null,
    requestDelete,
    cancel,
    continueToStep2,
    runConfirm,
  };
}
