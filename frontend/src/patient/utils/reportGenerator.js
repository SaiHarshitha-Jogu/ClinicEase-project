// Lightweight PDF report generator for medication history using jsPDF and autoTable
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function formatDate(timestampLike) {
  try {
    if (!timestampLike) return "";
    if (typeof timestampLike?.toDate === "function") {
      return timestampLike.toDate().toLocaleString();
    }
    if (timestampLike?.seconds) {
      return new Date(timestampLike.seconds * 1000).toLocaleString();
    }
    const asDate = new Date(timestampLike);
    if (!isNaN(asDate.getTime())) return asDate.toLocaleString();
    return String(timestampLike);
  } catch (_) {
    return String(timestampLike);
  }
}

async function loadImageAsDataUrl(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

export async function generateMedicationReport({ userDetails, medicines, latestProblem, aiAnalysis }) {
  const doc = new jsPDF({ unit: "pt" });

  const orgName = "ClinicEase";
  const title = "Medication History Report";
  const generatedOn = new Date().toLocaleString();

  // Header with optional logo
  let yHeaderBase = 40;
  const logoDataUrl = await loadImageAsDataUrl("/company_logo.jpg");
  if (logoDataUrl) {
    try {
      // Draw logo at top-right
      const pageWidth = doc.internal.pageSize.getWidth();
      const logoWidth = 80;
      const logoHeight = 80;
      doc.addImage(logoDataUrl, "JPEG", pageWidth - logoWidth - 40, 30, logoWidth, logoHeight);
    } catch (_) {
      // ignore logo errors
    }
  }
  doc.setFontSize(18);
  doc.text(orgName, 40, yHeaderBase);
  doc.setFontSize(14);
  doc.text(title, 40, yHeaderBase + 25);
  doc.setFontSize(10);
  doc.text(`Generated on: ${generatedOn}`, 40, yHeaderBase + 42);

  // Patient details
  const patientLines = [
    `Patient: ${userDetails?.firstName || userDetails?.fullName || "Unknown"}`,
    userDetails?.email ? `Email: ${userDetails.email}` : null,
    userDetails?.age ? `Age: ${userDetails.age}` : null,
    userDetails?.gender ? `Gender: ${userDetails.gender}` : null,
  ].filter(Boolean);

  let y = 120;
  doc.setFontSize(12);
  patientLines.forEach((line) => {
    doc.text(line, 40, y);
    y += 16;
  });

  // Consider only the latest three prescriptions for the report
  const latestThree = (medicines || []).slice(0, 3);

  // Helper to filter out artifact rows (image/file names, labels)
  const isArtifactRow = (text) => {
    const name = String(text || "").trim();
    if (!name) return false;
    const hasExt = /\.(jpg|jpeg|png|gif|pdf)$/i.test(name);
    const looksLikeArtifact = /(prescription|label)/i.test(name);
    return hasExt || looksLikeArtifact;
  };

  // Summary
  const totalPrescriptions = latestThree.length;
  const totalMedicines = latestThree.reduce((sum, m) => {
    const meds = (m?.medicines || []).filter((x) => !isArtifactRow(x?.name));
    return sum + meds.length;
  }, 0);
  const firstDate = latestThree?.[latestThree.length - 1]?.createdAt;
  const lastDate = latestThree?.[0]?.createdAt;
  const summary = [
    `Total prescriptions: ${totalPrescriptions}`,
    `Total medicines: ${totalMedicines}`,
    `Coverage: ${firstDate ? formatDate(firstDate) : "-"} to ${lastDate ? formatDate(lastDate) : "-"}`,
  ];

  y += 8;
  doc.setFont(undefined, "bold");
  doc.text("Summary", 40, y);
  doc.setFont(undefined, "normal");
  y += 18;
  summary.forEach((line) => {
    doc.text(line, 40, y);
    y += 14;
  });

  // Patient problem / condition
  if (latestProblem) {
    doc.setFont(undefined, "bold");
    doc.text("Reported Problem", 40, y);
    doc.setFont(undefined, "normal");
    const problemText = String(latestProblem);
    const wrapped = doc.splitTextToSize(problemText, doc.internal.pageSize.getWidth() - 80);
    y += 18;
    wrapped.forEach((line) => {
      doc.text(line, 40, y);
      y += 14;
    });
    y += 6;
  }

  // AI analysis section (plain text)
  if (aiAnalysis) {
    doc.setFont(undefined, "bold");
    doc.text("AI-supported Clinical Notes", 40, y);
    doc.setFont(undefined, "normal");
    const analysisText = String(aiAnalysis);
    const wrapped = doc.splitTextToSize(analysisText, doc.internal.pageSize.getWidth() - 80);
    y += 18;
    wrapped.forEach((line) => {
      if (y > doc.internal.pageSize.getHeight() - 60) {
        doc.addPage();
        y = 60;
      }
      doc.text(line, 40, y);
      y += 14;
    });
    y += 6;
  }

  // Table per prescription (latest three only)
  latestThree.forEach((prescription) => {
    const header = `Prescription #${(prescription.id || "").slice(-4)} — ${formatDate(prescription.createdAt)}`;
    const metaRight = `Prescriber: ${prescription.prescribedBy || prescription.doctorName || "-"}`;

    const startY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 24 : y + 12;

    // Meta line above table
    doc.setFontSize(10);
    doc.setTextColor(100);
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.text(metaRight, pageWidth - 40, startY - 8, { align: "right" });
    doc.setTextColor(0);

    autoTable(doc, {
      startY,
      margin: { left: 40, right: 40 },
      head: [[header, "", "", ""]],
      headStyles: { fillColor: [33, 150, 243], textColor: 255, halign: "left" },
      theme: "striped",
      body: [
        ["Medicine", "Dosage", "Frequency/Timing", "Instructions"],
        ...((prescription.medicines || []).filter((m) => !isArtifactRow(m?.name))).map((m) => [
          m?.name || "-",
          m?.dosage || "-",
          [m?.frequency, m?.timing].filter(Boolean).join(" · ") || "-",
          m?.instructions || "-",
        ]),
      ],
      styles: { fontSize: 10, cellPadding: 6 },
      columnStyles: {
        0: { cellWidth: 150 },
        1: { cellWidth: 100 },
        2: { cellWidth: 140 },
        3: { cellWidth: "auto" },
      },
      didDrawPage: () => {
        // Footer
        const pw = doc.internal.pageSize.getWidth();
        const ph = doc.internal.pageSize.getHeight();
        doc.setFontSize(9);
        doc.text(
          `Confidential — For patient use only | Page ${doc.internal.getNumberOfPages()}`,
          pw / 2,
          ph - 20,
          { align: "center" }
        );
      },
    });
  });

  const safeName = (userDetails?.firstName || userDetails?.fullName || "patient").replace(/[^a-z0-9\-_]+/gi, "_");
  const filename = `${safeName}_Medication_Report.pdf`;

  try {
    // Primary attempt
    doc.save(filename);
  } catch (_) {
    // Fallback for browsers that restrict async-initiated downloads
    try {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {
      // swallow; caller will show error toast if thrown earlier
    }
  }
}

