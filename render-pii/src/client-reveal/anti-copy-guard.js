export function installAntiCopyGuard(target = document) {
  const block = (event) => {
    event.preventDefault();
  };

  target.addEventListener('contextmenu', block, { capture: true });
  target.addEventListener('dragstart', block, { capture: true });
  target.addEventListener('selectstart', block, { capture: true });

  return () => {
    target.removeEventListener('contextmenu', block, { capture: true });
    target.removeEventListener('dragstart', block, { capture: true });
    target.removeEventListener('selectstart', block, { capture: true });
  };
}
