import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ThemeContext } from "../context/ThemeContext";
import Login from "./LoginPage"; 
import Register from "../login/register";
import Dashboard from "./dashboard";
import Home from "./Home";
import SpeechToText from "./components/SpeechToText";
import { fetchGeminiResponse } from "./components/GeminiPrompt";
import "./PatApp.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { auth, db } from "../firebase/firebase"; // Adjust the path based on your folder structure
import { doc, getDoc } from "firebase/firestore";
import OCRModule from "./OCRModule"; 


function App() {
  const [response, setResponse] = useState("");
  const [patientDetails, setPatientDetails] = useState(null);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null); // Store Firestore user data separately
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [darkMode, setDarkMode] = useState(localStorage.getItem("theme") === "dark");
  const [loading, setLoading] = useState(true);

  

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setUser(user);
        try {
          const docRef = doc(db, "Users", user.uid); // Ensure UID matches Firestore document ID
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            console.log("No such user document!");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
  
    return () => unsubscribe();
  }, []);
  
  

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    document.body.className = darkMode ? "dark" : "light";
  }, [darkMode]);

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      <Router>
        <Routes>
          <Route path="/" element={<Register />} />
          <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard/*" element={user ? <Dashboard user={userData || user} /> : <Navigate to="/login" />} />
          <Route path="/dashboard/speechtotext" element={user ? <SpeechToText /> : <Navigate to="/login" />} />
          <Route path="/dashboard/prescription-ocr" element={user ? <OCRModule /> : <Navigate to="/login" />} />
        </Routes>
        <ToastContainer />
      </Router>
    </ThemeContext.Provider>
  );
}

export default App;
