// Updated DocApp.jsx (main App routing)
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Login from "./LoginPage";
import Register from "./register";
import Dashboard from "./dashboard";
import DoctorPortal from "./DoctorPortal";
import PatientInfo from "./PatientInfo";
import SpeechToText from "./components/SpeechToText";
import CancelAppointment from "./cancelappointment";
import CancelDoctor from "./canceldoctor";
import ClinicPortal from "./ClinicPortal";
import PatientInfoClinic from "./PatientInfoClinic";
import Trial from "./testingemail";
import { auth, db } from "../firebase/firebase.js";
import { getDoc, doc } from "firebase/firestore";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./DocApp.css";

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
      if (userAuth) {
        try {
          const docRef = doc(db, "Users", userAuth.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUser({ uid: userAuth.uid, ...docSnap.data() });
          } else {
            setUser({ uid: userAuth.uid, email: userAuth.email });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            user ? (
              user.email === "admin@gmail.com" ? (
                <Navigate to="/doctorportal" />
              ) : user.email === "clinic@gmail.com" ? (
                <Navigate to="/clinicportal" />
              ) : (
                <Navigate to="/dashboard" />
              )
            ) : (
              <Login />
            )
          }
        />
        <Route path="/register" element={<Register />} />
        <Route path="/doctorportal" element={<DoctorPortal user={user} />} />
        <Route path="/cancelappointment" element={<CancelAppointment user={user} />} />
        <Route path="/canceldoctor" element={<CancelDoctor user={user} />} />
        <Route path="/clinicportal" element={<ClinicPortal user={user} />} />
        <Route path="/dashboard" element={<Dashboard user={user} />} />
        <Route path="/speechtotext" element={<SpeechToText user={user} />} />
        <Route path="/patientinfo" element={<PatientInfo user={user} />} />
        <Route path="/patientinfoclinic" element={<PatientInfoClinic user={user} />} />
        <Route path="/testingemail" element={<Trial />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
