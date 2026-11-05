/**
 * Practice reminders, Duolingo style: one a day at the time he chose, written from where he is
 * ("Your 6-day streak is waiting", "Bass clef is due for review"), and skipped on a day he has
 * already reached his goal.
 *
 * In the iPhone app they are real local notifications, scheduled a week ahead and rewritten each
 * time the app opens or he practises. On the web a page cannot wake itself, so the reminder only
 * shows while the app is open (or installed and running in the background).
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from './input';
import { dueSkills, SKILLS } from './skills';
import { dayKey, streak, today } from './stats';

const IDS = [101, 102, 103, 104, 105, 106, 107];

function message(): { title: string; body: string } {
  const days = streak().days;
  const due = dueSkills()[0];
  const skill = due ? SKILLS.find(k => k.id === due.id)?.name : undefined;
  if (days >= 2) return { title: `Keep your ${days}-day streak going`, body: skill ? `Ten minutes today. ${skill} is due for review.` : 'Ten minutes at the piano keeps it alive.' };
  if (skill) return { title: 'Time for the piano', body: `${skill} is due for review. Today’s session takes about ten minutes.` };
  return { title: 'Time for the piano', body: 'Today’s session is ready: about ten minutes, made for you.' };
}

const at = (time: string, plusDays: number) => {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + plusDays);
  d.setHours(h, m, 0, 0);
  return d;
};

/** Writes the next week of reminders (or clears them when `time` is null). */
export async function scheduleReminders(time: string | null, goalMinutes: number) {
  if (!isNative) { webTime = time; webGoal = goalMinutes; return; }
  try {
    await LocalNotifications.cancel({ notifications: IDS.map(id => ({ id })) });
    if (!time) return;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return;
    const doneToday = today().sec >= goalMinutes * 60;
    const notifications = IDS.map((id, i) => ({ id, ...message(), schedule: { at: at(time, i) } }))
      .filter((n, i) => n.schedule.at.getTime() > Date.now() && !(i === 0 && doneToday));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch { /* plugin unavailable */ }
}

// ---------- Web: only while the page is alive ----------

let webTime: string | null = null;
let webGoal = 10;
let shownOn = '';

/** Asks the browser for permission to show reminders. */
export async function allowWebReminders(): Promise<boolean> {
  if (isNative) return true;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

export function startWebReminders() {
  if (isNative) return () => {};
  const id = window.setInterval(async () => {
    if (!webTime || shownOn === dayKey() || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (Date.now() < at(webTime, 0).getTime() || today().sec >= webGoal * 60) return;
    shownOn = dayKey();
    const m = message();
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.showNotification(m.title, { body: m.body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: 'practice' });
      else new Notification(m.title, { body: m.body });
    } catch { /* not allowed here */ }
  }, 60_000);
  return () => window.clearInterval(id);
}
