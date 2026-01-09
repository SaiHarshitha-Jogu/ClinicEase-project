import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { toast } from "react-toastify";
import "./Login.css";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [activeProfile, setActiveProfile] = useState('doctor'); // Default to doctor

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



  const handleLogin = async (e, profileType) => {
    e.preventDefault();

    // Three-Profile Login System

    // 1. Doctor Login
    if (profileType === 'doctor' && email === "admin@gmail.com" && password === "admin@123") {
      toast.success("Welcome Doctor! Redirecting to Doctor Portal...");
      setTimeout(() => {
        navigate("/doctorportal", { replace: true });
      }, 1000);
      return;
    }

    // 2. Clinic Login  
    if (profileType === 'clinic' && email === "clinic@gmail.com" && password === "clinic123") {
      toast.success("Welcome Clinic Staff! Redirecting to Clinic Portal...");
      setTimeout(() => {
        navigate("/clinicportal", { replace: true });
      }, 1000);
      return;
    }

    // 3. Patient Login with Firebase
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome Patient! Redirecting to Dashboard...");
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1000);
    } catch (error) {
      // Better error handling for patient login
      if (error.code === "auth/user-not-found") {
        toast.error("Patient account not found. Please register first.");
      } else if (error.code === "auth/wrong-password") {
        toast.error("Incorrect password. Please try again.");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email format. Please check your email.");
      } else {
        toast.error("Login failed: " + error.message);
      }
    }
  };



  return (
    <div className="login-wrapper">
      <div className="login-left">

        <div className="tagline">
          <h1>Welcome back!</h1>
          <br />
          ClinicEase, where voice meets care! 👩🏻‍⚕️🩺
        </div>

        {/* Profile Selection Section */}
        <div className="profile-selection">
          <h4>🔑 Choose Your Profile</h4>
          <div className="profile-buttons">
            <button
              type="button"
              className={`profile-btn ${activeProfile === 'doctor' ? 'active' : ''}`}
              onClick={() => setActiveProfile('doctor')}
            >
              <span className="profile-icon">👨‍⚕️</span>
              <span className="profile-title">Doctor</span>
            </button>

            <button
              type="button"
              className={`profile-btn ${activeProfile === 'clinic' ? 'active' : ''}`}
              onClick={() => setActiveProfile('clinic')}
            >
              <span className="profile-icon">👩‍💼</span>
              <span className="profile-title">Clinic</span>
            </button>

            <button
              type="button"
              className={`profile-btn ${activeProfile === 'patient' ? 'active' : ''}`}
              onClick={() => setActiveProfile('patient')}
            >
              <span className="profile-icon">👤</span>
              <span className="profile-title">Patient</span>
            </button>
          </div>
        </div>

        {/* Login Forms Section */}
        <div className="login-forms-container">
          {/* Doctor Login Form */}
          {activeProfile === 'doctor' && (
            <div className="login-form-card">
              <div className="form-header">
                <h4>👨‍⚕️ Doctor Login</h4>
                <p>Access Doctor Portal</p>
              </div>

              <form onSubmit={(e) => handleLogin(e, 'doctor')}>
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="Enter doctor email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label>Password</label>
                <div className="password-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                  </button>
                </div>

                <button type="submit" className="submit-btn doctor-submit">Login as Doctor</button>
              </form>
            </div>
          )}

          {/* Clinic Login Form */}
          {activeProfile === 'clinic' && (
            <div className="login-form-card">
              <div className="form-header">
                <h4>👩‍💼 Clinic Login</h4>
                <p>Access Clinic Portal</p>
              </div>

              <form onSubmit={(e) => handleLogin(e, 'clinic')}>
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="Enter clinic email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label>Password</label>
                <div className="password-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                  </button>
                </div>

                <button type="submit" className="submit-btn clinic-submit">Login as Clinic Staff</button>
              </form>
            </div>
          )}

          {/* Patient Login Form */}
          {activeProfile === 'patient' && (
            <div className="login-form-card">
              <div className="form-header">
                <h4>👤 Patient Login</h4>
                <p>Access Patient Dashboard</p>
              </div>

              <form onSubmit={(e) => handleLogin(e, 'patient')}>
                <label>Email address</label>
                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />

                <label>Password</label>
                <div className="password-container">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                  </button>
                </div>

                <button type="submit" className="submit-btn patient-submit">Login as Patient</button>
              </form>

              <p className="register-link">
                New patient? <a href="/register">Register Here</a>
              </p>
            </div>
          )}
        </div>


      </div>


    </div>
  );
}

export default LoginPage;