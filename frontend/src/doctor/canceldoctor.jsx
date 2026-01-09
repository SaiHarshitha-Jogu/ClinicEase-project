import { deleteDoc, doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { db } from  "../firebase/firebase";
import { collection, query, getDocs } from "firebase/firestore";
import "./cancel.css";
import { useNavigate } from "react-router-dom";


function CancelDoctor() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); 
  
   const handleLogout = async () => {
      try {
        await auth.signOut();
        navigate("/");
        console.log("User logged out successfully!");
      } catch (error) {
        console.error("Error logging out:", error.message);
      }
    };
    
  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        const q = query(collection(db, "Appointments"));
        const snapshot = await getDocs(q);

        const now = new Date();

        if (snapshot.empty) {
          console.log("No appointments found in Firestore.");
          setAppointments([]);
        } else {
          const appointmentsWithPatientNames = await Promise.all(
            snapshot.docs.map(async (docSnap) => {
              const data = docSnap.data();
              const dateTimeStr = `${data.date} ${data.time}`;
              const apptDate = new Date(dateTimeStr);
              if (apptDate > now) {
                let patientName = "Unknown";
                if (data.userId) {
                  const userDoc = await getDoc(doc(db, "Users", data.userId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    patientName = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
                  }
                }
                return {
                  id: docSnap.id,
                  ...data,
                  patientName,
                  dateObj: apptDate,
                };
              }
              return null;
            })
          );

          const futureAppointments = appointmentsWithPatientNames
            .filter((appt) => appt !== null)
            .sort((a, b) => a.dateObj - b.dateObj);

          console.log("Filtered future appointments:", futureAppointments);
          setAppointments(futureAppointments);
        }
      } catch (error) {
        console.error("Error fetching appointments:", error);
      }

      setLoading(false);
    };

    fetchAppointments();
  }, []);

  const handleCancel = async (appointmentId) => {
    try {
      await deleteDoc(doc(db, "Appointments", appointmentId));
      setAppointments((prev) =>
        prev.filter((appointment) => appointment.id !== appointmentId)
      );
      console.log("Appointment cancelled successfully!");
    } catch (error) {
      console.error("Error cancelling appointment:", error);
    }
  };

  return (
    <div>
       <nav className="navbar">
        <ul className="navbar-links">
          <li>
            <a href="#patient-info" onClick={() => navigate("/patientinfo")}>
              Patient Info
            </a>
          </li>
          <li>
          <a href="/doctorportal" onClick={(e) => { e.preventDefault(); navigate("/doctorportal"); }}>
            Appointments</a>
          </li>
          
          
          <li>
            <a href="#logout" onClick={handleLogout}>
              Logout
            </a>
          </li>
        </ul>
      </nav>

    <div className="cancel-container">
      <h1>Cancel Appointment</h1>
      {loading ? (
        <p>Loading appointments...</p>
      ) : appointments.length > 0 ? (
        <ul className="appointment-list">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="appointment-item">
              <span>
                <strong>
                  {formatDate(appointment.date)} at {appointment.time} for Patient: {appointment.patientName} for problem: {appointment.problem}
                </strong>
              </span>
              <button className="cancel-x-btn" onClick={() => handleCancel(appointment.id)}>
                ❌
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No upcoming appointments found.</p>
      )}
    </div>
    </div>
  );
}

export default CancelDoctor;
