import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase/firebase";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./doctorportal.css";
import "./xray-modal.css";



function DoctorPortal() {
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredAppointments, setFilteredAppointments] = useState([]);
  const [searched, setSearched] = useState(false);
  const navigate = useNavigate();
  const [lightboxImage, setLightboxImage] = useState(null);
  const [pendingXrays, setPendingXrays] = useState([]);
  const [comments, setComments] = useState({});

  useEffect(() => {
    const fetchPending = async () => {
      const q = query(collection(db, "XrayAnalyses"), where("status", "==", "pending"));
      const snap = await getDocs(q);
      setPendingXrays(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchPending();
  }, []);


  const handleApprove = async (id) => {
    try {
      await updateDoc(doc(db, "XrayAnalyses", id), {
        status: "approved",
        doctorComments: comments[id] || ''
      });
      alert("X-ray approved and visible to patient!");
      setPendingXrays(prev => prev.filter(item => item.id !== id));
      // Clear the comment for this ID
      setComments(prev => {
        const newComments = { ...prev };
        delete newComments[id];
        return newComments;
      });
    } catch (error) {
      console.error("Error approving X-ray:", error);
      alert("Failed to approve X-ray. Please try again.");
    }
  };

  const handleCommentChange = (id, comment) => {
    setComments(prev => ({
      ...prev,
      [id]: comment
    }));
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

  const goToCancel = () => {
    navigate("/canceldoctor");
  };

  const formatDate = (dateObj) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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
          console.log("No appointments found.");
          setAppointments([]);
        }
      } catch (error) {
        console.error("Error fetching appointments:", error);
      }
    };

    fetchAppointments();
  }, []);

  const handleSearch = () => {
    const dateStr = formatDate(selectedDate);
    const filtered = appointments.filter(
      (appointment) => appointment.date === dateStr
    );
    setFilteredAppointments(filtered);
    setSearched(true);
  };

  const todayStr = formatDate(new Date());
  const todaysAppointments = appointments.filter(
    (app) => app.date === todayStr
  );

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
            <a
              href="/doctorportal"
              onClick={(e) => {
                e.preventDefault();
                navigate("/doctorportal");
              }}
            >
              Appointments
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
        <h2>
          <center>Appointments Today: {todaysAppointments.length}</center>
        </h2>
      </div>

      <div className="doctor-portal">
        <h1>Doctor's Portal</h1>
        <h2>Search Appointments</h2>

        <div className="date-container">
          <label>Select a Date</label>
          <Calendar
            onChange={setSelectedDate}
            value={selectedDate}
            className="custom-calendar"
          />
          <button onClick={handleSearch}>Search Appointments</button>
        </div>

        {searched && (
          <div className="results-section">
            <h2>Appointments for {formatDate(selectedDate)}</h2>
            <p>Need to cancel?</p>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                goToCancel();
              }}
              className="cancel-link"
            >
              Cancel Appointment
            </a>

            {filteredAppointments.length > 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((appointment) => (
                      <tr key={appointment.id}>
                        <td>{appointment.time || "Not specified"}</td>
                        <td>{appointment.name || "Unknown"}</td>
                        <td>{appointment.age || "Not specified"}</td>
                        <td>{appointment.gender || "Not specified"}</td>
                        <td>{appointment.problem || "Not specified"}</td>
                        <td>{appointment.medicalHistory || "Not specified"}</td>
                        <td>{appointment.aiAnalysis || "No analysis available"}</td>
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


        {pendingXrays.length > 0 && (
          <div className="pending-xrays-section">
            <h3>Pending Dental X-ray Analyses</h3>
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Findings</th>
                  <th>Annotated Image</th>
                  <th>Comments</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingXrays.map((x) => (
                  <tr key={x.id}>
                    <td>{x.patientName}</td>
                    <td>
                      {Array.isArray(x.findings)
                        ? x.findings.map((f, idx) => (
                          <div key={idx}>
                            Label: {f.label}, Confidence: {f.confidence}, Coordinates: {JSON.stringify(f.coordinates)}
                          </div>
                        ))
                        : typeof x.findings === 'object' && x.findings !== null
                          ? JSON.stringify(x.findings)
                          : x.findings}
                    </td>
                    <td>
                      <img
                        src={`/uploads/annotated_xrays/${x.annotatedImageUrl?.split('/').pop()}`}
                        alt="X-ray"
                        style={{ width: "350px", maxWidth: "100%", cursor: "pointer", borderRadius: "8px" }}
                        onClick={() => setLightboxImage(x.annotatedImageUrl)}
                        onError={(e) => {
                          if (e.target.src !== x.annotatedImageUrl) {
                            e.target.src = x.annotatedImageUrl;
                          }
                        }}
                      />
                    </td>
                    <td>
                      <textarea
                        value={comments[x.id] || ''}
                        onChange={(e) => handleCommentChange(x.id, e.target.value)}
                        placeholder="Add your comments here..."
                        style={{ width: '200px', height: '80px', marginRight: '10px' }}
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => handleApprove(x.id)}
                        style={{
                          padding: '8px 15px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px'
                        }}
                      >
                        Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lightboxImage && (
          <div
            className="lightbox-overlay"
            onClick={() => setLightboxImage(null)}
          >
            <img
              src={`/uploads/annotated_xrays/${lightboxImage?.split('/').pop()}`}
              className="lightbox-image"
              alt="X-ray Large"
              onError={(e) => {
                if (e.target.src !== lightboxImage) {
                  e.target.src = lightboxImage;
                }
              }}
            />
          </div>
        )}

      </div>
    </div>
  );
}

export default DoctorPortal;
