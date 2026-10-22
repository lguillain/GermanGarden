import { closeOnBackdropClick } from './dialog-backdrop';
import { lazy, Suspense, useId, useRef, useState } from 'react';
import type { Word } from '../api';
import { Loading } from './feedback';

const FormsWorkspace = lazy(() => import('./forms-workspace'));

export function FormsButton({ word }: { word: Word }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [opened, setOpened] = useState(false);
  return (
    <div className="card-forms">
      <button
        className="button"
        aria-haspopup="dialog"
        onClick={() => {
          setOpened(true);
          dialog.current?.showModal();
        }}
      >
        Forms
      </button>
      <dialog
        ref={dialog}
        className="forms-dialog"
        aria-labelledby={titleId}
        onClick={closeOnBackdropClick}
      >
        <header className="forms-dialog-header">
          <h2 id={titleId}>Forms</h2>
          <button autoFocus onClick={() => dialog.current?.close()}>
            Close
          </button>
        </header>
        {opened && (
          <Suspense fallback={<Loading />}>
            <FormsWorkspace word={word} />
          </Suspense>
        )}
      </dialog>
    </div>
  );
}
