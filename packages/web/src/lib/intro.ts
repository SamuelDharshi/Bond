export const INTRO_SEEN = 'bond-intro-seen';

/**
 * The landing intro: the ink stage fills the screen, then the page slides up over it while the top bar
 * slides down. The state lives on <html data-intro> so it is set before first paint (no flash) and is
 * independent of React effects (StrictMode runs those twice). Skipped for reduced-motion users and every
 * page except the landing page.
 */
export function prepareIntro(): void {
  const h = location.hash;
  if (!(h === '' || h === '#' || h === '#/')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.dataset.intro = 'offset';
}

let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const INTRO_DELAY_MS = 1650; // the page starts sliding in under the loader's fade-out
const subs = new Set<() => void>();

/** True once the page has started sliding in (or there is no intro to play). */
export const introEntered = (): boolean => document.documentElement.dataset.intro !== 'offset';

/** Notified when the page starts sliding in (the ink stage then shrinks). Returns an unsubscribe. */
export function onIntroEntering(cb: () => void): () => void {
  subs.add(cb);
  return () => subs.delete(cb);
}

/** Ends the intro immediately (also used when the visitor navigates away mid-intro). */
export function finishIntro(): void {
  const root = document.documentElement;
  if (root.dataset.intro === undefined) return;
  delete root.dataset.intro;
  root.classList.remove('lock');
  try {
    sessionStorage.setItem(INTRO_SEEN, '1');
  } catch {
    /* ignore */
  }
}

function enter(): void {
  const root = document.documentElement;
  if (root.dataset.intro !== 'offset') return;
  root.dataset.intro = 'entering';
  subs.forEach((f) => f());
  setTimeout(finishIntro, 1550);
}

/** Idempotent: starts the timeline once, no matter how many times it is called. */
export function runIntro(): void {
  const root = document.documentElement;
  if (started || root.dataset.intro !== 'offset') return;
  started = true;
  root.classList.add('lock');
  timer = setTimeout(enter, INTRO_DELAY_MS);
}

/** Skip the wait (e.g. the visitor clicked the loader): the page slides in right away. */
export function accelerateIntro(): void {
  if (timer) clearTimeout(timer);
  timer = undefined;
  if (started) enter();
}
