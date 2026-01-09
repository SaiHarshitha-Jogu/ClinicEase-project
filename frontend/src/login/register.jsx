import { createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase/firebase";
import { setDoc, doc } from "firebase/firestore";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import "./register.css"; // Optional: for styling
import PatientPhotoUpload from "../components/PatientPhotoUpload.jsx";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [listeningField, setListeningField] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [patientPhoto, setPatientPhoto] = useState(null);
  const navigate = useNavigate();

  // Language options for speech recognition
  const languageOptions = [
    { code: "en-US", name: "English (US)", flag: "🇺🇸" },
    { code: "hi-IN", name: "Hindi (India)", flag: "🇮🇳" },
    { code: "te-IN", name: "Telugu (India)", flag: "🇮🇳" }
  ];

  // Check if user is already authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is already logged in, redirect to dashboard
        navigate("/dashboard", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Speech-to-text handler
  const handleSpeechToText = (setValue, fieldName) => {
    setListeningField(fieldName);
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = selectedLanguage;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript.toLowerCase();
      
      if (fieldName === "gender") {
        // Handle gender speech input
        if (speechText.includes("male")) {
          setValue("male");
        } else if (speechText.includes("female")) {
          setValue("female");
        } else if (speechText.includes("other")) {
          setValue("other");
        } else {
          toast.error("Please say 'male', 'female', or 'other'", { position: "top-center" });
        }
      } else if (fieldName === "age") {
        // Handle age speech input - extract numbers
        const numbers = speechText.match(/\d+/);
        if (numbers) {
          const age = parseInt(numbers[0]);
          if (age >= 1 && age <= 120) {
            setValue(age.toString());
          } else {
            toast.error("Please say an age between 1 and 120", { position: "top-center" });
          }
        } else {
          toast.error("Please say a valid age number", { position: "top-center" });
        }
      } else {
        // Handle other text fields normally
        setValue(speechText);
      }
      
      setListeningField(null);
    };
    recognition.onend = () => setListeningField(null);
    recognition.start();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "Users", user.uid), {
        email: user.email,
        firstName: fname,
        lastName: lname,
        gender: gender,
        age: age,
        medicalHistory: medicalHistory,
        photo: patientPhoto || ""
      });

      toast.success("User Registered Successfully!", { position: "top-center" });
      navigate("/login", { replace: true }); // Redirect to login after registration
    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        toast.error("This email is already in use. Try logging in instead!", { position: "bottom-center" });
      } else {
        toast.error(error.message, { position: "bottom-center" });
      }
    }
  };

  return (
    <form onSubmit={handleRegister} className="register-form">
      <h1>Sign Up</h1>
      
      {/* Language Selector */}
      <div className="language-selector">
        <label htmlFor="language-select">
          🌐 Select Language for Speech Recognition:
        </label>
        <select
          id="language-select"
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="language-dropdown"
        >
          {languageOptions.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.flag} {lang.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="mic-instruction">
        <span>Click the microphone icon to speak your entry instead of typing</span>
        <span className="current-language">Current language: {languageOptions.find(lang => lang.code === selectedLanguage)?.name}</span>
      </div>

      <label>First Name</label>
      <div className="field-container">
        <input
          type="text"
          placeholder="First name"
          onChange={(e) => setFname(e.target.value)}
          value={fname}
          required
        />
        <button
          type="button"
          onClick={() => handleSpeechToText(setFname, "fname")}
          disabled={listeningField === "fname"}
          className="voice-btn"
        >
          {listeningField === "fname" ? "🎤..." : "🎤"}
        </button>
      </div>

      <label>Last Name</label>
      <div className="field-container">
        <input
          type="text"
          placeholder="Last name"
          onChange={(e) => setLname(e.target.value)}
          value={lname}
        />
        <button
          type="button"
          onClick={() => handleSpeechToText(setLname, "lname")}
          disabled={listeningField === "lname"}
          className="voice-btn"
        >
          {listeningField === "lname" ? "🎤..." : "🎤"}
        </button>
      </div>

      <label>Gender</label>
      <div className="field-container">
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          required
        >
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
        <button
          type="button"
          onClick={() => handleSpeechToText(setGender, "gender")}
          disabled={listeningField === "gender"}
          className="voice-btn"
        >
          {listeningField === "gender" ? "🎤..." : "🎤"}
        </button>
      </div>

      <label>Age</label>
      <div className="field-container">
        <input
          type="number"
          placeholder="Enter your age"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          min="1"
          max="120"
          required
        />
        <button
          type="button"
          onClick={() => handleSpeechToText(setAge, "age")}
          disabled={listeningField === "age"}
          className="voice-btn"
        >
          {listeningField === "age" ? "🎤..." : "🎤"}
        </button>
      </div>

      <label>Email address</label>
      <input
        type="email"
        placeholder="Enter email"
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <label>Password</label>
      <input
        type="password"
        placeholder="Enter password"
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <label>Medical History</label>
      <div className="field-container">
        <input
          type="text"
          placeholder="Enter your medical history"
          onChange={(e) => setMedicalHistory(e.target.value)}
          value={medicalHistory}
        />
        <button
          type="button"
          onClick={() => handleSpeechToText(setMedicalHistory, "medicalHistory")}
          disabled={listeningField === "medicalHistory"}
          className="voice-btn"
        >
          {listeningField === "medicalHistory" ? "🎤..." : "🎤"}
        </button>
      </div>

      <PatientPhotoUpload 
        onPhotoCapture={setPatientPhoto}
        existingPhoto={patientPhoto}
        darkMode={false}
      />

      <button type="submit" className="btn btn-primary">Sign Up</button>

      <p className="register-link">
        Already registered? <Link to="/login">Login</Link>
      </p>
    </form>
  );
}

export default Register;