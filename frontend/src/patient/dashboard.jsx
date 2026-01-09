import React, { useEffect, useState, useRef, useContext } from "react";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Navbar1 from "./navbar1";
import { toast } from "react-toastify";
import { fetchMedicineAnalysis } from '/src/patient/components/GeminiPrompt.jsx';

import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import "./dashboard.css";  // Ensure styles are properly applied
import { ThemeContext } from "../context/ThemeContext";
import { generateMedicationReport } from "./utils/reportGenerator";
import { fetchReportAnalysis } from "./components/GeminiPrompt";




function Dashboard() {
  const { darkMode } = useContext(ThemeContext);
  const [userDetails, setUserDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysisResult, setAnalysisResult] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointmentDates, setAppointmentDates] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:3000';
  const [approvedXrays, setApprovedXrays] = useState([]);

  const [xrayResults, setXrayResults] = useState([]);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          setLoading(true);

          // Fetch user details
          const docRef = doc(db, "Users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserDetails(docSnap.data());
            // Fetch appointments after getting user details
            fetchAppointments(user.uid);
          } else {
            console.log("No user data found");
          }

          // Fetch medicines
          const medicinesRef = collection(db, "medicines");
          const q = query(medicinesRef, where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          const medicinesList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          medicinesList.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
          setMedicines(medicinesList);

          // Fetch approved X-rays
          const xrayQ = query(
            collection(db, "XrayAnalyses"),
            where("status", "==", "approved"),
            where("userId", "==", user.uid)
          );
          const xraySnap = await getDocs(xrayQ);
          setApprovedXrays(xraySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch X-ray results
          const xrayResultsQ = query(
            collection(db, "XrayAnalyses"),
            where("patientId", "==", user.uid),
            where("status", "==", "approved")
          );
          const xrayResultsSnap = await getDocs(xrayResultsQ);
          setXrayResults(xrayResultsSnap.docs.map(doc => doc.data()));

        } catch (error) {
          console.error("Error fetching data:", error);
          toast.error("Error loading data. Please try again.");
        } finally {
          setLoading(false);
        }
      } else {
        // Clear all data when user is not signed in
        setUserDetails(null);
        setAppointments([]);
        setMedicines([]);
        setApprovedXrays([]);
        setXrayResults([]);
        setLoading(false);
        console.log("No user signed in yet.");
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchAppointments = async (userId) => {
    try {
      const appointmentsRef = collection(db, "Appointments");
      const q = query(appointmentsRef, where("userId", "==", userId));
      const querySnapshot = await getDocs(q);

      const appointmentsList = querySnapshot.docs.map(d => {
        const data = d.data();
        const dateVal = data.date;
        const timeStr = String(data.time || '12:00 PM').trim();
        // parse 12h time
        const m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        let hh = 12, mm = 0;
        if (m) {
          hh = parseInt(m[1], 10);
          mm = parseInt(m[2], 10);
          const mer = m[3].toUpperCase();
          if (mer === 'PM' && hh !== 12) hh += 12;
          if (mer === 'AM' && hh === 12) hh = 0;
        }
        // support Firestore Timestamp or ISO YYYY-MM-DD or slash formats
        let when;
        if (dateVal && typeof dateVal === 'object' && typeof dateVal.toDate === 'function') {
          const base = dateVal.toDate();
          when = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
        } else if (typeof dateVal === 'string') {
          const s = dateVal.trim();
          const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (iso) {
            const yyyy = parseInt(iso[1], 10);
            const mo = parseInt(iso[2], 10);
            const da = parseInt(iso[3], 10);
            when = new Date(yyyy, mo - 1, da, hh, mm, 0, 0);
          } else {
            const parts = s.split('/').map(x => parseInt(x, 10));
            if (parts.length === 3) {
              let dd = parts[0], mo = parts[1], yyyy = parts[2];
              // assume DD/MM/YYYY display format
              when = new Date(yyyy, mo - 1, dd, hh, mm, 0, 0);
            } else {
              when = new Date(NaN);
            }
          }
        } else {
          when = new Date(NaN);
        }
        const displayDate = when instanceof Date && !isNaN(when.getTime())
          ? new Intl.DateTimeFormat('en-GB').format(when)
          : String(dateVal || 'Invalid date');
        return {
          id: d.id,
          ...data,
          __when: when,
          displayDate
        };
      });

      // Create array of appointment dates for calendar
      const dates = appointmentsList
        .filter(apt => apt.__when instanceof Date && !isNaN(apt.__when.getTime()))
        .map(apt => apt.__when);
      setAppointmentDates(dates);

      setAppointments(appointmentsList);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  // Function to generate calendar days for the current month
  const generateCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push({ dayNumber: '', isToday: false, hasAppointment: false, isSelected: false });
    }

    // Add days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const currentDate = new Date(year, month, i);
      const hasAppointment = appointmentDates.some(
        aptDate => aptDate.toDateString() === currentDate.toDateString()
      );
      const isToday = currentDate.toDateString() === new Date().toDateString();
      const isSelected = currentDate.toDateString() === selectedDate.toDateString();

      days.push({
        dayNumber: i,
        date: currentDate,
        isToday,
        hasAppointment,
        isSelected,
        appointmentCount: appointments.filter(apt =>
          new Date(apt.date).toDateString() === currentDate.toDateString()
        ).length
      });
    }

    return days;
  };

  // Update calendar days when current month or appointments change
  useEffect(() => {
    setCalendarDays(generateCalendarDays(currentMonth));
  }, [currentMonth, appointments, selectedDate]);

  // Navigation functions
  const previousMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentMonth(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentMonth(newDate);
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  // Get appointments for selected date
  const selectedDateAppointments = appointments.filter(apt =>
    new Date(apt.date).toDateString() === selectedDate.toDateString()
  );

  async function handlePay(appointment) {
    try {
      const amountInPaise = Math.max(100, Math.round((appointment.amount || 500) * 100));
      // 1) Create order on backend
      const orderRes = await fetch(`${apiBase}/create-razorpay-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: `apt_${appointment.id}`,
          notes: {
            appointmentId: appointment.id,
            userId: auth.currentUser?.uid || ''
          }
        })
      });
      if (!orderRes.ok) {
        const message = await orderRes.text();
        console.error('Order API error:', orderRes.status, message);
        toast.error('Payment service error. Please try again.');
        return;
      }
      const order = await orderRes.json();
      if (!order?.id) {
        toast.error('Unable to create payment order.');
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || window.__RAZORPAY_KEY_ID__,
        amount: order.amount,
        currency: order.currency,
        name: 'ClinicEase',
        description: `Payment for appointment on ${appointment.date} at ${appointment.time}`,
        order_id: order.id,
        handler: function (response) {
          toast.success('Payment successful.');
        },
        prefill: {
          name: userDetails?.firstName || '',
          email: userDetails?.email || '',
        },
        notes: order.notes || {},
        theme: { color: '#3399cc' }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function () {
        toast.error('Payment failed.');
      });
      rzp.open();
    } catch (e) {
      console.error('Payment error:', e);
      toast.error('Payment initialization failed.');
    }
  }

  // Format current month for display
  const formattedMonth = currentMonth.toLocaleDateString('default', {
    month: 'long',
    year: 'numeric'
  });

  async function handleMedicineAnalysis() {
    if (medicines.length === 0) {
      toast.error("No medicines found for analysis.");
      return;
    }

    try {
      const medicineNames = medicines.flatMap(med => med.medicines.map(m => m.name));
      const result = await fetchMedicineAnalysis(medicineNames);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Error during medicine analysis:', error);
      toast.error('Error analyzing medicines. Please try again.');
    }
  }


  function goToSpeechToText() {
    navigate("/speechtotext");
  }

  function goToOCRModule() {
    navigate("/prescription-ocr");
  }

  function goToAIAssistant() {
    navigate("/assistant");
  }

  async function handleGenerateReport() {
    if (!medicines || medicines.length === 0) {
      toast.error("No prescriptions found to generate report.");
      return;
    }
    try {
      // Derive the latest patient problem from appointments
      let latestProblem = "";
      if (appointments && appointments.length > 0) {
        const sorted = [...appointments].sort((a, b) => {
          const aTs = a?.createdAt?.seconds ?? 0;
          const bTs = b?.createdAt?.seconds ?? 0;
          return bTs - aTs;
        });
        latestProblem = sorted[0]?.problem || "";
      }

      // Build unique medicine names list from latest three prescriptions only
      const latestThree = medicines.slice(0, 3);
      const allNames = latestThree.flatMap((p) => (p?.medicines || []).map((m) => m?.name).filter(Boolean));
      const medicineNames = Array.from(new Set(allNames));

      // Fetch concise AI analysis for inclusion in the PDF
      let aiAnalysis = "";
      try {
        aiAnalysis = await fetchReportAnalysis({ patient: userDetails, latestProblem, medicineNames });
      } catch (_) {
        aiAnalysis = "";
      }

      await generateMedicationReport({ userDetails, medicines, latestProblem, aiAnalysis });
      toast.success("Report generated and downloaded.");
    } catch (err) {
      console.error("Report generation failed:", err);
      toast.error("Failed to generate report.");
    }
  }

  // Function to check if a date has an appointment
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const hasAppointment = appointmentDates.some(
        aptDate => aptDate.toDateString() === date.toDateString()
      );
      return hasAppointment ? 'has-appointment' : null;
    }
  };

  // Function to get appointments for selected date
  const getSelectedDateAppointments = () => {
    return appointments.filter(apt =>
      apt.__when instanceof Date && !isNaN(apt.__when.getTime()) &&
      apt.__when.toDateString() === selectedDate.toDateString()
    );
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <Navbar1 />
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`dashboard-container ${darkMode ? 'dark' : 'light'}`}>
      <Navbar1 />
      {userDetails && (
        <>
          <div className="dashboard-header">
            <h1>Welcome, {userDetails.firstName}</h1>
            <div className="quick-stats">
              <div className="stat-card">
                <h3>Total Appointments</h3>
                <p>{appointments.length}</p>
              </div>
              <div className="stat-card">
                <h3>Upcoming Appointments</h3>
                <p>{appointments.filter(apt => apt.__when instanceof Date && !isNaN(apt.__when.getTime()) && apt.__when > new Date()).length}</p>
              </div>
              <div className="stat-card">
                <h3>Total Prescriptions</h3>
                <p>{medicines.length}</p>
              </div>
            </div>
          </div>

          <div className="dashboard-content">
            {/* AI Assistant Section */}
            <div className="assistant-card">
              <div>
                <h2>AI Assistant</h2>
                <p>Get personalized help with your appointments, prescriptions, and health questions.</p>
              </div>
              <div className="assistant-actions">
                <button className="btn-primary" onClick={goToAIAssistant}>
                  Open AI Assistant
                </button>
              </div>
            </div>

            <div className="dashboard-main-grid">
              {/* Calendar Section */}
              <div className="calendar-section">
                <h2>Your Appointments Calendar</h2>
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  tileClassName={tileClassName}
                  className="appointments-calendar"
                />
                <div className="selected-date-appointments">
                  <h3>Appointments on {selectedDate.toLocaleDateString()}</h3>
                  {getSelectedDateAppointments().map(apt => (
                    <div key={apt.id} className="appointment-card selected-date">
                      <div className="appointment-time">{apt.time}</div>
                      <div className="appointment-details">
                        <p><strong>Problem:</strong> {apt.problem}</p>
                        <p><strong>Amount:</strong> ${'{'}apt.amount || 500{'}'}</p>
                        <button className="btn btn-secondary" onClick={() => handlePay(apt)}>
                          Pay
                        </button>
                      </div>
                    </div>
                  ))}
                  {getSelectedDateAppointments().length === 0 && (
                    <p className="no-appointments">No appointments for this date</p>
                  )}
                </div>
              </div>

              {/* Analysis Section */}
              <div className="analysis-section">
                <h2>Medicine Analysis</h2>
                <button className="analyze-btn" onClick={handleMedicineAnalysis}>
                  Analyze Medicines
                </button>
                {analysisResult && (
                  <div className="analysis-result">
                    <h3>Medicine Analysis Results</h3>
                    <div className="analysis-details">
                      <div
                        className="analysis-text"
                        dangerouslySetInnerHTML={{ __html: analysisResult }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Prescriptions Section - Full Width */}
            <div className="medicines-section">
              <h2>Recent Prescriptions</h2>
              <div className="action-buttons">
                <button className="btn btn-secondary" onClick={handleGenerateReport}>
                  Generate Medication Report (PDF)
                </button>
              </div>
              <div className="medicines-grid">
                {medicines.slice(0, 3).map((medicine) => (
                  <div key={medicine.id} className="medicine-card">
                    <div className="medicine-header">
                      <h3>Prescription #{medicine.id.slice(-4)}</h3>
                      <p className="date">
                        {medicine.createdAt.toDate().toLocaleDateString()}
                      </p>
                    </div>
                    <div className="medicines-list">
                      {medicine.medicines.map((med, index) => (
                        <div key={index} className="medicine-item">
                          <span className="medicine-name">{med.name}</span>
                          <span className="medicine-dosage">{med.dosage}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>


            <h3>Dental X-ray Results</h3>

            {approvedXrays.length > 0 && (
              <div className="approved-xrays-section">
                <h3>Approved Dental X-rays</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Findings</th>
                      <th>Annotated Image</th>
                      <th>Doctor</th>
                      <th>Doctor Comments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvedXrays.map((x) => (
                      <tr key={x.id}>
                        <td>{x.patientName}</td>
                        <td>
                          {Array.isArray(x.findings)
                            ? x.findings.map((f, idx) => (
                              <div key={idx}>
                                Label: {f.label}, Confidence: {f.confidence}
                              </div>
                            ))
                            : typeof x.findings === "object" && x.findings !== null
                              ? JSON.stringify(x.findings)
                              : x.findings}
                        </td>
                        <td>
                          <img
                            src={`/uploads/annotated_xrays/${x.annotatedImageUrl?.split('/').pop()}`}
                            alt="X-ray"
                            style={{ width: "250px", maxWidth: "100%", borderRadius: "8px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                            onError={(e) => {
                              // If local fails, try the original URL from DB as a last resort
                              if (e.target.src !== x.annotatedImageUrl) {
                                e.target.src = x.annotatedImageUrl;
                              }
                            }}
                          />
                        </td>
                        <td>{x.doctorName}</td>
                        <td>{x.doctorComments || "No comments"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}




          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
