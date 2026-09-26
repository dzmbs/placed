'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function WalletPopover({ children, close }: { children: ReactNode; close: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    const node = panel.current;
    const anchor = document.querySelector<HTMLElement>('[data-wallet-trigger]');
    const position = () => {
      if (!node) return;
      const rect = anchor?.getBoundingClientRect();
      node.style.right = `${Math.max(12, window.innerWidth - (rect?.right ?? window.innerWidth - 24))}px`;
      node.style.top = `${Math.min((rect?.bottom ?? 64) + 10, window.innerHeight - 100)}px`;
      node.style.maxHeight = `${window.innerHeight - parseFloat(node.style.top) - 12}px`;
    };
    position();
    node?.focus();
    const outside = (event: PointerEvent) => {
      if (!node?.contains(event.target as Node) && !anchor?.contains(event.target as Node)) {
        closeRef.current();
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        anchor?.focus();
      }
    };
    const focus = (event: FocusEvent) => {
      if (!node?.contains(event.target as Node) && !anchor?.contains(event.target as Node))
        closeRef.current();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('focusin', focus);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('focusin', focus);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      if (node?.contains(document.activeElement) || document.activeElement === document.body)
        anchor?.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={panel}
      id="wallet-details"
      className="mp-wallet-popover"
      role="dialog"
      aria-label="Your wallet"
      tabIndex={-1}
    >
      <div className="mp-wallet-heading">
        <strong>Your wallet</strong>
        <button className="mp-icon" aria-label="Close wallet" onClick={close}>
          <X size={17} />
        </button>
      </div>
      {children}
    </div>,
    document.body,
  );
}
