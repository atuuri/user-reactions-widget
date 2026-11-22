// SPDX-License-Identifier: MIT
// M6 Floating placement: placement="floating", close button and Escape, auto-hide after thanks, dismissed event.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { FakeIO, mount, mockFetch, type Mounted } from './helpers';

/** Stubs matchMedia so prefers-reduced-motion matches `reduce` unless `motion` is true. */
const motion = (on: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: on && q.includes('no-preference'), media: q }));

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
  motion(false);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

/** Default after-send (replace), floating unless overridden. Records `dismissed` too. */
function float(attrs: Record<string, string | null> = {}) {
  const m = mount({ 'after-send': null, placement: 'floating', ...attrs });
  const dismissed: string[] = [];
  m.el.addEventListener('user-reactions:dismissed', (e) => dismissed.push((e as CustomEvent).detail.reason));
  return { ...m, dismissed, close: () => m.q<HTMLButtonElement>('[part=close]') };
}

const settle = () => vi.advanceTimersByTimeAsync(0);
const esc = (target: Element) => target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
const css = (m: Mounted) => m.sr.querySelector('style')!.textContent!;

describe('placement', () => {
  it.each([null, 'inline', 'bogus', ''])('placement=%s renders inline, with no close button', (p) => {
    mockFetch();
    const m = float({ placement: p });
    expect(m.close()).toBeNull();
    expect(m.btn(1)).not.toBeNull();
    esc(m.btn(1));
    expect(m.el.hidden).toBe(false);
    expect(m.dismissed).toEqual([]);
  });

  it('floating: a labelled close button comes last, after the rating buttons', () => {
    mockFetch();
    const m = float();
    const all = [...m.sr.querySelectorAll('button')];
    expect(all.at(-1)).toBe(m.close());
    expect(m.close().getAttribute('aria-label')).toBe('Close');
    expect(m.close().title).toBe('Close');
    expect(m.close().getAttribute('part')).toBe('close');
  });

  it.each([
    ['fi', 'Sulje'],
    ['sv', 'Stäng'],
  ])('lang=%s labels the close button %s', (lang, label) => {
    mockFetch();
    expect(float({ lang }).close().getAttribute('aria-label')).toBe(label);
  });

  it('works with every type, including open', () => {
    mockFetch();
    for (const type of ['thumbs', 'csat', 'ces', 'open']) expect(float({ type }).close()).not.toBeNull();
  });

  it('renders nothing (no empty card) when the configuration is invalid', () => {
    mockFetch();
    const m = float({ surface: null });
    expect(m.sr.innerHTML).toBe('');
  });

  it('CSS: fixed bottom-right with logical properties, safe areas, --ur-offset and --ur-z, opaque Canvas', () => {
    mockFetch();
    const s = css(float());
    const rule = s.match(/:host\(\[placement=floating\]\)\{([^}]*)\}/)![1];
    expect(rule).toContain('position:fixed');
    expect(rule).toContain('z-index:var(--ur-z,2147483000)');
    expect(rule).toMatch(/inset-block-end:calc\(var\(--ur-offset,16px\) \+ env\(safe-area-inset-bottom/);
    expect(rule).toMatch(/inset-inline-end:calc\(var\(--ur-offset,16px\)/);
    expect(rule).toContain('background:var(--ur-bg,Canvas)');
    expect(rule).toContain('color:var(--ur-text,CanvasText)');
    expect(rule).toContain('border-radius:min(var(--ur-radius,6px),12px)');
    expect(rule).not.toMatch(/right:|bottom:|left:/);
    expect(s).toMatch(/@media \(max-width:480px\)\{:host\(\[placement=floating\]\)\{inset-inline-start:/);
  });

  it('changing placement does not reset: same id, no second impression; the close button follows', async () => {
    const f = mockFetch();
    const m = float({ placement: 'inline', comment: 'optional' });
    FakeIO.show(m.el);
    m.btn(1).click();
    await settle();
    m.el.setAttribute('placement', 'floating');
    expect(m.close()).not.toBeNull();
    FakeIO.show(m.el);
    m.btn(0).click();
    await settle();
    expect(f.impressions()).toHaveLength(1);
    const ids = f.feedback().map((c) => c.body.id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(m.btn(0).getAttribute('aria-pressed')).toBe('true');
    m.el.setAttribute('placement', 'inline');
    expect(m.close()).toBeNull();
  });

  it('one impression as soon as the card shows', async () => {
    const f = mockFetch();
    const m = float();
    FakeIO.show(m.el);
    await settle();
    expect(f.impressions()).toHaveLength(1);
  });
});

describe('close', () => {
  it('the close button hides the card and fires dismissed with reason "close"; nothing is stored', () => {
    mockFetch();
    const m = float();
    m.close().click();
    expect(m.el.hidden).toBe(true);
    expect(m.dismissed).toEqual(['close']);
    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    m.close().click();
    expect(m.dismissed).toEqual(['close']); // once
  });

  it('Escape while focus is inside the card closes it', () => {
    mockFetch();
    const m = float({ type: 'csat' });
    m.btn(3).focus();
    esc(m.btn(3));
    expect(m.el.hidden).toBe(true);
    expect(m.dismissed).toEqual(['close']);
  });

  it('open feedback: Escape in the box closes the box first, the next Escape closes the card', () => {
    mockFetch();
    const m = float({ type: 'open' });
    const toggle = m.q<HTMLButtonElement>('[part=toggle]');
    toggle.click();
    esc(m.q('textarea'));
    expect(m.form().hidden).toBe(true);
    expect(m.el.hidden).toBe(false);
    esc(toggle);
    expect(m.el.hidden).toBe(true);
    expect(m.dismissed).toEqual(['close']);
  });

  it('is not a modal: nothing is focused on show, and nothing traps Tab', () => {
    mockFetch();
    const m = float();
    expect(m.sr.activeElement).toBeNull();
    expect(m.sr.querySelector('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])')).toBeNull();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true, cancelable: true });
    m.close().dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });

  it('re-adding the element after a dismissal shows it again as a new instance', async () => {
    const f = mockFetch();
    const m = float({ comment: 'optional' });
    FakeIO.show(m.el);
    m.btn(1).click();
    await settle();
    m.close().click();
    m.el.remove();
    document.body.append(m.el);
    expect(m.el.hidden).toBe(false);
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('false');
    FakeIO.show(m.el);
    m.btn(0).click();
    await settle();
    expect(f.impressions()).toHaveLength(2);
    const [a, b] = f.feedback().map((c) => c.body.id);
    expect(b).not.toBe(a);
  });

  it('a reset attribute change after a dismissal shows the card again', () => {
    mockFetch();
    const m = float();
    m.close().click();
    m.el.setAttribute('subject', 'next');
    expect(m.el.hidden).toBe(false);
    expect(m.close()).not.toBeNull();
  });
});

describe('after thanks', () => {
  async function thank(attrs: Record<string, string | null> = {}) {
    mockFetch();
    const m = float(attrs);
    m.btn(1).click();
    await settle();
    return m;
  }

  it('keeps the thanks text and the close button, then hides about 4 s later with reason "done"', async () => {
    const m = await thank();
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
    expect(m.close()).not.toBeNull();
    expect(m.q('[data-s]')).toBeNull();
    await vi.advanceTimersByTimeAsync(3900);
    expect(m.el.hidden).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(m.el.hidden).toBe(true);
    expect(m.dismissed).toEqual(['done']);
  });

  it('not while the pointer is over the card', async () => {
    const m = await thank();
    m.el.dispatchEvent(new Event('pointerenter'));
    await vi.advanceTimersByTimeAsync(10000);
    expect(m.el.hidden).toBe(false);
    m.el.dispatchEvent(new Event('pointerleave'));
    await vi.advanceTimersByTimeAsync(4000);
    expect(m.dismissed).toEqual(['done']);
  });

  it('not while focus is inside the card', async () => {
    const m = await thank();
    m.close().focus();
    await vi.advanceTimersByTimeAsync(10000);
    expect(m.el.hidden).toBe(false);
    m.close().blur();
    await vi.advanceTimersByTimeAsync(4000);
    expect(m.dismissed).toEqual(['done']);
  });

  it('focus left inside by a mouse click does not hold it once the pointer leaves', async () => {
    mockFetch();
    const m = float();
    m.btn(1).dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    m.el.dispatchEvent(new Event('pointerenter'));
    m.btn(1).focus();
    m.btn(1).click();
    await settle();
    expect(m.sr.activeElement).toBe(m.thanks()); // focus followed the thanks
    await vi.advanceTimersByTimeAsync(10000);
    expect(m.el.hidden).toBe(false); // still hovered
    m.el.dispatchEvent(new Event('pointerleave'));
    await vi.advanceTimersByTimeAsync(4000);
    expect(m.dismissed).toEqual(['done']);
  });

  it('a key press inside the card makes focus hold it again', async () => {
    mockFetch();
    const m = float();
    m.btn(1).dispatchEvent(new Event('pointerdown', { bubbles: true, composed: true }));
    m.btn(1).focus();
    m.btn(1).click();
    await settle();
    m.thanks().dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true, composed: true }));
    await vi.advanceTimersByTimeAsync(10000);
    expect(m.el.hidden).toBe(false);
  });

  it('open feedback hides after its thanks too', async () => {
    mockFetch();
    const m = float({ type: 'open' });
    m.q<HTMLButtonElement>('[part=toggle]').click();
    m.q<HTMLTextAreaElement>('textarea').value = 'Dark mode please';
    m.q<HTMLButtonElement>('[part=send]').click();
    await settle();
    m.q<HTMLElement>('[part=thanks]').blur();
    await vi.advanceTimersByTimeAsync(4000);
    expect(m.dismissed).toEqual(['done']);
  });

  it('with after-send="keep" it never hides on its own', async () => {
    const m = await thank({ 'after-send': 'keep' });
    await vi.advanceTimersByTimeAsync(60000);
    expect(m.el.hidden).toBe(false);
    expect(m.dismissed).toEqual([]);
  });

  it('inline elements never hide', async () => {
    const m = await thank({ placement: null });
    await vi.advanceTimersByTimeAsync(60000);
    expect(m.el.hidden).toBe(false);
  });

  it('a failed send hides nothing', async () => {
    mockFetch(500, 500);
    const m = float();
    m.btn(1).click();
    await vi.advanceTimersByTimeAsync(10000);
    expect(m.el.hidden).toBe(false);
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
  });

  it('removing the element cancels the timer', async () => {
    const m = await thank();
    m.el.remove();
    await vi.advanceTimersByTimeAsync(10000);
    expect(m.dismissed).toEqual([]);
  });
});

describe('motion', () => {
  const NO_PREF = /@media \(prefers-reduced-motion:no-preference\)\{((?:[^{}]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\})*)\}/;

  it('the slide-in runs only under prefers-reduced-motion: no-preference', () => {
    mockFetch();
    const s = css(float());
    expect(s.match(NO_PREF)![1]).toMatch(/:host\(\[placement=floating\]\)\{animation:/);
    expect(s.replace(NO_PREF, '')).not.toMatch(/animation|@keyframes|transition/);
  });

  it('with reduce, the card hides at once without animating', () => {
    mockFetch();
    const m = float();
    const animate = vi.spyOn(m.el, 'animate');
    m.close().click();
    expect(animate).not.toHaveBeenCalled();
    expect(m.el.hidden).toBe(true);
  });

  it('with no-preference, it fades out first, then hides and fires dismissed', () => {
    motion(true);
    mockFetch();
    const m = float();
    const anim = {} as Animation;
    const animate = vi.spyOn(m.el, 'animate').mockReturnValue(anim);
    m.close().click();
    expect(animate).toHaveBeenCalledOnce();
    expect(m.el.hidden).toBe(false);
    anim.onfinish!.call(anim, new Event('finish') as AnimationPlaybackEvent);
    expect(m.el.hidden).toBe(true);
    expect(m.dismissed).toEqual(['close']);
  });
});
