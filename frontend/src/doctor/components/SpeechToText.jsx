import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMicrophoneAlt, faStop, faGlobe } from "@fortawesome/free-solid-svg-icons";
import { fetchGeminiResponse } from "./GeminiPrompt";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { collection, addDoc, Timestamp, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { sendAppointmentConfirmationEmail } from "../../utils/emailService.js";
import { sendImmediateReminderForSameDay } from "../../utils/appointmentReminderService.js";

const SpeechToText = () => {
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [problem, setProblem] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [response, setResponse] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState({});
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const navigate = useNavigate();
  const auth = getAuth();

  const [userDetails, setUserDetails] = useState(null);

  // Language options for speech recognition
  const languageOptions = [
    { code: "en-US", name: "English (US)", flag: "🇺🇸" },
    { code: "hi-IN", name: "Hindi (India)", flag: "🇮🇳" },
    { code: "te-IN", name: "Telugu (India)", flag: "🇮🇳" }
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
        } else {
          console.log("No user data found");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM",
    "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"
  ];

  // Generate next 15 days dynamically
  const getNext15Days = () => {
    return Array.from({ length: 15 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index);
      return date.toISOString().split("T")[0]; // Format YYYY-MM-DD
    });
  };

  const availableDates = getNext15Days();

  // Fetch booked slots for the logged-in user
  useEffect(() => {
    const fetchBookedSlots = async () => {
      const appointmentsCollection = collection(db, "Appointments");
  
      try {
        const querySnapshot = await getDocs(appointmentsCollection);
        const bookedSlots = {};
  
        querySnapshot.forEach((doc) => {
          const { date, time } = doc.data();
  
          if (!bookedSlots[date]) bookedSlots[date] = [];
          bookedSlots[date].push(time); // Store booked times for each date
        });
  
        setAvailableSlots(bookedSlots);
      } catch (error) {
        console.error("Error fetching booked slots:", error);
      }
    };
  
    fetchBookedSlots();
  }, [selectedDate]);
  

  const startListening = (field, setField) => {
    setIsListening(true);
    setActiveField(field);

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = selectedLanguage;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript;
      setField(speechText);
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveField(null);
    };

    recognition.start();
  };

  const stopListening = () => {
    setIsListening(false);
    setActiveField(null);
  };

  // const confirmDetails = async () => {
  //   const user = auth.currentUser;
  //   if (!user) {
  //     alert("No user is logged in!");
  //     return;
  //   }
  
  //   if (!selectedDate || !selectedTime) {
  //     alert("Please select a date and time slot!");
  //     return;
  //   }
  
  //   // Prevent booking if the slot is already taken
  //   if (availableSlots[selectedDate]?.includes(selectedTime)) {
  //     alert("This slot is already booked! Please select another.");
  //     return;
  //   }
  
  //   const userId = user.uid;
  
  //   const details = {
  //     userId,
  //     name,
  //     gender,
  //     age,
  //     medicalHistory,
  //     problem,
  //     date: selectedDate,
  //     time: selectedTime,
  //     createdAt: Timestamp.now(),
  //   };
  
  //   try {
  //     // Save to Firestore
  //     await addDoc(collection(db, "Appointments"), details);
  
  //     console.log("Appointment booked successfully for user:", userId);
  //     alert("Appointment booked successfully!");
  
  //     // Update UI
  //     setAvailableSlots((prevSlots) => ({
  //       ...prevSlots,
  //       [selectedDate]: [...(prevSlots[selectedDate] || []), selectedTime],
  //     }));
  //   } catch (error) {
  //     console.error("Error storing appointment:", error);
  //     alert("Failed to book appointment.");
  //   }
  
  //   // Fetch AI response
  //   const promptText = `Name: ${details.name}, Gender: ${details.gender}, Age: ${details.age}, Medical History: ${details.medicalHistory}, Problem: ${details.problem}`;
  //   const aiResponse = await fetchGeminiResponse(promptText);
  
  //   setResponse(aiResponse);
  //   setShowAnalysis(true);
  // };

  const confirmDetails = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("No user is logged in!");
      return;
    }
  
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time slot!");
      return;
    }
  
    if (availableSlots[selectedDate]?.includes(selectedTime)) {
      alert("This slot is already booked! Please select another.");
      return;
    }
  
    const userId = user.uid;
  
    const promptText = `Name: ${name}, Gender: ${gender}, Age: ${age}, Medical History: ${medicalHistory}, Problem: ${problem}`;
    const aiResponse = await fetchGeminiResponse(promptText); // Fetch AI analysis
  
    const details = {
      userId,
      name,
      gender,
      age,
      medicalHistory,
      problem,
      date: selectedDate,
      time: selectedTime,
      createdAt: Timestamp.now(),
      aiAnalysis: aiResponse, // ✅ Store AI response in Firestore
    };
  
    try {
      await addDoc(collection(db, "Appointments"), details); // Save all details including AI analysis
      console.log("Appointment booked successfully for user:", userId);
      
      // Send appointment confirmation email
      if (userDetails?.email) {
        const emailSent = await sendAppointmentConfirmationEmail({
          name: userDetails.firstName || name,
          email: userDetails.email,
          date: selectedDate,
          time: selectedTime,
          problem: problem,
          doctorName: "Dr. Manjunath"
        });
        
        if (emailSent) {
          console.log("Appointment confirmation email sent successfully");
        } else {
          console.log("Appointment booked but email confirmation failed");
        }

        // Send immediate reminder if appointment is for today
        const appointmentDetails = {
          patientName: userDetails.firstName || name,
          email: userDetails.email,
          date: selectedDate,
          time: selectedTime,
          problem: problem,
          doctorName: "Dr. Manjunath"
        };

        const reminderSent = await sendImmediateReminderForSameDay(db, appointmentDetails);
        if (reminderSent) {
          console.log("Immediate reminder sent for same-day appointment");
        } else {
          console.log("No immediate reminder sent (appointment not for today or failed)");
        }
      }
      
      alert("Appointment booked successfully!");
  
      // Update UI
      setAvailableSlots((prevSlots) => ({
        ...prevSlots,
        [selectedDate]: [...(prevSlots[selectedDate] || []), selectedTime],
      }));
  
      setResponse(aiResponse); // Show AI response in UI
      setShowAnalysis(true);
    } catch (error) {
      console.error("Error storing appointment:", error);
      alert("Failed to book appointment.");
    }
  };
  


  return (
    <div className="form-container">
      <div className="left-section">
        <h2>Patient Details</h2>
        
        {/* Language Selector */}
        <div className="language-selector">
          <label htmlFor="language-select">
            <FontAwesomeIcon icon={faGlobe} />
            <span>Select Language for Speech Recognition:</span>
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
        {[
          { label: "Medical History", value: medicalHistory, setValue: setMedicalHistory, field: "medicalHistory" },
          { label: "Problem", value: problem, setValue: setProblem, field: "problem" },
        ].map(({ label, value, setValue, field }) => (
          <div className="speech-input-container" key={field}>
            <label>{label}:</label>
            <input type="text" placeholder={`Enter ${label}`} value={value} onChange={(e) => setValue(e.target.value)} />
            <button onClick={() => startListening(field, setValue)} disabled={isListening && activeField !== field}>
              {isListening && activeField === field ? <FontAwesomeIcon icon={faStop} onClick={stopListening} /> : <FontAwesomeIcon icon={faMicrophoneAlt} />}
            </button>
          </div>
        ))}

        {/* Appointment Booking Section */}
        <h2>Book an Appointment</h2>
        <div className="appointment-container">
          <label>Select Date:</label>
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            <option value="">Select a date</option>
            {availableDates.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>

          <label>Select Time Slot:</label>
          <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} disabled={!selectedDate}>
            <option value="">Select a time</option>
            {timeSlots
              .filter(time => !(availableSlots[selectedDate] || []).includes(time)) // Hide booked slots
              .map(time => (
                <option key={time} value={time}>{time}</option>
              ))
            }
          </select>

        </div>

        <button className="confirm-btn" onClick={confirmDetails}>Confirm</button>
        <button onClick={() => navigate("/dashboard")}>Back</button>
      </div>

      {/* Analysis Section */}
      {showAnalysis && (
        <div className="analysis-container">
          <h2>Appointment Details:</h2>
          <p><strong>Name:</strong> {userDetails.firstName}</p>
          <p><strong>Medical History:</strong> {medicalHistory}</p>
          <p><strong>Problem:</strong> {problem}</p>
          <p><strong>Appointment Date:</strong> {selectedDate}</p>
          <p><strong>Appointment Time:</strong> {selectedTime}</p>

          <h2>Analysis:</h2>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
};

export default SpeechToText;
