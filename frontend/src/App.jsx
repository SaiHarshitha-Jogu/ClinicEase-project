// src/App.jsx
import { Routes, Route } from "react-router-dom";
import Login from "./login/Login";
import DoctorPortal from "./doctor/DoctorPortal";
import Dashboard from "./patient/dashboard";
import Register from "./login/register";
import PatientInfo from "./doctor/PatientInfo";
import PatientInfoClinic from "./doctor/PatientInfoClinic";
import HomePage from "./login/HomePage"; // If PatientInfo is directly routed
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useState } from "react";
import { ThemeContext } from "./context/ThemeContext";
import SpeechToText from "./patient/components/SpeechToText";
import OCRModule from "./patient/OCRModule";
import PatientLogin from "./patient/LoginPage";
import CancelDoctor from "./doctor/canceldoctor";
import ClinicPortal from "./doctor/ClinicPortal"
import Home from "./patient/Home";
import AIAssistant from "./ai/AIAssistant";
function App() {
  const [darkMode, setDarkMode] = useState(false);
  return (
    <>
      <Routes>
        {/* Main login page for both admin and normal users */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        {/* Patient Home page (for logged-in users) */}
        <Route path="/home" element={
          <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
            <Home />
          </ThemeContext.Provider>
        } />
        {/* Patient register page (now uses src/login/register.jsx) */}
        <Route path="/register" element={
          <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
            <Register />
          </ThemeContext.Provider>
        } />
        {/* Patient dashboard route (for normal users after login) */}
        <Route path="/dashboard/*" element={
          <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
            <Dashboard />
          </ThemeContext.Provider>
        } />
        <Route path="/dashboard/speechtotext" element={
          <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
            <SpeechToText />
          </ThemeContext.Provider>
        } />
        <Route path="/dashboard/prescription-ocr" element={
          <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
            <OCRModule />
          </ThemeContext.Provider>
        } />
        <Route path="/prescription-ocr" element={
          <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
            <OCRModule />
          </ThemeContext.Provider>
        } />
        <Route path="/doctorportal/*" element={<DoctorPortal />} />
        <Route path="/patientinfo" element={<PatientInfo />} />
        <Route path="/patientinfoclinic" element={<PatientInfoClinic />} />
        <Route path="/canceldoctor" element={<CancelDoctor />} /> 
         <Route path="/clinicportal" element={<ClinicPortal />} />
        <Route path="/assistant" element={<AIAssistant />} />
      </Routes>

      <ToastContainer position="top-right" autoClose={3000} />
    </>
  );
}

export default App;


