import React, { useEffect, useState } from "react";
import { db } from  "../firebase/firebase"; 
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
  const [filteredAppointments, setFilteredAppointments] = useState([]); 
  const [searched, setSearched] = useState(false); 
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
    // Wake up Render
    await fetch("https://clinicease-project-il0j.onrender.com/");

    // Main API
    const res = await fetch("https://clinicease-project-il0j.onrender.com/analyze-xray", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    // Save in Xray collection
    await addDoc(collection(db, "XrayAnalyses"), {
      appointmentId,
      userId :uid,
      patientName,
      doctorName: "manjunath",
      annotatedImageUrl: data.annotatedImageUrl,
      findings: data.findings,
      status: "pending",
      createdAt: new Date(),
    });

    // ✅ IMPORTANT: Save in appointment (for UI display)
    await updateDoc(doc(db, "Appointments", appointmentId), {
      annotatedImageUrl: data.annotatedImageUrl,
      xrayStatus: "uploaded"
    });

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
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  useEffect(() => {
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
          setAppointments([]);
        }
      } catch (error) {
        console.error("Error fetching appointments:", error);
      }
    };

    fetchAppointments(); 
  }, []);

  const formatDate = (dateObj) => {
    return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")}`;
  };

  const handleCancel = async (appointmentId, appointmentDetails) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      try {
        await deleteDoc(doc(db, "Appointments", appointmentId));

        if (appointmentDetails.email) {
          await sendAppointmentCancellationEmail({
            name: appointmentDetails.name,
            email: appointmentDetails.email,
            date: appointmentDetails.date,
            time: appointmentDetails.time,
            doctorName: appointmentDetails.doctorName || "Dr. Manjunath"
          });
        }

        setAppointments(appointments.filter(apt => apt.id !== appointmentId));
        setFilteredAppointments(filteredAppointments.filter(apt => apt.id !== appointmentId));
        alert("Appointment cancelled successfully!");
      } catch (error) {
        console.error("Error cancelling appointment:", error);
      }
    }
  };

  const getFutureAppointments = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return appointments
      .map((apt) => {
        const date = new Date(apt.date);
        date.setHours(0, 0, 0, 0);
        return { ...apt, dateObj: date };
      })
      .filter((apt) => apt.dateObj >= now)
      .sort((a, b) => a.dateObj - b.dateObj);
  };

  const handleSearch = () => {
    const dateStr = formatDate(selectedDate);
    const filtered = appointments.filter(
      (appointment) => appointment.date === dateStr
    );
    setFilteredAppointments(filtered);
    setSearched(true);
  };

  const getWeekAppointments = () => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    return Array.from({ length: 7 }).map((_, i) => {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);

      const formatted = formatDate(current);
      const count = appointments.filter(app => app.date === formatted).length;

      return {
        displayDate: `${current.getMonth() + 1}/${current.getDate()}`,
        weekday: current.toLocaleDateString("en-US", { weekday: "long" }),
        count,
      };
    });
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
          <li><a href="/patientinfoclinic" onClick={() => navigate("/patientinfoclinic")}>Patient Info</a></li>
          <li><a href="/clinicportal" onClick={(e) => { e.preventDefault(); setShowCancelView(false); }}>Appointments</a></li>
          <li><a href="#cancel" onClick={(e) => { e.preventDefault(); setShowCancelView(true); }}>Cancel Appointments</a></li>
          <li><a href="#logout" onClick={handleLogout}>Logout</a></li>
        </ul>
      </nav>

      <main className="content-wrapper">
        <div className="clinic-portal">
          {!showCancelView ? (
            <>
              <h2>Search Appointments</h2>

              <Calendar onChange={setSelectedDate} value={selectedDate} />

              <button onClick={handleSearch}>Search</button>

              {searched && (
                filteredAppointments.length > 0 ? (
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Upload X-ray</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAppointments.map((appointment) => (
                        <tr key={appointment.id}>
                          <td>{appointment.name}</td>

                          <td>
                            {appointment.annotatedImageUrl ? (
                              <>
                                <span style={{ color: "green" }}>Uploaded</span>
                                <br />
                                <img src={appointment.annotatedImageUrl} width="120" />
                              </>
                            ) : (
                              <input
                                type="file"
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
                ) : <p>No appointments</p>
              )}
            </>
          ) : (
            <div>
              {getFutureAppointments().map((appointment) => (
                <div key={appointment.id}>
                  <h3>{appointment.name}</h3>
                  <button onClick={() => handleCancel(appointment.id, appointment)}>
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ClinicPortal;
