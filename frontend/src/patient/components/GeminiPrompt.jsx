import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

export async function fetchGeminiResponse(promptText) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Read the following description of a medical problem and translate to professional or medical jargon if necessary without exaggerating the problem. Convert terms like "sugar" to "diabetes". Only translate what the patient has said and express it as [translated text] followed by the original statement: ${promptText}`;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error:", error);
    return "Oops! Something went wrong.";
  }
}

// New function to analyze medicine usage and effects
export async function fetchMedicineAnalysis(medicineList) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const prompt = `Analyze these medicines: ${medicineList.join(", ")}

Format your response exactly like this example, replacing the content with appropriate analysis:

<div class="medicine-section">
<h2>CALPOL</h2>
<div class="medicine-details">
<p><b>Category/Type:</b> Description</p>
<p><b>Primary Uses:</b> Description</p>
<p><b>Common Side Effects:</b> Description</p>
<p><b>Important Interactions:</b> Description with <u>warnings like this</u></p>
<p><b>Precautions:</b> Description with <u>warnings</u> and <i>notes like this</i></p>
</div>
</div>

Important:
1. Keep this exact HTML structure
2. Use <b> for bold text
3. Use <u> for warnings
4. Use <i> for notes
5. End with: <p class="disclaimer"><i>Disclaimer text here</i></p>`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error:", error);
    return "Error analyzing medicines. Please try again.";
  }
}

// AI analysis tailored for the PDF report
export async function fetchReportAnalysis({ patient, latestProblem, medicineNames }) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const profile = [
      patient?.firstName ? `Name: ${patient.firstName}` : null,
      patient?.age ? `Age: ${patient.age}` : null,
      patient?.gender ? `Gender: ${patient.gender}` : null,
    ].filter(Boolean).join(", ");

    const prompt = `You are a careful, practical clinical assistant with a focus on dentistry. Given:
Patient: ${profile || "Unknown"}
Reported problem: ${latestProblem || "Not provided"}
Medicines: ${Array.isArray(medicineNames) && medicineNames.length ? medicineNames.join(", ") : "None"}

Produce a concise, highly practical analysis for the report. Output MUST be plain text (no markdown, no html). Focus on the medicines ONLY ONCE EACH (unique list), do not discuss duplicates. Structure exactly like this and keep it tight:

AI-supported Medicine Guidance
For each medicine (one block per medicine):
<Medicine Name>
- Uses: (primary clinical uses, dental relevance when applicable)
- Class/Mechanism: (short, lay-friendly)
- Common Side Effects: (3-5)
- Serious Warnings: (2-4, only if relevant)
- Key Interactions: (2-4 that matter in primary care)
- Patient Tips: (2-4 helpful, practical tips)

Overall Notes
- Interactions to watch: (2-4 lines, if any across the set)
- When to seek care: (clear, practical cues; no exaggeration)

Rules:
- Stay under 2200 characters total.
- Be specific to the actual medicine names provided.
- No markdown, no HTML, plain text only.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error("Error:", error);
    return "AI analysis unavailable at the moment.";
  }
}


