
import React, { useEffect, useState ,useRef} from "react";
import { auth, db } from "../firebase/firebase";
import { collection, query, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import "./cancel.css"; // 
import { useNavigate } from "react-router-dom";
import emailjs from '@emailjs/browser';

function CancelAppointment() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate=useNavigate();
   const form=useRef();

  const formatDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const goBack=()=>{
    navigate("/dashboard")
  };
  useEffect(() => {
    const fetchAppointments = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const q = query(collection(db, "Appointments"), where("userId", "==", user.uid));
          const snapshot = await getDocs(q);
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Ignore time, compare only dates
  
          const futureAppointments = snapshot.docs
            .map((doc) => {
              const data = doc.data();
              const date = new Date(data.date); // assuming date is in 'YYYY-MM-DD' format
              date.setHours(0, 0, 0, 0);
              return {
                id: doc.id,
                ...data,
                dateObj: date,
              };
            })
            .filter((appt) => appt.dateObj >= now)
            .sort((a, b) => a.dateObj - b.dateObj); // sort by upcoming date
  
          console.log("Filtered future appointments:", futureAppointments);
          setAppointments(futureAppointments);
        } catch (error) {
          console.error("Error fetching appointments:", error);
        }
      }
      setLoading(false);
    };
  
    fetchAppointments();
  }, []);

  function sendEmail(appointmentId) {
        //e.preventDefault();
    
        emailjs
          .sendForm('service_yg8j9qp', 'template_c5f0dcf', form.current, {
            publicKey: 'PdoHCkjR9p01ZAXnG',
          })
          .then(
            () => {
              console.log('SUCCESS!');
            },
            (error) => {
              console.log('FAILED...', error.text);
            },
          );
          handleCancel(appointmentId);
      };

  

  // Function to cancel an appointment
  const handleCancel = async (appointmentId) => {
    try {
      await deleteDoc(doc(db, "Appointments", appointmentId));
      setAppointments((prev) => prev.filter((appointment) => appointment.id !== appointmentId));
      console.log("Appointment cancelled successfully!");
    } catch (error) {
      console.error("Error cancelling appointment:", error);
    }


  };

  const goTrial=()=>{
    navigate("/testingemail");
  }

  return (
    <div className="cancel-container">
      <h1>Cancel Appointment</h1>
      {loading ? (
        <p>Loading appointments...</p>
      ) : appointments.length > 0 ? (
        <ul className="appointment-list">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="appointment-item">
              <span>
                <strong>{appointment.date} at {appointment.time}</strong> - {appointment.problem}
              </span>
              <form
  ref={form}
  onSubmit={(e) => {
    e.preventDefault();

    const formattedDate = formatDate(appointment.date);
    const message = `Appointment on ${formattedDate} at ${appointment.time} has been cancelled`;
    
    // Create a hidden input dynamically
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.name = "message";
    hiddenInput.value = message;
    form.current.appendChild(hiddenInput);

    sendEmail(appointment.id);
  }}
>
  <button type="submit" className="cancel-x-btn">❌</button>
</form>

            </li>
          ))}
        </ul>
      ) : (
        <p>No Upcoming Appointments.</p>
      )}
      <button onClick={goBack}>Back</button>
    </div>
  );
}

export default CancelAppointment;
