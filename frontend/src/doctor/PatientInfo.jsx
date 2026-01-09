// --- Updated PatientInfo.jsx ---
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import { collection, getDocs, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./patientinfo.css";

function PatientInfo() {
  const [patients, setPatients] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [medicineName, setMedicineName] = useState("");
  const [addMed, setAddMed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
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

        const appointments = appointmentsSnapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));

        const medicinesByUser = {};
        medicinesSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (!medicinesByUser[data.userId]) medicinesByUser[data.userId] = [];
          if (Array.isArray(data.medicines)) medicinesByUser[data.userId].push(...data.medicines);
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const userMap = usersSnapshot.docs.map((doc) => {
          const userData = doc.data();
          const userAppointments = appointments.filter((appt) => appt.userId === doc.id);
          const past = userAppointments.filter((appt) => new Date(appt.date) < today).sort((a, b) => new Date(b.date) - new Date(a.date));
          const upcoming = userAppointments.filter((appt) => new Date(appt.date) >= today).sort((a, b) => new Date(a.date) - new Date(b.date));
          return {
            id: doc.id,
            email: userData.email || "unknown@example.com",
            fullName: `${userData.firstName || ""} ${userData.lastName || ""}`,
            medicalHistory: userData.medicalHistory || "Not specified",
            chiefComplaint: past[0]?.problem || null,
            recentAppointment: past[0] ? { date: past[0].date, problem: past[0].problem } : null,
            upcomingAppointment: upcoming[0] ? { date: upcoming[0].date, problem: upcoming[0].problem } : null,
            totalAppointments: userAppointments.length,
            medicines: medicinesByUser[doc.id] || [],
          };
        });

        setPatients(userMap);
        setFilteredPatients(userMap);
      } catch (err) {
        console.error("Fetch error:", err);
      }
    };

    fetchData();
  }, []);

  const toggleExpand = (userId) => setExpandedUserId((prev) => (prev === userId ? null : userId));

  const handleSearch = () => {
    if (!searchInput.trim()) {
      setFilteredPatients(patients);
      return;
    }
    const filtered = patients.filter((p) => p.fullName.toLowerCase().includes(searchInput.toLowerCase()));
    setFilteredPatients(filtered);
  };

  const addMedicine = () => setAddMed(true);

  const updateMedicine = async () => {
    if (!medicineName.trim()) return alert("Enter medicine name.");
    const patient = patients.find((p) => p.id === expandedUserId);
    if (!patient) return alert("Patient not found.");

    const med = { name: medicineName, dosage: "Dosage not specified", frequency: "N/A", instructions: "None", timing: "N/A" };

    try {
      await addDoc(collection(db, "medicines"), { userId: patient.id, userEmail: patient.email, medicines: [med] });
      alert("Medicine added!");
      setMedicineName("");
      setAddMed(false);
    } catch (err) {
      console.error("Add medicine error:", err);
      alert("Failed to add medicine.");
    }
  };

  return (
    <div>
      <nav className="navbar">
        <ul className="navbar-links">
          <li><a href="#" onClick={() => navigate("/patientinfo")}>Patient Info</a></li>
          <li><a href="#" onClick={() => navigate("/doctorportal")}>Appointments</a></li>
          <li><a href="#" onClick={handleLogout}>Logout</a></li>
        </ul>
      </nav>

      <div className="patient-info-page">
        <h1>Patient Information</h1>
        <p>
          Enter patient name: <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button onClick={handleSearch}>Search</button>
        </p>

        {filteredPatients.length > 0 ? (
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
              {filteredPatients.map((patient) => (
                <React.Fragment key={patient.id}>
                  <tr onClick={() => toggleExpand(patient.id)} className="clickable-row">
                    <td>{patient.fullName}</td>
                    <td>{patient.medicalHistory}</td>
                    <td>{patient.recentAppointment ? `${patient.recentAppointment.date} - ${patient.recentAppointment.problem}` : "—"}</td>
                    <td>{patient.upcomingAppointment ? `${patient.upcomingAppointment.date} - ${patient.upcomingAppointment.problem}` : "None"}</td>
                  </tr>
                  {expandedUserId === patient.id && (
                    <tr className="expanded-row">
                      <td colSpan="4">
                        <div className="expanded-info">
                          <p><strong>Chief Complaint:</strong> {patient.chiefComplaint}</p>
                          <p><strong>Total Appointments:</strong> {patient.totalAppointments}</p>
                          <p><strong>Medicines:</strong></p>
                          {patient.medicines.length > 0 ? (
                            <ol>{patient.medicines.map((med, i) => <li key={i}>{med.name} — {med.dosage}</li>)}</ol>
                          ) : <p>None</p>}
                          <button onClick={addMedicine}>Add Medicine</button>
                          {addMed && (
                            <>
                              <input type="text" value={medicineName} onChange={(e) => setMedicineName(e.target.value)} />
                              <button onClick={updateMedicine}>Add</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : <p>No patient data found.</p>}
      </div>
    </div>
  );
}

export default PatientInfo;
