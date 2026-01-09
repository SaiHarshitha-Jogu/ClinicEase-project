// src/login/HomePage.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./HomePage.css";

function HomePage() {
  return (
    <div className="homepage-container">
        <h3>Welcome to</h3>
      <h1 className="homepage-title">ClinicEase</h1>
      <p className="homepage-tagline">Where voice meets care — Simplifying healthcare for doctors, clinics, and patients</p>
      <div className="homepage-buttons">
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
      </div>
    </div>
  );
}

export default HomePage;
