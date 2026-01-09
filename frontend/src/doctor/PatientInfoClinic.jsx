import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom"; 
import { auth } from "../firebase/firebase"; 
import "./patientinfo.css";

function PatientInfoClinic() {
  const [patients, setPatients] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null); 
  const navigate=useNavigate();
  const [searchInput,setSearchInput]=useState("");
    const[filteredPatients,setFilteredPatients]=useState([]);


    

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
    const fetchData = async () => {
      try {
        const [usersSnapshot, appointmentsSnapshot, medicinesSnapshot] = await Promise.all([
          getDocs(collection(db, "Users")),
          getDocs(collection(db, "Appointments")),
          getDocs(collection(db, "medicines")),
        ]);

        const appointments = appointmentsSnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        const medicinesByUser = {};
        medicinesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (!medicinesByUser[data.userId]) {
            medicinesByUser[data.userId] = [];
          }
          if (Array.isArray(data.medicines)) {
            medicinesByUser[data.userId].push(...data.medicines);
          }
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const userMap = usersSnapshot.docs.map((doc) => {
          const userData = doc.data();
          const userAppointments = appointments.filter((appt) => appt.userId === doc.id);

          const pastAppointments = userAppointments
            .filter((appt) => new Date(appt.date) < today)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          const mostRecentAppointment = pastAppointments[0];

          const upcomingAppointments = userAppointments
            .filter((appt) => new Date(appt.date) > today)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
          const nextAppointment = upcomingAppointments[0];

          const userMeds = medicinesByUser[doc.id] || [];

          return {
            id: doc.id,
            fullName: `${userData.firstName || ""} ${userData.lastName || ""}`,
            medicalHistory: userData.medicalHistory || "Not specified",
            recentAppointment: mostRecentAppointment
              ? {
                  date: mostRecentAppointment.date,
                  problem: mostRecentAppointment.problem,
                }
              : null,
            upcomingAppointment: nextAppointment
              ? {
                  date: nextAppointment.date,
                  problem: nextAppointment.problem,
                }
              : null,
            totalAppointments: userAppointments.length,
            medicines: userMeds,
          };
        });

        setPatients(userMap);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const toggleExpand = (userId) => {
    setExpandedUserId((prevId) => (prevId === userId ? null : userId));
  };

  const handleSearch=()=>{
    if(searchInput.trim()==""){
      setFilteredPatients(patients);
      return;
    }
    const filtered=patients.filter((patient)=>
    patient.fullName.toLowerCase().includes(searchInput.toLowerCase()));
    setFilteredPatients(filtered);
  }

  return (
    <div>
    <nav className="navbar">
     <ul className="navbar-links">
       <li>
         <a href="/patientinfo" onClick={() => navigate("/patientinfo")}>
           Patient Info
         </a>
       </li>
       <li>
       <a href="/doctorportal" onClick={(e) => { e.preventDefault(); navigate("/clinicportal"); }}>
         Appointments</a>
       </li>
       
       
       <li>
         <a href="#logout" onClick={handleLogout}>
           Logout
         </a>
       </li>
     </ul>
   </nav>
    <div className="patient-info-page">
      <h1>Patient Information</h1>
      <p>
        Enter patient name:
        <input type="text" className="intxt" value={searchInput} onChange={(e)=>setSearchInput(e.target.value)}></input> 
        <button onClick={handleSearch}>Search</button>
        </p>
      {patients.length > 0 ? (
        <table className="patient-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Medical History</th>
              <th>Recent Appointment</th>
              <th>Upcoming Appointment</th>
            </tr>
          </thead>
          <tbody>
          {(filteredPatients.length > 0 ? filteredPatients : patients).map((patient) => (
              <React.Fragment key={patient.id}>
                <tr onClick={() => toggleExpand(patient.id)} className="clickable-row">
                  <td>{patient.fullName}</td>
                  <td>{patient.medicalHistory}</td>
                  <td>
                    {patient.recentAppointment
                      ? `${patient.recentAppointment.date} - ${patient.recentAppointment.problem}`
                      : "—"}
                  </td>
                  <td>
                    {patient.upcomingAppointment
                      ? `${patient.upcomingAppointment.date} - ${patient.upcomingAppointment.problem}`
                      : "None"}
                  </td>
                </tr>
                {expandedUserId === patient.id && (
                  <tr className="expanded-row">
                    <td colSpan="4">
                      <div className="expanded-info">
                        <p><strong>Total Appointments:</strong> {patient.totalAppointments}</p>
                        <p><strong>Medicines:</strong></p>
                        {patient.medicines.length > 0 ? (
                          <ol>
                            {patient.medicines.map((med, index) => (
                              <li key={index}>
                                {med.name} — {med.dosage}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>None</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No patient data found.</p>
      )}
    </div>
    </div>
  );
}

export default PatientInfoClinic;
