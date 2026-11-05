import { closeOnBackdropClick } from './dialog-backdrop';
import { lazy, Suspense, useId, useRef, useState } from 'react';
import type { Word } from '../api';
import { Loading } from './feedback';

const ContextWorkspace = lazy(() => import('./context-workspace'));

export function ContextButton({ word }: { word: Word }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [opened, setOpened] = useState(false);
  const [mounted, setMounted] = useState(false);
  return (
    <div className="card-context">
      <button
        className="button"
        aria-haspopup="dialog"
        onClick={() => {
          setMounted(true);
          setOpened(true);
          dialog.current?.showModal();
        }}
      >
        Context
      </button>
      <dialog
        ref={dialog}
        className="context-dialog"
        aria-labelledby={titleId}
        onClose={() => setOpened(false)}
        onClick={closeOnBackdropClick}
      >
        <header className="context-dialog-header">
          <h2 id={titleId}>Context</h2>
          <button autoFocus onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        {mounted && (
          <Suspense fallback={<Loading />}>
            <ContextWorkspace word={word} open={opened} />
          </Suspense>
        )}
      </dialog>
    </div>
  );
}
