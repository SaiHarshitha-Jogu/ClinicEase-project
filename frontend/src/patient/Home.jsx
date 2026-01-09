import { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../context/ThemeContext";
import Navbar from "./navbar";
import Navbar1 from "./navbar1"; 
import { auth } from "../firebase/firebase";
import { useNavigate } from "react-router-dom";
import "./Home.css"; // Import the external CSS file


function Home() {
  const { darkMode } = useContext(ThemeContext);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
      } else {
        // If no user is logged in, redirect to login page
        navigate("/login", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Show loading while checking authentication
  if (!user) {
    return (
      <div className={`home-container ${darkMode ? "dark" : "light"}`}>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={`home-container ${darkMode ? "dark" : "light"}`}>
      <Navbar1 />


      {/* About & Features Section */}
      <div className="about-features-section">
        <div className="container">
          <div className="about-features-content">
            {/* About Section - Left Side */}
            <div className="about-side">
              <div className="about-text">
                <h2>About Star Smiles Dental Care</h2>
                <p>
                  Led by <strong>Prof. Dr. Manjunatha Reddy C (BDS, MDS - Orthodontics)</strong>, 
                  our clinic is dedicated to providing top-notch dental services with state-of-the-art equipment 
                  and an expert medical team.
                </p>
                <p>
                  We specialize in everything from routine check-ups and preventive care to complex procedures, 
                  ensuring each patient receives the most effective and innovative treatments available.
                </p>
                <div className="stats">
                  <div className="stat">
                    <span className="stat-number">500+</span>
                    <span className="stat-label">Happy Patients</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">10+</span>
                    <span className="stat-label">Years Experience</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">100%</span>
                    <span className="stat-label">Patient Satisfaction</span>
                  </div>
                </div>
              </div>
              <div className="about-image">
                <img src="/company_logo.jpg" alt="Star Smiles Dental Care Logo" />
              </div>
            </div>

            {/* Features Section - Right Side */}
            <div className="features-side">
              <h2 className="section-title">Why Choose ClinicEase?</h2>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">🎤</div>
                  <h3>Voice-Activated</h3>
                  <p>Control everything with your voice - no more clicking through menus or filling forms</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📅</div>
                  <h3>Smart Scheduling</h3>
                  <p>Book appointments instantly with AI-powered scheduling that finds the best time slots</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📋</div>
                  <h3>Digital Records</h3>
                  <p>Manage medical records, prescriptions, and reports all in one secure platform</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔍</div>
                  <h3>OCR Technology</h3>
                  <p>Scan and digitize prescriptions automatically with advanced image recognition</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">💳</div>
                  <h3>Easy Payments</h3>
                  <p>Secure online payments with Razorpay integration for hassle-free transactions</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">📱</div>
                  <h3>Mobile Ready</h3>
                  <p>Access your healthcare data anywhere, anytime with our responsive design</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="cta-section">
        <div className="container">
          <h2>Ready to Experience Smart Healthcare?</h2>
          <p>Join thousands of patients who have transformed their healthcare experience with ClinicEase</p>
          <button 
            className="btn btn-primary btn-large"
            onClick={() => navigate("/dashboard")}
          >
            Get Started Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home;
