// SPDX-License-Identifier: MIT
// Demo host page logic: renders a fake chat, reacts to widget events (chat and help article)
// and shows mock API traffic.

const QA: [string, string][] = [
  ['How do I reset my password?', 'Open Settings → Security and choose “Reset password”. We email you a link that is valid for 30 minutes.'],
  ['Can I change the delivery address after ordering?', 'Yes, until the order ships. Go to Orders, pick the order and choose “Change address”.'],
  ['What is your refund policy?', 'Unused items can be returned within 30 days. Refunds go back to the original payment method within 5 business days.'],
  ['Where is my order #48213?', 'I could not find that order. Could you check the number in your confirmation email?'],
  ['Do you ship to Finland?', 'Yes. Delivery to Finland usually takes 2–4 business days.'],
  ['How do I cancel my subscription?', 'Go to Account → Subscription and choose “Cancel”. You keep access until the end of the billing period.'],
];
const EXTRA: [string, string] = ['Is there a student discount?', 'Yes, 15% with a verified student email. Apply it at checkout.'];

const chat = document.getElementById('chat')!;
const log = document.getElementById('log')!;
const outage = document.getElementById('outage') as HTMLInputElement;
const locale = document.getElementById('locale') as HTMLSelectElement;
let n = 0;

const endpoint = () => (outage.checked ? '/mock/fail' : '/mock');

function addTurn([q, a]: [string, string]) {
  const id = `msg_${(++n).toString(16).padStart(4, '0')}`;
  const user = document.createElement('div');
  user.className = 'msg user';
  user.textContent = q;
  const bot = document.createElement('article');
  bot.className = 'msg assistant';
  const p = document.createElement('p');
  p.textContent = a;
  const widget = document.createElement('user-reactions');
  for (const [k, v] of Object.entries({
    'project-key': 'pk_demo_local',
    type: 'thumbs',
    surface: 'assistant-answer',
    subject: id,
    meta: JSON.stringify({ model: 'demo-model', release: '2026.11.2' }),
    comment: 'on-negative',
    endpoint: endpoint(),
  }))
    widget.setAttribute(k, v);
  setLang(widget);
  bot.append(p, widget);
  chat.insertBefore(user, more);
  chat.insertBefore(bot, more);
}

function entry(cls: string, title: string, body?: unknown) {
  const li = document.createElement('li');
  const b = document.createElement('b');
  b.className = cls;
  b.textContent = title;
  li.append(b);
  if (body !== undefined) {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(body, null, 2);
    li.append(pre);
  }
  log.prepend(li);
}

const more = document.createElement('button');
more.className = 'more';
more.textContent = 'Ask another question';
more.onclick = () => addTurn(EXTRA);
chat.append(more);
QA.forEach(addTurn);

// Browsers may restore the checkbox on reload, so sync every widget (including the
// static one in the article) now and on change.
const syncEndpoint = () => {
  for (const w of document.querySelectorAll('user-reactions')) w.setAttribute('endpoint', endpoint());
};
outage.onchange = syncEndpoint;
syncEndpoint();

// Locale picker: "None" removes lang (English default); otherwise sets it on every widget.
// The widget does not translate a custom question or thanks, so the host switches them too,
// from data-question-fi / data-thanks-sv and so on next to the English attribute.
// A lang or question change resets each widget as a new instance (behaviour 8); thanks does not.
function setLang(w: HTMLElement) {
  const d = w.dataset;
  for (const a of ['question', 'thanks']) {
    if (d[a + 'En'] == null && w.hasAttribute(a)) d[a + 'En'] = w.getAttribute(a)!;
    const t = (locale.value == 'fi' ? d[a + 'Fi'] : locale.value == 'sv' ? d[a + 'Sv'] : undefined) ?? d[a + 'En'];
    if (t != null) w.setAttribute(a, t);
  }
  if (locale.value) w.setAttribute('lang', locale.value);
  else w.removeAttribute('lang');
}
const syncLang = () => document.querySelectorAll<HTMLElement>('user-reactions').forEach(setLang);
locale.onchange = syncLang;
syncLang();
document.getElementById('clear')!.onclick = () => (log.textContent = '');

// Reused node: a new subject resets the element (behaviour 8).
let reused = 1;
document.getElementById('next-subject')!.onclick = () => document.getElementById('reused')!.setAttribute('subject', `reused-${++reused}`);

// Floating card: one per page, appended at the end of <body> so it comes last in the Tab order.
// A dismissed card is replaced by a fresh one (a new instance with a new impression).
document.getElementById('show-floating')!.onclick = () => {
  document.getElementById('floating')?.remove();
  const w = document.createElement('user-reactions');
  for (const [k, v] of Object.entries({
    id: 'floating',
    'project-key': 'pk_demo_local',
    type: 'csat',
    surface: 'checkout',
    subject: 'floating-demo',
    comment: 'on-negative',
    placement: 'floating',
    endpoint: endpoint(),
  }))
    w.setAttribute(k, v);
  setLang(w);
  document.body.append(w);
};
document.addEventListener('user-reactions:dismissed', (e) => entry('ev', `event dismissed  reason=${(e as CustomEvent).detail.reason}`, (e as CustomEvent).detail));

// Host reactions to widget events: after a thumbs down, the chat offers a new answer
// and the help article offers a way to contact support.
document.addEventListener('user-reactions:rated', (e) => {
  const d = (e as CustomEvent).detail;
  entry('ev', `event rated  score=${d.score} subject=${d.subject}`, d);
  const host = (e.target as HTMLElement).closest('.assistant, .kb');
  if (!host) return;
  host.querySelector('.regen, .support')?.remove();
  if (d.score !== 0) return;
  if (host.matches('.assistant')) {
    const regen = document.createElement('button');
    regen.className = 'regen';
    regen.textContent = '↻ Try a different answer';
    regen.onclick = () => regen.replaceWith('(The host app would regenerate the answer here.)');
    host.append(regen);
  } else {
    const p = document.createElement('p');
    p.className = 'support';
    p.innerHTML = 'Still stuck? <a href="#" onclick="return false">Contact support</a> and we will help you reset it.';
    host.append(p);
  }
});
document.addEventListener('user-reactions:commented', (e) => entry('ev', 'event commented', (e as CustomEvent).detail));
document.addEventListener('user-reactions:error', (e) => entry('err', 'event error', (e as CustomEvent).detail));

// Requests received by the mock endpoint (pushed by the Vite dev server).
import.meta.hot?.on('ur:mock', (d: { status: number; path: string; projectKey: string; body: unknown; errors: string[] }) =>
  entry(`s${String(d.status)[0]}`, `${d.status} POST ${d.path}  X-Project-Key: ${d.projectKey}`, d.errors.length ? { body: d.body, errors: d.errors } : d.body),
);
