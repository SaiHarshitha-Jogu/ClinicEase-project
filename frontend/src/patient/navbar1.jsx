import { useContext, useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { Sun, Moon, Calendar, Upload } from "lucide-react";
import { getAuth, signOut, onAuthStateChanged} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebase"; // Ensure correct import
import "./Navbar.css";

const Navbar1 = () => {
  const { darkMode, setDarkMode } = useContext(ThemeContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [userDetails, setUserDetails] = useState(null);
  const auth = getAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth); // ✅ Correct way to sign out
      setUserDetails(null);
      navigate("/login", { replace: true });
      console.log("User logged out successfully!");
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };  

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
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
      } else {
        setUserDetails(null);
      }
    });
  
    return () => unsubscribe();
  }, [auth]);
  

  useEffect(() => {
    if (!showDropdown) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]); // ✅ Runs only when dropdown is open

  return (
    <nav className={`navbar ${darkMode ? "dark" : "light"}`}>
      <h1>CLINICEASE</h1>

      <ul>
        <li><Link to="/home" className={location.pathname === "/home" ? "active" : ""}>Home</Link></li>
        <li><Link to="/dashboard" className={location.pathname === "/dashboard" ? "active" : ""}>Dashboard</Link></li>
        <li>
          <Link 
            to="/dashboard/speechtotext" 
            className={`nav-button ${location.pathname === "/dashboard/speechtotext" ? "active" : ""}`}
          >
            <Calendar size={20} />
            <span>Book Appointment</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/prescription-ocr" 
            className={`nav-button ${location.pathname === "/prescription-ocr" ? "active" : ""}`}
          >
            <Upload size={20} />
            <span>Upload Prescription</span>
          </Link>
        </li>
        <li>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </li>
        <li>
          <button onClick={() => setDarkMode(!darkMode)} className="toggle-btn">
            {darkMode ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} className="text-gray-700" />}
          </button>
        </li>

        {/* User Profile Dropdown */}
        {userDetails && (
          <li
            className="user-icon-container"
            onMouseEnter={() => setShowDropdown(true)}
            onMouseLeave={() => setShowDropdown(false)}
          >
            <img 
              src={userDetails.photo || "/account.png"} 
              alt="User" 
              className="user-icon"
              onClick={(e) => {
                e.stopPropagation();
                if (userDetails.photo) {
                  // Open image in new tab or modal
                  const imageWindow = window.open();
                  imageWindow.document.write(`
                    <html>
                      <head><title>Profile Picture</title></head>
                      <body style="margin:0;padding:20px;background:#f0f0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                        <div style="text-align:center;">
                          <img src="${userDetails.photo}" style="max-width:100%;max-height:80vh;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);" />
                          <p style="margin-top:20px;font-family:Arial,sans-serif;color:#666;">Click anywhere to close</p>
                        </div>
                      </body>
                    </html>
                  `);
                  imageWindow.document.close();
                  imageWindow.onclick = () => imageWindow.close();
                }
              }}
              style={{ cursor: userDetails.photo ? 'pointer' : 'default' }}
              onError={(e) => {
                e.target.src = "/account.png"; // Fallback to default image
              }}
            />
            {showDropdown && (
              <div className="dropdown-menu" ref={dropdownRef}>
                <div className="profile-header">
                  <img 
                    src={userDetails.photo || "/account.png"} 
                    alt="Profile" 
                    className="profile-large-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (userDetails.photo) {
                        const imageWindow = window.open();
                        imageWindow.document.write(`
                          <html>
                            <head><title>Profile Picture</title></head>
                            <body style="margin:0;padding:20px;background:#f0f0f0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                              <div style="text-align:center;">
                                <img src="${userDetails.photo}" style="max-width:100%;max-height:80vh;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.2);" />
                                <p style="margin-top:20px;font-family:Arial,sans-serif;color:#666;">Click anywhere to close</p>
                              </div>
                            </body>
                          </html>
                        `);
                        imageWindow.document.close();
                        imageWindow.onclick = () => imageWindow.close();
                      }
                    }}
                    style={{ cursor: userDetails.photo ? 'pointer' : 'default' }}
                    onError={(e) => {
                      e.target.src = "/account.png";
                    }}
                  />
                  <div className="profile-name">
                    <h3>{userDetails.firstName || "N/A"} {userDetails.lastName || "N/A"}</h3>
                    <p className="profile-email">{userDetails.email || "N/A"}</p>
                  </div>
                </div>
                <div className="profile-details">
                  <div className="detail-item">
                    <span className="detail-label">Age:</span>
                    <span className="detail-value">{userDetails.age || "N/A"}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Gender:</span>
                    <span className="detail-value">{userDetails.gender || "N/A"}</span>
                  </div>
                  {userDetails.age < 15 && (
                    <div className="pediatric-notice">
                      <span className="pediatric-icon">👶</span>
                      <span>Pediatric patient (under 13)</span>
                    </div>
                  )}
                </div>
                <div className="profile-actions">
                  <button onClick={handleLogout} className="logout-button">
                    <span className="logout-icon">🚪</span>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar1;
