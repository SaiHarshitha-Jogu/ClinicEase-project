import React, { useState, useEffect, useContext } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMicrophoneAlt, faStop, faInfoCircle, faCheck, faSpinner, faGlobe } from "@fortawesome/free-solid-svg-icons";
import { fetchGeminiResponse } from "./GeminiPrompt.jsx";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebase";
import { collection, addDoc, Timestamp, onSnapshot, getDocs, doc, getDoc } from "firebase/firestore";
import Navbar1 from "../navbar1";
import { getAuth } from "firebase/auth";
import { ThemeContext } from "../../context/ThemeContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./SpeechToText.css";
import { sendAppointmentConfirmationEmail } from "../../utils/emailService.js";
import { sendImmediateReminderForSameDay } from "../../utils/appointmentReminderService.js";

const SpeechToText = () => {
  const { darkMode } = useContext(ThemeContext);
  const [medicalHistory, setMedicalHistory] = useState("");
  const [problem, setProblem] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [response, setResponse] = useState("");
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const navigate = useNavigate();
  const auth = getAuth();

  // Language options for speech recognition
  const languageOptions = [
    { code: "en-US", name: "English (US)", flag: "🇺🇸" },
    { code: "hi-IN", name: "Hindi (India)", flag: "🇮🇳" },
    { code: "te-IN", name: "Telugu (India)", flag: "🇮🇳" }
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const docRef = doc(db, "Users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        toast.error("Error loading user data");
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const appointmentsCollection = collection(db, "Appointments");
    const unsubscribe = onSnapshot(appointmentsCollection, (querySnapshot) => {
      const bookedSlots = {};
      querySnapshot.forEach((doc) => {
        const { date, time } = doc.data();
        if (!bookedSlots[date]) bookedSlots[date] = [];
        bookedSlots[date].push(time);
      });
      setAvailableSlots(bookedSlots);
    });
    return () => unsubscribe();
  }, []);

  const startListening = async (field, setField) => {
    try {
      setIsListening(true);
      setActiveField(field);

      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = selectedLanguage;
      recognition.interimResults = false;

      recognition.onresult = (event) => {
        const speechText = event.results[0][0].transcript;
        setField(speechText);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        toast.error("Error with speech recognition. Please try again.");
        setIsListening(false);
        setActiveField(null);
      };

      recognition.onend = () => {
        setIsListening(false);
        setActiveField(null);
      };

      recognition.start();
    } catch (error) {
      console.error("Speech recognition error:", error);
      toast.error("Speech recognition not supported in this browser");
      setIsListening(false);
      setActiveField(null);
    }
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        return medicalHistory.trim() !== "" && problem.trim() !== "";
      case 2:
        return selectedDate !== null;
      case 3:
        return selectedTime !== "";
      case 4:
        return true; // Photo is optional
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    } else {
      toast.warning("Please fill in all required fields");
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  // Check if a time slot is in the past for today
  const isTimeSlotPast = (timeSlot, date) => {
    if (!date) return false;
    
    const today = new Date();
    const slotDate = new Date(date);
    
    // Check if the slot date is today
    if (slotDate.toDateString() !== today.toDateString()) {
      return false;
    }
    
    // Parse the time slot (e.g., "09:00 AM")
    const [time, period] = timeSlot.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    // Convert to 24-hour format
    let slotHours = hours;
    if (period === 'PM' && hours !== 12) {
      slotHours += 12;
    } else if (period === 'AM' && hours === 12) {
      slotHours = 0;
    }
    
    // Create slot time
    const slotTime = new Date();
    slotTime.setHours(slotHours, minutes || 0, 0, 0);
    
    // Check if slot time has passed
    return slotTime < today;
  };

  // Convert 12-hour format to 24-hour format
  const convertTo24Hour = (time12h) => {
    const [time, modifier] = time12h.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    
    if (hours === 12) {
      hours = 0;
    }
    
    if (modifier === 'PM') {
      hours = hours + 12;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const confirmDetails = async () => {
    if (!validateStep(3)) {
      toast.warning("Please select a time slot");
      return;
    }

    setIsLoading(true);
    const user = auth.currentUser;
    
    try {
      const formattedDate = selectedDate.toLocaleDateString("en-CA");
      
      if (availableSlots[formattedDate]?.includes(selectedTime)) {
        toast.error("This slot is already booked! Please select another.");
        return;
      }

      const promptText = `Name: ${userDetails?.firstName}, Gender: ${userDetails?.gender}, Age: ${userDetails?.age}, Medical History: ${medicalHistory}, Problem: ${problem}`;
      const aiResponse = await fetchGeminiResponse(promptText);

      const details = {
        userId: user.uid,
        name: userDetails?.firstName || "",
        gender: userDetails?.gender || "",
        age: userDetails?.age || "",
        medicalHistory: medicalHistory || "",
        problem: problem || "",
        date: formattedDate || "",
        time: selectedTime || "",
        createdAt: Timestamp.now(),
        aiAnalysis: aiResponse || ""
      };

      await addDoc(collection(db, "Appointments"), details);
      
      // Send appointment confirmation email
      if (userDetails?.email) {
        const emailSent = await sendAppointmentConfirmationEmail({
          name: userDetails?.firstName || "",
          email: userDetails?.email,
          date: formattedDate || "",
          time: selectedTime || "",
          problem: problem || "",
          doctorName: "Dr. Manjunath"
        });
        
        if (emailSent) {
          toast.success("Appointment confirmation email sent!");
        } else {
          toast.warn("Appointment booked but email confirmation failed");
        }

        // Send immediate reminder if appointment is for today
        const appointmentDetails = {
          patientName: userDetails?.firstName || "",
          email: userDetails?.email,
          date: formattedDate || "",
          time: selectedTime || "",
          problem: problem || "",
          doctorName: "Dr. Manjunath"
        };

        const reminderSent = await sendImmediateReminderForSameDay(db, appointmentDetails);
        if (reminderSent) {
          console.log("Immediate reminder sent for same-day appointment");
          toast.success("Reminder email sent for today's appointment!");
        } else {
          console.log("No immediate reminder sent (appointment not for today or failed)");
        }
      }
      
      toast.success("Appointment booked successfully!");
      
      // Redirect to dashboard after successful booking
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
      
    } catch (error) {
      console.error("Error storing appointment:", error);
      toast.error("Failed to book appointment");
    } finally {
      setIsLoading(false);
    }
  };

  const timeSlots = [
    "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
    "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM",
    "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM"
  ];

  const renderStep = () => {
    try {
      switch (currentStep) {
        case 1:
          return (
            <div className="form-section active">
              <div className="form-content">
                <h2>Medical Information</h2>
                
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
                  <FontAwesomeIcon icon={faInfoCircle} />
                  <span>Click the microphone icon to speak your entry instead of typing</span>
                  <span className="current-language">Current language: {languageOptions.find(lang => lang.code === selectedLanguage)?.name}</span>
                  <div className="language-tips">
                    <p><strong>Language Tips:</strong></p>
                    <ul>
                      <li><strong>English:</strong> Speak clearly in English</li>
                      <li><strong>Hindi:</strong> बोलते समय स्पष्ट और धीरे बोलें</li>
                      <li><strong>Telugu:</strong> మాట్లాడేటప్పుడు స్పష్టంగా మరియు నెమ్మదిగా మాట్లాడండి</li>
                    </ul>
                  </div>
                </div>
                {[
                  { label: "Medical History", value: medicalHistory, setValue: setMedicalHistory, field: "medicalHistory" },
                  { label: "Problem Description", value: problem, setValue: setProblem, field: "problem" }
                ].map(({ label, value, setValue, field }) => (
                  <div key={field} className="input-group">
                    <label>{label}</label>
                    <div className="input-with-mic">
                      <input 
                        type="text" 
                        placeholder={`Enter ${label}`} 
                        value={value} 
                        onChange={(e) => setValue(e.target.value)}
                      />
                      <button 
                        className={`mic-button ${isListening && activeField === field ? 'active' : ''}`}
                        onClick={() => startListening(field, setValue)} 
                        disabled={isListening && activeField !== field}
                      >
                        <FontAwesomeIcon 
                          icon={isListening && activeField === field ? faStop : faMicrophoneAlt} 
                          spin={isListening && activeField === field}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="navigation-buttons">
                <div style={{ width: '120px' }}></div>
                <button onClick={nextStep} disabled={!validateStep(currentStep)}>Next</button>
              </div>
            </div>
          );
        case 2:
          return (
            <div className="form-section active calendar-section">
              <div className="form-content">
                <h2>Select Appointment Date</h2>
                <div className="calendar-wrapper">
                  <Calendar
                    onChange={setSelectedDate}
                    value={selectedDate}
                    minDate={new Date()}
                    tileDisabled={({ date }) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      return date < today;
                    }}
                    className="appointment-calendar"
                  />
                </div>
              </div>
              <div className="navigation-buttons">
                <button onClick={prevStep}>Previous</button>
                <button onClick={nextStep} disabled={!validateStep(currentStep)}>Next</button>
              </div>
            </div>
          );
        case 3:
          return (
            <div className="form-section active">
              <div className="form-content">
                <h2>Select Time Slot</h2>
                <div className="time-slots-grid">
                  {timeSlots.map((time) => {
                    const formattedDate = selectedDate?.toLocaleDateString("en-CA");
                    const isBooked = formattedDate && availableSlots[formattedDate]?.includes(time);
                    const isSelected = selectedTime === time;
                    const isPast = isTimeSlotPast(time, selectedDate);
                    
                    return (
                      <div
                        key={time}
                        className={`time-slot ${isBooked ? "booked" : ""} ${isSelected ? "selected" : ""} ${isPast ? "past" : ""}`}
                        onClick={() => !isBooked && !isPast && setSelectedTime(time)}
                        title={isPast ? "This time slot has passed" : isBooked ? "This slot is already booked" : "Select this time slot"}
                      >
                        {time}
                        {isPast && <span className="past-indicator">✗</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="navigation-buttons">
                <button onClick={prevStep}>Previous</button>
                <button onClick={nextStep} disabled={!validateStep(currentStep)}>Next</button>
              </div>
            </div>
          );
        case 4:
          return (
            <div className="form-section active">
              <div className="form-content">
                <h3>Review Your Appointment Details</h3>
                <div className="appointment-summary">
                  <p><strong>Date:</strong> {selectedDate ? selectedDate.toLocaleDateString() : 'Not selected'}</p>
                  <p><strong>Time:</strong> {selectedTime || 'Not selected'}</p>
                  <p><strong>Problem:</strong> {problem || 'Not specified'}</p>
                  <p><strong>Medical History:</strong> {medicalHistory || 'Not specified'}</p>
                </div>
              </div>
              <div className="navigation-buttons">
                <button onClick={prevStep}>Previous</button>
                <button onClick={confirmDetails} disabled={!validateStep(currentStep) || isLoading}>
                  {isLoading ? <FontAwesomeIcon icon={faSpinner} spin /> : "Confirm Appointment"}
                </button>
              </div>
            </div>
          );
        default:
          console.warn(`Invalid step: ${currentStep}, resetting to step 1`);
          setCurrentStep(1);
          return null;
      }
    } catch (error) {
      console.error("Error in renderStep:", error);
      return (
        <div className="form-section active">
          <div className="form-content">
            <h2>Something went wrong</h2>
            <p>Please refresh the page and try again.</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className={`form-container ${darkMode ? 'dark' : 'light'}`}>
      <Navbar1 />
      <div className="main-content">
        <div className="left-section">
          <div className="progress-steps">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`step ${currentStep === step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}
              >
                {currentStep > step ? (
                  <FontAwesomeIcon icon={faCheck} />
                ) : (
                  step
                )}
              </div>
            ))}
          </div>
          {renderStep()}
        </div>

        {showAnalysis && (
          <div className="appointment-analysis-section">
            <h3>AI Analysis</h3>
            <div className="appointment-analysis-content">
              {response ? (
                <div>
                  <p><strong>Diagnosis:</strong></p>
                  <p>{response}</p>
                  <p><strong>Recommendations:</strong></p>
                  <ul>
                    <li>Please arrive 10 minutes before your scheduled appointment time</li>
                    <li>Bring any relevant medical records or test results</li>
                    <li>If symptoms worsen before the appointment, please contact emergency services</li>
                  </ul>
                </div>
              ) : (
                <div className="loading">
                  <FontAwesomeIcon icon={faSpinner} spin />
                  <p>Analyzing your details...</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeechToText;