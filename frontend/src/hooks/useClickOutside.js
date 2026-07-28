import { useEffect } from 'react';

export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    function onPointerDown(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        handler(event);
      }
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') handler(event);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, handler, active]);
}
