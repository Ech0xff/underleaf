// Coalesce typing, serialize writes and suppress feedback from superseded edits.
export function createAutoSave<T>(
  save: (value: T) => Promise<void>,
  report: (error: unknown | null) => void,
  delay = 350,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T; revision: number } | undefined;
  let revision = 0,
    active = 0;
  let disposed = false;
  let chain = Promise.resolve();
  const flush = (): Promise<void> => {
    clearTimeout(timer);
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
  return {
    schedule(value: T) {
      if (disposed) return;
      pending = { value, revision: ++revision };
      clearTimeout(timer);
      timer = setTimeout(() => {
        void flush();
      }, delay);
    },
    flush,
    busy: () => !!pending || active > 0,
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      pending = undefined;
    },
  };
}
