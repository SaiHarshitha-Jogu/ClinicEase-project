import { useEffect, useMemo, useRef, useState, useContext } from "react";
import { generateAssistantReply } from "./geminiClient";
import { defaultFaqs } from "./faqs";
import { addReminder, deleteReminder, listReminders, toggleReminder } from "./reminders";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function AIAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your ClinicEase AI Assistant. Ask me anything." },
  ]);
  const [busy, setBusy] = useState(false);
  const [reminders, setReminders] = useState([]);
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderWhen, setReminderWhen] = useState("");
  const [userContext, setUserContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const scrollerRef = useRef(null);

  useEffect(() => {
    setReminders(listReminders());
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchUserContext(user.uid);
      } else {
        setUserContext(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserContext = async (userId) => {
    try {
      if (userId) {
        // Get user details
        const userDoc = await getDoc(doc(db, "Users", userId));
        const userData = userDoc.exists() ? userDoc.data() : null;

        // Get appointments
        const appointmentsRef = collection(db, "Appointments");
        const appointmentsQuery = query(appointmentsRef, where("userId", "==", userId));
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointments = appointmentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Robustly parse appointment date (supports Firestore Timestamp, ISO YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY) with optional 12h time like "02:00 PM"
        const parseAppointmentDate = (apt) => {
          try {
            // If Firestore Timestamp
            if (apt?.date && typeof apt.date === 'object' && typeof apt.date.toDate === 'function') {
              const tsDate = apt.date.toDate();
              if (!isNaN(tsDate.getTime())) return tsDate;
            }

            const dateStr = String(apt.date || '').trim();
            const timeStr = String(apt.time || '12:00 PM').trim();

            // Parse 12h time
            const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            let hours = 12, minutes = 0;
            if (timeMatch) {
              hours = parseInt(timeMatch[1], 10);
              minutes = parseInt(timeMatch[2], 10);
              const meridiem = timeMatch[3].toUpperCase();
              if (meridiem === 'PM' && hours !== 12) hours += 12;
              if (meridiem === 'AM' && hours === 12) hours = 0;
            }

            // ISO YYYY-MM-DD
            const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
              const yyyy = parseInt(isoMatch[1], 10);
              const mm = parseInt(isoMatch[2], 10);
              const dd = parseInt(isoMatch[3], 10);
              return new Date(yyyy, mm - 1, dd, hours, minutes, 0, 0);
            }

            // Slash formats
            const [a, b, c] = dateStr.split('/').map(s => parseInt(s, 10));
            if (!a || !b || !c) return new Date(NaN);

            // Determine order by numeric ranges
            let mm = a, dd = b, yyyy = c;
            if (a > 12 && b <= 12) { // DD/MM/YYYY
              dd = a; mm = b; yyyy = c;
            } else if (b > 12 && a <= 12) { // MM/DD/YYYY
              mm = a; dd = b; yyyy = c;
            } else if (a <= 12 && b <= 12) {
              // Default to DD/MM/YYYY to match dashboard display
              dd = a; mm = b; yyyy = c;
            }
            // Construct in local time to match UI expectations
            return new Date(yyyy, mm - 1, dd, hours, minutes, 0, 0);
          } catch (_) {
            return new Date(NaN);
          }
        };

        // Get medicines
        const medicinesRef = collection(db, "medicines");
        const medicinesQuery = query(medicinesRef, where("userId", "==", userId));
        const medicinesSnapshot = await getDocs(medicinesQuery);
        const medicines = medicinesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Process recent medicines - sort by creation date first
        const sortedMedicines = medicines.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
        
        const recentMedicines = sortedMedicines.slice(0, 3).flatMap(med => 
          med.medicines ? med.medicines.map(m => m.name) : []
        );
        
        // Debug logging
        console.log("AI Assistant - Total medicines found:", medicines.length);
        console.log("AI Assistant - Recent medicines:", recentMedicines);
        console.log("AI Assistant - Medicine structure sample:", medicines.slice(0, 1));

        // Get upcoming appointments with correct parsing and ordering
        const now = new Date();
        let upcomingAppointments = appointments
          .map(apt => ({ ...apt, __when: parseAppointmentDate(apt) }))
          .filter(apt => apt.__when instanceof Date && !isNaN(apt.__when.getTime()) && apt.__when > now)
          .sort((a, b) => a.__when - b.__when)
          .map(({ __when, ...rest }) => ({
            ...rest,
            displayDate: new Intl.DateTimeFormat('en-GB').format(__when) // DD/MM/YYYY
          }));
        
        // Secondary pass: if none found, try alternate day/month interpretation for slash dates
        if (upcomingAppointments.length === 0 && appointments.length > 0) {
          const altParsed = appointments.map(apt => {
            const dateStr = String(apt.date || '').trim();
            const timeStr = String(apt.time || '12:00 PM').trim();
            // Swap MM/DD <-> DD/MM if slash format
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const swapped = `${parts[1]}/${parts[0]}/${parts[2]}`;
              // Reuse time parsing
              const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
              let hh = 12, mm = 0;
              if (m) {
                hh = parseInt(m[1], 10);
                mm = parseInt(m[2], 10);
                const mer = m[3].toUpperCase();
                if (mer === 'PM' && hh !== 12) hh += 12;
                if (mer === 'AM' && hh === 12) hh = 0;
              }
              const [sm, sd, sy] = swapped.split('/').map(s => parseInt(s, 10));
              const alt = new Date(sy, sm - 1, sd, hh, mm, 0, 0);
              return { ...apt, __when: alt };
            }
            return { ...apt, __when: new Date(NaN) };
          });
          upcomingAppointments = altParsed
            .filter(apt => apt.__when instanceof Date && !isNaN(apt.__when.getTime()) && apt.__when > now)
            .sort((a, b) => a.__when - b.__when)
            .map(({ __when, ...rest }) => ({
              ...rest,
              displayDate: new Intl.DateTimeFormat('en-GB').format(__when)
            }));
        }
        
        // Debug logging for appointments
        console.log("AI Assistant - All appointments:", appointments);
        console.log("AI Assistant - Upcoming appointments:", upcomingAppointments);
        console.log("AI Assistant - Current date:", now.toISOString());

        setUserContext({
          name: userData?.firstName || 'User',
          appointmentCount: appointments.length,
          upcomingCount: upcomingAppointments.length,
          prescriptionCount: medicines.length,
          recentAppointments: appointments.slice(0, 3),
          upcomingAppointments: upcomingAppointments.slice(0, 5), // Add upcoming appointments
          recentMedicines: recentMedicines.slice(0, 5),
          allMedicines: sortedMedicines // Include all medicines for debugging
        });
      }
    } catch (error) {
      console.error("Error fetching user context:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const system = useMemo(() => (
    "You are ClinicEase AI Assistant. Be concise, friendly, and practical. " +
    "Use the provided user context to give personalized responses. " +
    "For appointments: provide specific dates, times, and details when available. " +
    "For medicines: ONLY reference medicines that are explicitly listed in the user context. Do not make up medicine names. " +
    "If you don't have specific medicine information, say so clearly. " +
    "For reminders, you can suggest dates/times. Add short steps when helpful. " +
    "If the user asks for medical advice, add a brief disclaimer and suggest consulting a clinician. " +
    "Always personalize responses using the user's actual data when available."
  ), []);

  async function send() {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    try {
      // Local deterministic handling for next/upcoming appointment questions
      const lower = userMsg.content.toLowerCase();
      const isNextAppointmentQ = lower.includes('next appointment') || lower.includes('upcoming appointment');
      if (isNextAppointmentQ && userContext) {
        const upcoming = Array.isArray(userContext.upcomingAppointments) ? userContext.upcomingAppointments : [];
        let replyText = '';
        if (upcoming.length === 0) {
          replyText = 'You do not have any upcoming appointments. You can book one from the dashboard.';
        } else {
          const next = upcoming[0] || {};
          const datePart = next.displayDate ? `${next.displayDate}` : (next.date ? `${next.date}` : 'date not specified');
          const timePart = next.time ? `${next.time}` : 'time not specified';
          const problemPart = next.problem ? ` for ${next.problem}` : '';
          replyText = `Your next appointment is on ${datePart} at ${timePart}${problemPart}.`;
        }
        setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
        return;
      }
      const reply = await generateAssistantReply({ prompt: userMsg.content, system, userContext });
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("AI response error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I couldn't respond right now. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  async function askFaq(q) {
    const userMsg = { role: "user", content: q };
    setMessages(prev => [...prev, userMsg]);
    setBusy(true);
    try {
      const reply = await generateAssistantReply({ prompt: q, system, userContext });
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      console.error("FAQ response error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Unable to fetch an answer right now. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function onAddReminder(e) {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderWhen) return;
    const created = addReminder({ title: reminderTitle.trim(), when: new Date(reminderWhen).toISOString() });
    setReminders(prev => [...prev, created]);
    setReminderTitle("");
    setReminderWhen("");
  }

  function onToggleReminder(id, done) {
    const updated = toggleReminder(id, done);
    setReminders(prev => prev.map(r => r.id === id ? updated : r));
  }

  function onDeleteReminder(id) {
    deleteReminder(id);
    setReminders(prev => prev.filter(r => r.id !== id));
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>ClinicEase AI Assistant</h1>
          <p style={{ margin: "20px 0", color: "#475569", fontSize: 16 }}>Loading your personalized assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: "#0f172a" }}>ClinicEase AI Assistant</h1>
        <p style={{ margin: "6px 0 0", color: "#475569", fontSize: 14 }}>
          Quick answers, reminders, and practical help. Powered by Google Gemini.
          {userContext && <span style={{ color: "#059669", fontWeight: 500 }}> • Personalized for {userContext.name}</span>}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, display: "flex", flexDirection: "column", height: "75vh", background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
          <div ref={scrollerRef} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 14, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "80%",
                padding: "12px 14px",
                borderRadius: 14,
                background: m.role === "user" ? "#2563eb" : "#f8fafc",
                color: m.role === "user" ? "white" : "#0f172a",
                fontSize: 15,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                boxShadow: m.role === "user" ? "0 1px 2px rgba(37,99,235,0.25)" : "0 1px 2px rgba(0,0,0,0.06)"
              }}>{m.content}</div>
            </div>
          ))}
          {busy && <div style={{ fontSize: 13, color: "#64748b" }}>Assistant is typing…</div>}
          </div>
          <div style={{ display: "flex", padding: 14, gap: 10, borderTop: "1px solid #e5e7eb", background: "#fcfdff", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your visit, meds, or general help…"
              style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", fontSize: 15 }}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
            />
            <button onClick={send} disabled={busy} style={{ background: busy ? "#93c5fd" : "#2563eb", color: "white", borderRadius: 10, padding: "12px 16px", border: 0, fontWeight: 600 }}>
              Send
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Debug Panel - Remove this in production */}
          {userContext && (
            <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#fef3c7", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
              <h3 style={{ margin: 0, marginBottom: 10, fontSize: 16, color: "#92400e" }}>Debug Info</h3>
              <div style={{ fontSize: 12, color: "#92400e", fontFamily: "monospace" }}>
                <div>Prescriptions: {userContext.prescriptionCount}</div>
                <div>Recent Medicines: {userContext.recentMedicines?.join(', ') || 'None'}</div>
                <div>Total Appointments: {userContext.appointmentCount}</div>
                <div>Upcoming Appointments: {userContext.upcomingCount}</div>
                <div>Next Appointment: {userContext.upcomingAppointments?.[0] ? `${userContext.upcomingAppointments[0].date} at ${userContext.upcomingAppointments[0].time}` : 'None'}</div>
              </div>
            </section>
          )}

          <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <h3 style={{ margin: 0, marginBottom: 10, fontSize: 18, color: "#0f172a" }}>Quick FAQs</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {defaultFaqs.map((f, idx) => (
                <button key={idx} onClick={() => askFaq(f.q)} style={{ border: "1px solid #e5e7eb", background: "#f8fafc", color: "#0f172a", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>
                  {f.q}
                </button>
              ))}
            </div>
          </section>

          <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <h3 style={{ margin: 0, marginBottom: 10, fontSize: 18, color: "#0f172a" }}>Reminders</h3>
            <form onSubmit={onAddReminder} style={{ display: "grid", gridTemplateColumns: "1fr 180px auto", gap: 10 }}>
              <input value={reminderTitle} onChange={e => setReminderTitle(e.target.value)} placeholder="Reminder title" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 14 }} />
              <input value={reminderWhen} onChange={e => setReminderWhen(e.target.value)} type="datetime-local" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", fontSize: 14 }} />
              <button type="submit" style={{ background: "#10b981", color: "white", borderRadius: 8, padding: "10px 14px", border: 0, fontWeight: 600 }}>Add</button>
            </form>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {reminders.length === 0 && <div style={{ color: "#64748b", fontSize: 14 }}>No reminders yet.</div>}
              {reminders.map(r => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={!!r.done} onChange={e => onToggleReminder(r.id, e.target.checked)} />
                  <div>
                    <div style={{ fontWeight: 600, textDecoration: r.done ? "line-through" : "none", color: "#0f172a" }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{new Date(r.when).toLocaleString()}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                  <button onClick={() => onDeleteReminder(r.id)} style={{ color: "#ef4444", background: "transparent", border: 0, cursor: "pointer", fontWeight: 600 }}>Delete</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


 