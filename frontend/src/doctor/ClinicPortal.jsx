
import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./clinicportal.css";
import { auth } from "../firebase/firebase";
import { sendAppointmentCancellationEmail } from "../utils/emailService.js";



function ClinicPortal() {
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  // Removed filteredAppointments state - derived in render instead
  const [searched, setSearched] = useState(true); // Default matching displayed date
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [showCancelView, setShowCancelView] = useState(false);

  const handleXrayUpload = async (e, appointmentId, patientName, uid) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("image_file", file);

    try {
      const res = await fetch("http://localhost:8080/analyze-xray", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      // Store separate analysis doc
      await addDoc(collection(db, "XrayAnalyses"), {
        appointmentId,
        userId: uid,
        patientName,
        doctorName: "manjunath",
        annotatedImageUrl: data.annotatedImageUrl,
        findings: data.findings,
        status: "pending",
        createdAt: new Date(),
      });

      // Update the main appointment doc status
      await updateDoc(doc(db, "Appointments", appointmentId), {
        xrayStatus: "uploaded"
      });

      // Update local state immediately
      setAppointments(prev => prev.map(apt =>
        apt.id === appointmentId ? { ...apt, xrayStatus: "uploaded" } : apt
      ));

      alert("X-ray uploaded and sent to doctor for review!");
    } catch (err) {
      console.error(err);
      alert("Upload failed!");
    }
    setUploading(false);
  };




  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/");
      console.log("User logged out successfully!");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                               Helper Functions                             */
  /* -------------------------------------------------------------------------- */

  const formatDate = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 1. Fetch appointments function
  const fetchAppointments = async () => {
    try {
      const appointmentsRef = collection(db, "Appointments");
      const snapshot = await getDocs(appointmentsRef);

      if (!snapshot.empty) {
        const allAppointments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAppointments(allAppointments);
      } else {
        console.log("No appointments found.");
        setAppointments([]);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                                 Effects                                    */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    fetchAppointments();
  }, []);


  /* -------------------------------------------------------------------------- */
  /*                                 Handlers                                   */
  /* -------------------------------------------------------------------------- */

  const handleSearch = () => {
    // Re-fetch data to ensure freshness 
    fetchAppointments();
  };

  const handleCancel = async (appointmentId, appointmentDetails) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      try {
        await deleteDoc(doc(db, "Appointments", appointmentId));

        // Send cancellation email if patient email is available
        if (appointmentDetails.email) {
          const emailSent = await sendAppointmentCancellationEmail({
            name: appointmentDetails.name,
            email: appointmentDetails.email,
            date: appointmentDetails.date,
            time: appointmentDetails.time,
            doctorName: appointmentDetails.doctorName || "Dr. Manjunath"
          });

          if (emailSent) {
            console.log("Cancellation email sent successfully");
          } else {
            console.log("Failed to send cancellation email");
          }
        }

        // Remove from local state
        setAppointments(appointments.filter(apt => apt.id !== appointmentId));
        setFilteredAppointments(filteredAppointments.filter(apt => apt.id !== appointmentId));
        alert("Appointment cancelled successfully!");
      } catch (error) {
        console.error("Error cancelling appointment:", error);
        alert("Failed to cancel appointment. Please try again.");
      }
    }
  };

  const getFutureAppointments = () => {
    const now = new Date();

    return appointments
      .map((apt) => {
        if (!apt.date) return { ...apt, fullDateObj: new Date(0) }; // Treat invalid date as past

        const [year, month, day] = apt.date.split('-').map(Number);
        const aptDate = new Date(year, month - 1, day);

        if (apt.time) {
          const timeParts = apt.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
          if (timeParts) {
            let [_, hours, minutes, modifier] = timeParts;
            hours = parseInt(hours, 10);
            minutes = parseInt(minutes, 10);

            if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
            if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;

            aptDate.setHours(hours, minutes, 0, 0);
          } else {
            // Try parsing as 24h if AM/PM missing, or just leave as midnight
            const simpleTime = apt.time.match(/(\d+):(\d+)/);
            if (simpleTime) {
              aptDate.setHours(parseInt(simpleTime[1]), parseInt(simpleTime[2]), 0, 0);
            }
          }
        } else {
          // If no time is specified, assume end of day (keep it visible for the day)
          aptDate.setHours(23, 59, 59, 999);
        }

        return { ...apt, fullDateObj: aptDate };
      })
      .filter((apt) => apt.fullDateObj > now)
      .sort((a, b) => a.fullDateObj - b.fullDateObj);
  };

  const getWeekAppointments = () => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);

      const formatted = formatDate(current);
      const count = appointments.filter(app => app.date === formatted).length;

      weekDays.push({
        displayDate: `${current.getMonth() + 1}/${current.getDate()}`, // 3/12
        weekday: current.toLocaleDateString("en-US", { weekday: "long" }), // Tuesday
        count,
      });
    }

    return weekDays;
  };


  const getColorClass = (count) => {
    if (count <= 5) return "green";
    if (count <= 10) return "yellow";
    return "red";
  };


  return (
    <div>
      <nav className="navbar">
        <ul className="navbar-links">
          <li>
            <a href="/patientinfoclinic" onClick={() => navigate("/patientinfoclinic")}>
              Patient Info
            </a>
          </li>
          <li>
            <a href="/clinicportal" onClick={(e) => { e.preventDefault(); setShowCancelView(false); }}>
              Appointments</a>
          </li>
          <li>
            <a href="#cancel" onClick={(e) => { e.preventDefault(); setShowCancelView(true); }}>
              Cancel Appointments
            </a>
          </li>


          <li>
            <a href="#logout" onClick={handleLogout}>
              Logout
            </a>
          </li>
        </ul>
      </nav>

      <div className="top-banner">
        <h2><center>
          Appointments Today: {
            appointments.filter(app => app.date === formatDate(new Date())).length
          }</center></h2>

        <div className="weekly-bar">
          {getWeekAppointments().map(({ displayDate, weekday, count }, idx) => (
            <div key={idx} className={`day-box ${getColorClass(count)}`}>
              <div className="date">{displayDate}</div>
              <div className="weekday">{weekday}</div>
              <div className="count">{count}</div>
            </div>
          ))}
        </div>

      </div>




      <main className="content-wrapper">
        <div className="clinic-portal">
          {!showCancelView ? (
            <>
              <h1>Clinic Portal</h1>
              <h2>Search Appointments</h2>

              <div className="date-container">
                <label>Select a Date</label>
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  className="custom-calendar"
                />
              </div>

              {searched && (
                <div className="results-section">
                  <h2>Appointments for {formatDate(selectedDate)}</h2>

                  {/* Filter appointments on-the-fly for rendering */}
                  {appointments.filter(app => app.date === formatDate(selectedDate)).length > 0 ? (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>Gender</th>
                            <th>Problem</th>
                            <th>Medical History</th>
                            <th>AI Analysis</th>

                            <th>Upload X-ray</th>

                          </tr>
                        </thead>
                        <tbody>
                          {appointments
                            .filter(app => app.date === formatDate(selectedDate))
                            .map((appointment) => (
                              <tr key={appointment.id}>
                                <td>{appointment.time || "Not specified"}</td>
                                <td>{appointment.name || "Unknown"}</td>
                                <td>{appointment.age || "Not specified"}</td>
                                <td>{appointment.gender || "Not specified"}</td>
                                <td>{appointment.problem || "Not specified"}</td>
                                <td>{appointment.medicalHistory || "Not specified"}</td>
                                <td>{appointment.aiAnalysis || "No analysis available"}</td>
                                <td>

                                  {appointment.xrayStatus === "uploaded" || appointment.xrayStatus === "approved" ? (
                                    <span style={{ color: "green", fontWeight: "bold" }}>
                                      Sent to Doctor
                                    </span>
                                  ) : (
                                    <input
                                      type="file"
                                      accept="image/*"
                                      disabled={uploading}
                                      onChange={(e) =>
                                        handleXrayUpload(
                                          e,
                                          appointment.id,
                                          appointment.name,
                                          appointment.userId
                                        )
                                      }
                                    />
                                  )}
                                </td>

                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-results">No appointments found for the selected date.</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="cancel-header">
                <h2>Cancel Appointments</h2>
              </div>

              {getFutureAppointments().length === 0 ? (
                <div className="no-appointments">
                  <p>No upcoming appointments found.</p>
                </div>
              ) : (
                <div className="appointments-list">
                  {getFutureAppointments().map((appointment) => (
                    <div key={appointment.id} className="appointment-card">
                      <div className="appointment-details">
                        <h3>{appointment.name}</h3>
                        <p><strong>Date:</strong> {appointment.date}</p>
                        <p><strong>Time:</strong> {appointment.time}</p>
                        <p><strong>Problem:</strong> {appointment.problem}</p>
                        <p><strong>Email:</strong> {appointment.email || 'N/A'}</p>
                      </div>
                      <div className="appointment-actions">
                        <button
                          className="cancel-btn"
                          onClick={() => handleCancel(appointment.id, appointment)}
                        >
                          Cancel Appointment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default ClinicPortal;
