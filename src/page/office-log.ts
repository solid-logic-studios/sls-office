const DEFAULT_LIMIT = 7;

/** The "Office log" card: newest entry first, only the last few kept. */
export class OfficeLog {
  constructor(
    private readonly list: HTMLOListElement,
    private readonly limit = DEFAULT_LIMIT,
  ) {}

  add(text: string, at: Date): void {
    const time = document.createElement('time');
    time.dateTime = at.toISOString();
    time.textContent = at.toTimeString().slice(0, 8);
    const message = document.createElement('span');
    message.textContent = text;
    const item = document.createElement('li');
    item.append(time, message);
    this.list.prepend(item);
    while (this.list.children.length > this.limit) this.list.lastElementChild?.remove();
  }
}
