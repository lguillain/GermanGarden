import { closeOnBackdropClick } from '../../components/dialog-backdrop';
import { useId, useRef } from 'react';
import type { Word } from '../../api';
import { SeedBag } from '../../components/seed-bag';
import { SeedBagIcon } from '../../components/garden-artwork';

export function SeedBagButton({ count, onClick }: { count?: number; onClick: () => void }) {
  return (
    <button
      className="garden-seed-bag-trigger"
      onClick={onClick}
      disabled={count === undefined}
      aria-haspopup="dialog"
    >
      <SeedBagIcon />
      Seed bag <span className="garden-seed-bag-capacity">{count ?? '—'} / 20</span>
    </button>
  );
}

export function SeedBagDialog({ words }: { words?: Word[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  return (
    <>
      <SeedBagButton count={words?.length} onClick={() => dialog.current?.showModal()} />
      <dialog
        ref={dialog}
        className="upcoming-reviews garden-seed-bag-dialog"
        aria-labelledby={title}
        onClick={closeOnBackdropClick}
      >
        <div className="garden-seed-bag-dialog-header">
          <span id={title} className="sr-only">
            Seed bag
          </span>
          <button onClick={() => dialog.current?.close()} autoFocus>
            Close
          </button>
        </div>
        {words?.length === 20 && (
          <p className="small muted">
            Your seed bag is full. Review a seed to plant it and make room.
          </p>
        )}
        <SeedBag words={words} />
      </dialog>
    </>
  );
}
