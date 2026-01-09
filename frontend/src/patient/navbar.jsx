import { useContext } from "react";
import { Link } from "react-router-dom";
import { ThemeContext } from "../context/ThemeContext";
import { Sun, Moon } from "lucide-react";
import "./Navbar.css"; // Ensure you have styling

const Navbar = () => {
  const { darkMode, setDarkMode } = useContext(ThemeContext);

  return (
    <nav className={`navbar ${darkMode ? "dark" : "light"}`}>
      <h1>CLINICEASE</h1>

      <ul>
        <li><Link to="/home">Home</Link></li>
        {/* <li><Link to="/dashboard">Dashboard</Link></li> */}
        <li><Link to="/login">Login</Link></li>
        <li><Link to="/register">Signup</Link></li>
        <li>
          {/* Dark/Light Mode Toggle */}
          <button onClick={() => setDarkMode(!darkMode)} className="toggle-btn">
            {darkMode ? <Sun size={24} className="text-yellow-400" /> : <Moon size={24} className="text-gray-700" />}
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
