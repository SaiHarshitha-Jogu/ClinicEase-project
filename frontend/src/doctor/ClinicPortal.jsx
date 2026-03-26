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
  const [searched, setSearched] = useState(true);
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [showCancelView, setShowCancelView] = useState(false);

  // ✅ X-RAY UPLOAD FUNCTION (FULLY FIXED)
  const handleXrayUpload = async (e, appointmentId, patientName, uid) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("image_file", file);

    try {
      const res = await fetch("https://clinic-ease-xray.onrender.com/analyze-xray", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log("Xray Response:", data);

      // ✅ FIX IMAGE URL
      data.annotatedImageUrl =
        data.annotatedImageUrl?.replace(
          "http://localhost:10000",
          "https://clinic-ease-xray.onrender.com"
        );

      // ✅ Store in XrayAnalyses
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

      // ✅ IMPORTANT: Save in Appointments also
      await updateDoc(doc(db, "Appointments", appointmentId), {
        xrayStatus: "uploaded",
        annotatedImageUrl: data.annotatedImageUrl,
      });

      // ✅ Update UI instantly
      setAppointments((prev) =>
        prev.map((apt) =>
          apt.id === appointmentId
            ? { ...apt, xrayStatus: "uploaded", annotatedImageUrl: data.annotatedImageUrl }
            : apt
        )
      );

      alert("X-ray uploaded successfully!");
    } catch (err) {
      console.error(err);
      alert("Upload failed!");
    }

    setUploading(false);
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/");
  };

  const formatDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const fetchAppointments = async () => {
    const snapshot = await getDocs(collection(db, "Appointments"));
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    setAppointments(data);
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  return (
    <div>
      <nav className="navbar">
        <ul className="navbar-links">
          <li><a href="/patientinfoclinic">Patient Info</a></li>
          <li><a href="/clinicportal">Appointments</a></li>
          <li><a href="#logout" onClick={handleLogout}>Logout</a></li>
        </ul>
      </nav>

      <div className="top-banner">
        <h2>
          <center>
            Appointments Today: {
              appointments.filter(app => app.date === formatDate(new Date())).length
            }
          </center>
        </h2>
      </div>

      <main className="content-wrapper">
        <div className="clinic-portal">
          <h1>Clinic Portal</h1>

          <div className="date-container">
            <Calendar onChange={setSelectedDate} value={selectedDate} />
          </div>

          <h2>Appointments for {formatDate(selectedDate)}</h2>

          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Name</th>
                <th>Problem</th>
                <th>X-ray</th>
              </tr>
            </thead>

            <tbody>
              {appointments
                .filter(app => app.date === formatDate(selectedDate))
                .map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{appointment.time}</td>
                    <td>{appointment.name}</td>
                    <td>{appointment.problem}</td>

                    {/* ✅ FINAL FIXED COLUMN */}
                    <td>
                      {appointment.xrayStatus === "uploaded" ? (
                        <div>
                          <span style={{ color: "green" }}>Sent</span>

                          {appointment.annotatedImageUrl && (
                            <img
                              src={appointment.annotatedImageUrl}
                              alt="xray"
                              style={{ width: "120px", display: "block", marginTop: "10px" }}
                            />
                          )}
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
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
      </main>
    </div>
  );
}

export default ClinicPortal;
