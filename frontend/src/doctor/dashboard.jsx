import React, { useEffect, useState, useRef } from "react";
import { auth, db } from "../firebase/firebase";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./dashboard.css";

function Dashboard() {
  const [userDetails, setUserDetails] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "Users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserDetails(docSnap.data());
            fetchAppointments(user.uid);
          } else {
            navigate("/register");
            console.log("No user data found");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUserDetails(null);
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!showDropdown) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  async function fetchAppointments(userId) {
    try {
      const appointmentsRef = collection(db, "Appointments");
      const q = query(appointmentsRef, where("userId", "==", userId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const userAppointments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAppointments(userAppointments);
      } else {
        console.log("No appointments found.");
        setAppointments([]);
      }
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }

  async function handleLogout() {
    try {
      await auth.signOut();
      navigate("/");
      console.log("User logged out successfully!");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  }

  function goToSpeechToText() {
    navigate("/speechtotext");
  }

  function goToCancel(){
    navigate("/cancelappointment")
  }

  return (
    <div className="dashboard-container">
      {userDetails ? (
        <>
        <div className="topquote">
          <h3>
            <i>
              "Good health is not something you can buy. However, it can be an
              incredibly valuable savings account."
            </i>
          </h3>
          </div>
          <h3>{new Date().toLocaleDateString()}</h3>

          <div className="topright">
            <div
              className="user-icon-container"
              onMouseEnter={() => setShowDropdown(true)}
              onMouseLeave={() => setShowDropdown(false)}
            >
              <img
                src="src/assets/account.png"
                alt="User"
                className="user-icon"
                onClick={() => setShowDropdown((prev) => !prev)}
              />
              {showDropdown && (
                <div className="dropdown-menu" ref={dropdownRef}>
                  <p><strong>First name: </strong> {userDetails.firstName}</p>
                  <p><strong>Last Name:</strong> {userDetails.lastName}</p>
                  <p><strong>Gender: </strong>{userDetails.gender || "N/A"}</p>
                  <p><strong>Age: </strong>{userDetails.age || "N/A"}</p>
                  <p><strong>Email: </strong>{userDetails.email}</p>
                  <button onClick={handleLogout}> Logout </button>
                </div>
              )}
            </div>
          </div>

          <div className="center-content">
            <h1>
              <i>Welcome {userDetails.firstName}</i>
            </h1>
            <img src="src/assets/dashboardimg.jpg" className="dashboard-image" alt="Dashboard" />
          </div>

          <center> <button className="btn btn-secondary" onClick={goToSpeechToText} style={{ marginTop: "20px" }}>Book an appointment</button></center>
          {/* Display User's Appointments */}
          <h2>Your Appointments</h2>
          <p>Unable to make it to your appointment?</p>
<a href="#" onClick={(e) => { e.preventDefault(); goToCancel(); }} className="cancel-link">
  Cancel Your Appointment
</a>
          {appointments.length > 0 ? (
            <table border="1">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Problem</th>
                  <th>Medical History</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{appointment.date || "Not specified"}</td>
                    <td>{appointment.time || "Not specified"}</td>
                    <td>{appointment.problem || "Not specified"}</td>
                    <td>{appointment.medicalHistory || "Not specified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No appointments found.</p>
          )}
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
}

export default Dashboard;                 