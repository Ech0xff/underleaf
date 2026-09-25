// Coalesce typing, serialize writes and suppress feedback from superseded edits.
export function createAutoSave<T>(
  save: (value: T) => Promise<void>,
  report: (error: unknown | null) => void,
  delay = 350,
) {
  let pending: Readonly<{ value: T; revision: number }> | undefined;
  let revision = 0,
    active = 0;
  let disposed = false;
  let chain = Promise.resolve();
  const flush = (): Promise<void> => {
    scheduleFlush.cancel();
    const job = pending;
    pending = undefined;
    if (!job) return chain;
    active++;
    chain = chain.then(async () => {
      try {
        await save(job.value);
        if (!disposed && job.revision === revision) report(null);
      } catch (error) {
        if (!disposed && job.revision === revision) report(error);
      } finally {
        active--;
      }
    });
    return chain;
  };
  const scheduleFlush = debounce(() => {
    void flush();
  }, delay);
  return {
    schedule(value: T) {
      if (disposed) return;
      pending = { value, revision: ++revision };
      scheduleFlush();
    },
    flush,
    busy: () => !!pending || active > 0,
    dispose: () => {
      disposed = true;
      scheduleFlush.cancel();
      pending = undefined;
    },
  };
}
import { debounce } from "es-toolkit";
