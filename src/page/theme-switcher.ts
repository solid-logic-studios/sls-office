/** Fills the theme picker and reports the id of whichever theme the visitor chooses. */
export function mountThemeSwitcher(
  select: HTMLSelectElement,
  themes: readonly { id: string; name: string }[],
  currentId: string,
  onChange: (id: string) => void,
): void {
  select.replaceChildren(
    ...themes.map((theme) => {
      const option = document.createElement('option');
      option.value = theme.id;
      option.textContent = theme.name;
      return option;
    }),
  );
  select.value = currentId;
  select.addEventListener('change', () => onChange(select.value));
}
