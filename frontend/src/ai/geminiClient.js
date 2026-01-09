import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export async function generateAssistantReply({ prompt, system, userContext = null }) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  let contextInfo = "";
  if (userContext) {
    contextInfo = `
User Context:
- Name: ${userContext.name || 'Not provided'}
- Total Appointments: ${userContext.appointmentCount || 0}
- Upcoming Appointments: ${userContext.upcomingCount || 0}
- Total Prescriptions: ${userContext.prescriptionCount || 0}
- Recent Appointments: ${userContext.recentAppointments ? userContext.recentAppointments.slice(0, 3).map(apt => `${apt.date} - ${apt.problem || 'No problem specified'}`).join(', ') : 'None'}
- Upcoming Appointments: ${userContext.upcomingAppointments ? userContext.upcomingAppointments.slice(0, 5).map(apt => `${apt.date} at ${apt.time || 'No time specified'} - ${apt.problem || 'No problem specified'}`).join(', ') : 'None'}
- Recent Medicines: ${userContext.recentMedicines ? userContext.recentMedicines.slice(0, 5).join(', ') : 'None'}

IMPORTANT: 
1. Never invent names, dates, doctors, or appointment details. Use ONLY the data above.
2. If there are NO upcoming appointments, clearly say: "You do not have any upcoming appointments. You can book one from the dashboard."
3. If some fields are missing (doctor, time, problem), omit them rather than fabricating.
4. Only use the exact medicine names provided above. Do not make up medicine names.
5. If the user asks about information not listed above, say you don't have that info and suggest checking the dashboard.

`;
  }
  
  // Deterministic guardrails for next appointment queries to avoid hallucinations
  if (userContext && typeof prompt === 'string') {
    const p = prompt.toLowerCase();
    const asksNextAppointment = p.includes('next appointment') || p.includes('upcoming appointment');
    if (asksNextAppointment) {
      const upcoming = Array.isArray(userContext.upcomingAppointments) ? userContext.upcomingAppointments : [];
      if (upcoming.length === 0) {
        return 'You do not have any upcoming appointments. You can book one from the dashboard.';
      }
      const next = upcoming[0] || {};
      const datePart = next.date ? `${next.date}` : 'date not specified';
      const timePart = next.time ? `${next.time}` : 'time not specified';
      const doctor = next.doctor || next.doctorName || '';
      const doctorPart = doctor ? ` with ${doctor}` : '';
      const problemPart = next.problem ? ` for ${next.problem}` : '';
      return `Your next appointment is on ${datePart} at ${timePart}${doctorPart}${problemPart}.`;
    }
  }

  const fullPrompt = system ? `${system}${contextInfo}\n\nUser: ${prompt}` : prompt;
  const result = await model.generateContent(fullPrompt);
  return result.response.text();
}

export async function answerFaq(question) {
  const system = "You are ClinicEase AI Assistant. Be concise, friendly, and practical. Provide clear steps when helpful. If medical advice is requested, include a brief disclaimer and recommend consulting a clinician for decisions.";
  return generateAssistantReply({ prompt: question, system });
}


