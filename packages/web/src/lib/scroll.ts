/** Scroll to a section of the landing page, navigating there first when on another page. */
export function goSection(id: string, onHome: boolean): void {
  const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (onHome) {
    scroll();
    return;
  }
  location.hash = '#/';
  setTimeout(scroll, 500);
}
