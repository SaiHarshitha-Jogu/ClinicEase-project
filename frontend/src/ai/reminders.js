// Simple reminders storage with localStorage; if Firestore is available, we can extend later

const STORAGE_KEY = "clinicease_assistant_reminders_v1";

function readLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(reminders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function listReminders() {
  return readLocal();
}

export function addReminder({ title, when }) {
  const reminders = readLocal();
  const reminder = {
    id: crypto.randomUUID(),
    title,
    when, // ISO string
    createdAt: new Date().toISOString(),
    done: false,
  };
  reminders.push(reminder);
  writeLocal(reminders);
  return reminder;
}

export function toggleReminder(id, done) {
  const reminders = readLocal();
  const updated = reminders.map(r => r.id === id ? { ...r, done } : r);
  writeLocal(updated);
  return updated.find(r => r.id === id) || null;
}

export function deleteReminder(id) {
  const reminders = readLocal();
  const updated = reminders.filter(r => r.id !== id);
  writeLocal(updated);
  return true;
}



