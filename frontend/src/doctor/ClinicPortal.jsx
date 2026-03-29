```javascript
import React, { useEffect, useState } from "react";
import { db } from  "../firebase/firebase"; 
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore"; 
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
      const res = await fetch("https://clinic-ease-backend-new.onrender.com/analyze-xray", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Backend error:", text);
        alert("Server error! Please try again.");
        setUploading(false);
        return;
      }

      const data = await res.json();

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
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
        alert("Failed to cancel appointment.");
      }
    }
  };

  const handleSearch = () => {
    const dateStr = formatDate(selectedDate);
    const filtered = appointments.filter(
      (appointment) => appointment.date === dateStr
    );
    setFilteredAppointments(filtered);
    setSearched(true);
  };

  return (
    <div>
      <nav className="navbar">
        <ul className="navbar-links">
          <li><a href="/patientinfoclinic">Patient Info</a></li>
          <li><a href="/clinicportal">Appointments</a></li>
          <li><a href="#cancel">Cancel Appointments</a></li>
          <li><a href="#logout" onClick={handleLogout}>Logout</a></li>
        </ul>
      </nav>

      <main className="content-wrapper">
        <div className="clinic-portal">
          <h1>Clinic Portal</h1>

          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
          />

          <button onClick={handleSearch}>Search Appointments</button>

          {filteredAppointments.map((appointment) => (
            <div key={appointment.id}>
              <p>{appointment.name}</p>

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
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default ClinicPortal;
```

