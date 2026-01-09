  // import { signInWithEmailAndPassword } from "firebase/auth";
  // import React, { useState } from "react";
  // import { auth } from "./firebase";
  // import { toast } from "react-toastify";
  // import SignInwithGoogle from "./signInWithGoogle";
  // import { useNavigate } from "react-router-dom";

  // function Login() {
  //   const [email, setEmail] = useState("");
  //   const [password, setPassword] = useState("");
  //   const navigate = useNavigate();

  //   // const handleSubmit = async (e) => {
  //   //   e.preventDefault();
  //   //   try {
  //   //     await signInWithEmailAndPassword(auth, email, password);
  //   //     console.log("User logged in Successfully");
  //   //     // window.location.href = "/dashboard";
  //   //     // toast.success("User logged in Successfully", {
  //   //     //   position: "top-center",
  //   //     // });
  //   //     toast.success("User logged in Successfully", { position: "top-center" });
  //   //     setTimeout(() => {
  //   //       navigate("/dashboard");
  //   //       // window.location.href = "/dashboard";
  //   //     }, 1000); // Adding a delay ensures the toast is displayed
  //   //   } catch (error) {
  //   //     console.log(error.message);

  //   //     toast.error(error.message, {
  //   //       position: "bottom-center",
  //   //     });
  //   //   }
  //   // };
  //   const handleSubmit = async (e) => {
  //     e.preventDefault();
  //     try {
  //       await signInWithEmailAndPassword(auth, email, password);
  //       toast.success("User logged in Successfully", { position: "top-center" });
    
        
  //       setTimeout(() => {
  //         navigate("/dashboard");
  //       }, 1000);

  //     } catch (error) {
  //       toast.error(error.message, { position: "bottom-center" });
  //     }
  //   };
    

  //   return (
  //     <div className="login-page-container">
  //       {/* Left Side - Login Form */}
  //       <div className="login-form">
  //         <h1>Welcome back!</h1>
  //         <h3 className="login-tag-line">ClinicEase, where voice meets care!👩🏻‍⚕️🩺</h3>

  //         <form onSubmit={handleSubmit}>
  //           <div>
  //             <label>Email address</label>
  //             <input
  //               type="email"
  //               className="form-control"
  //               placeholder="Enter email"
  //               value={email}
  //               onChange={(e) => setEmail(e.target.value)}
  //             />
  //           </div>

  //           <div>
  //             <label>Password</label>
  //             <input
  //               type="password"
  //               className="form-control"
  //               placeholder="Enter password"
  //               value={password}
  //               onChange={(e) => setPassword(e.target.value)}
  //             />
  //           </div>

  //           <div>
  //             <button type="submit" className="btn btn-primary">
  //               Submit
  //             </button>
  //           </div>
  //           <p className="register-here">
  //             New user? <a href="/register">Register Here</a>
  //           </p>
  //           <p>
  //             <SignInwithGoogle />
  //           </p>
  //         </form>
  //       </div>

  //       {/* Right Side - Image */}
  //       <div className="login-image">
  //         <img src="/login_img.jpg" alt="ClinicEase Illustration" />
  //       </div>
  //     </div>
  //   );
  // }

  // export default Login;


  import { signInWithEmailAndPassword } from "firebase/auth";
  import React, { useState, useEffect } from "react";
  import { auth } from "../firebase/firebase";
  import { toast, ToastContainer } from "react-toastify";
  import SignInwithGoogle from "./signInWithGoogle";
  import { useNavigate } from "react-router-dom";
  import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
  import OtpInput from "otp-input-react";
  import PhoneInput from "react-phone-input-2";
  import "react-phone-input-2/lib/style.css";
  import { BsFillShieldLockFill, BsTelephoneFill } from "react-icons/bs";
  import { CgSpinner } from "react-icons/cg";
  import "./index.css";
  import Navbar from "./navbar";
  import { AiFillEye } from "react-icons/ai";
  import { AiFillEyeInvisible } from "react-icons/ai";


  
  function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [showOTP, setShowOTP] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showPhoneAuth, setShowPhoneAuth] = useState(false);
    const [cooldownTime, setCooldownTime] = useState(0);
    const [isBlocked, setIsBlocked] = useState(false);
    const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  
    useEffect(() => {
      // Check if user was previously blocked
      const blockedUntil = localStorage.getItem('phoneAuthBlockedUntil');
      if (blockedUntil) {
        const timeLeft = Math.ceil((parseInt(blockedUntil) - Date.now()) / 1000);
        if (timeLeft > 0) {
          setIsBlocked(true);
          setCooldownTime(timeLeft);
        } else {
          localStorage.removeItem('phoneAuthBlockedUntil');
        }
      }
    }, []);
  
    useEffect(() => {
      let timer;
      if (cooldownTime > 0) {
        timer = setInterval(() => {
          setCooldownTime((prev) => {
            if (prev <= 1) {
              setIsBlocked(false);
              localStorage.removeItem('phoneAuthBlockedUntil');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      return () => {
        if (timer) clearInterval(timer);
      };
    }, [cooldownTime]);
  
    // Cleanup effect for reCAPTCHA
    useEffect(() => {
      return () => {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
      };
    }, []);
  
    const setupRecaptcha = async () => {
      // Clear any existing reCAPTCHA instance
      if (window.recaptchaVerifier) {
        await window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
  
      // Remove any existing reCAPTCHA iframes
      const iframes = document.getElementsByTagName('iframe');
      for (let i = 0; i < iframes.length; i++) {
        if (iframes[i].src.includes('recaptcha')) {
          iframes[i].remove();
        }
      }
  
      // Clear the container
      const container = document.getElementById('recaptcha-container');
      if (container) {
        container.innerHTML = '';
      }
  
      // Create new verifier
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: (response) => {
          console.log("reCAPTCHA verified");
          onSignupAfterCaptcha(response);
        },
        'expired-callback': () => {
          toast.error("reCAPTCHA expired. Please try again.");
          if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
          }
        }
      });
  
      window.recaptchaVerifier = verifier;
      await verifier.render();
      return verifier;
    };
  
    const onSignupAfterCaptcha = async (captchaResponse) => {
      try {
        const formatPhone = "+" + phone;
        console.log("Attempting to send OTP to:", formatPhone);
  
        const confirmationResult = await signInWithPhoneNumber(auth, formatPhone, window.recaptchaVerifier);
        window.confirmationResult = confirmationResult;
        setShowOTP(true);
        toast.success("OTP sent successfully! Please wait for the SMS.");
      } catch (error) {
        handleSignupError(error);
      } finally {
        setLoading(false);
      }
    };
  
    const handleSignupError = (error) => {
      console.error("Error sending OTP:", error);
      
      if (error.code === 'auth/too-many-requests') {
        // Set a longer block period (5 minutes)
        const blockDuration = 5 * 60; // 5 minutes in seconds
        setCooldownTime(blockDuration);
        setIsBlocked(true);
        
        // Store block end time in localStorage
        const blockUntil = Date.now() + (blockDuration * 1000);
        localStorage.setItem('phoneAuthBlockedUntil', blockUntil.toString());
        
        toast.error(`Too many attempts. Please try again in ${Math.floor(blockDuration / 60)} minutes.`);
      } else if (error.code === 'auth/invalid-phone-number') {
        toast.error("Please enter a valid phone number with country code");
      } else if (error.code === 'auth/quota-exceeded') {
        toast.error("SMS quota exceeded. Please try again later.");
      } else {
        toast.error("Error sending OTP. Please try again.");
      }
  
      // Reset reCAPTCHA on error
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  
    const onSignup = async () => {
      if (isBlocked) {
        toast.error(`Please wait ${Math.floor(cooldownTime / 60)} minutes and ${cooldownTime % 60} seconds before trying again`);
        return;
      }
  
      if (!phone || phone.length < 10) {
        toast.error("Please enter a valid phone number");
        return;
      }
  
      try {
        setLoading(true);
        await setupRecaptcha();
      } catch (error) {
        handleSignupError(error);
        setLoading(false);
      }
    };
  
    const handleOtpChange = (index, value) => {
      if (value.length > 1) return; // Prevent multiple digits
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
  
      // Auto-focus next input
      if (value && index < 5) {
        const nextInput = document.querySelector(`input[name=otp-${index + 1}]`);
        if (nextInput) nextInput.focus();
      }
    };
  
    const handleKeyDown = (index, e) => {
      if (e.key === 'Backspace' && !otp[index] && index > 0) {
        const prevInput = document.querySelector(`input[name=otp-${index - 1}]`);
        if (prevInput) prevInput.focus();
      }
    };
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("User logged in Successfully", { position: "top-center" });
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } catch (error) {
        toast.error(error.message, { position: "bottom-center" });
      }
    };
  
    const onOTPVerify = async () => {
      const otpString = otp.join("");
      if (otpString.length !== 6) {
        toast.error("Please enter a valid 6-digit OTP");
        return;
      }
  
      try {
        setLoading(true);
        const result = await window.confirmationResult.confirm(otpString);
        
        // Create user document in Firestore
        await setDoc(doc(db, "Users", result.user.uid), {
          phoneNumber: result.user.phoneNumber,
          createdAt: new Date(),
        }, { merge: true });
  
        setUser(result.user);
        toast.success("Phone number verified successfully!");
        navigate("/dashboard");
      } catch (error) {
        console.error("OTP Verification Error:", error);
        toast.error("Invalid OTP. Please try again.");
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <>
        <div className="login-page-container">
          <Navbar />
          <ToastContainer />4

          {/* reCAPTCHA container */}
          <div 
            id="recaptcha-container" 
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 1000
            }}
          ></div>

          {/* Login Form and Image Wrapper */}
          <div className="login-content-wrapper">
            {/* Left Side - Login Form */}
            <div className="login-form">
            <h1>Welcome back!</h1>
            <h3 className="login-tag-line">ClinicEase, where voice meets care!👩🏻‍⚕️🩺</h3>
  
            {!showPhoneAuth ? (
              // Email & Password Login Form
              <form onSubmit={handleSubmit}>
                <div>
                  <label>Email address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="Enter email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="password-container">
                  <label>Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <button type="submit" className="btn btn-primary">
                    Login with Email
                  </button>
                </div>
                <p className="register-here">
                  New user? <a href="/register">Register Here</a>
                </p>
                <div className="auth-divider">
                  <span>OR</span>
                </div>
                <SignInwithGoogle />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowPhoneAuth(true)}
                >
                  Login with Phone Number
                </button>
              </form>
            ) : !showOTP ? (
              // Phone Number Input Form
              <div className="phone-auth-container">
                <h3>Enter your phone number</h3>
                <PhoneInput
                  country={"in"}
                  value={phone}
                  onChange={(value) => {
                    console.log("Phone value:", value);
                    setPhone(value);
                  }}
                  placeholder="Enter phone number"
                />
                <button
                  onClick={onSignup}
                  className="btn btn-primary"
                  disabled={loading || isBlocked}
                >
                  {loading ? (
                    <CgSpinner size={20} className="animate-spin" />
                  ) : isBlocked ? (
                    `Wait ${Math.floor(cooldownTime / 60)}:${(cooldownTime % 60).toString().padStart(2, '0')}`
                  ) : (
                    "Send OTP"
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPhoneAuth(false);
                    if (window.recaptchaVerifier) {
                      window.recaptchaVerifier.clear();
                      window.recaptchaVerifier = null;
                    }
                  }}
                >
                  Back to Email Login
                </button>
                {isBlocked && (
                  <p className="text-danger mt-2">
                    Too many attempts. Please try again in {Math.floor(cooldownTime / 60)}:{(cooldownTime % 60).toString().padStart(2, '0')}
                  </p>
                )}
              </div>
            ) : (
              // OTP Verification Form
              <div className="otp-container">
                <h3>Enter the OTP</h3>
                <div className="otp-input-container">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      name={`otp-${index}`}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      maxLength="1"
                      className="otp-digit"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>
                <button
                  onClick={onOTPVerify}
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <CgSpinner size={20} className="animate-spin" />
                  ) : (
                    "Verify OTP"
                  )}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowOTP(false);
                    setOtp(["", "", "", "", "", ""]);
                  }}
                >
                  Back to Phone Input
                </button>
              </div>
            )}
          </div>
  
            {/* Right Side - Image */}
            <div className="login-image">
              <img src="/login_img.jpg" alt="Modern Dental Clinic" />
            </div>
          </div>

          {/* Home Content Section */}
          <div className="home-content-section">
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
        </div>
      </>
    );
  }
  
  export default Login;
    