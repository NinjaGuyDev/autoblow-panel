// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest';
import { isSpaceActivatedControl } from '@/lib/keyboardUtils';

function spaceOn(element: HTMLElement): KeyboardEvent {
  document.body.appendChild(element);
  const event = new KeyboardEvent('keydown', { code: 'Space' });
  Object.defineProperty(event, 'target', { value: element });
  return event;
}

function input(type: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  return el;
}

describe('isSpaceActivatedControl', () => {
  afterEach(() => { document.body.innerHTML = ''; });

  it.each(['button', 'a', 'summary'])('is true for a <%s>', (tag) => {
    expect(isSpaceActivatedControl(spaceOn(document.createElement(tag)))).toBe(true);
  });

  it.each(['checkbox', 'radio', 'button', 'submit'])('is true for an input of type %s', (type) => {
    expect(isSpaceActivatedControl(spaceOn(input(type)))).toBe(true);
  });

  it('is true for an element with role="tab"', () => {
    const tab = document.createElement('div');
    tab.setAttribute('role', 'tab');
    expect(isSpaceActivatedControl(spaceOn(tab))).toBe(true);
  });

  it('is false for a range slider, so Space can still pause from it', () => {
    expect(isSpaceActivatedControl(spaceOn(input('range')))).toBe(false);
  });

  it('is false for a plain container', () => {
    expect(isSpaceActivatedControl(spaceOn(document.createElement('div')))).toBe(false);
  });
});
