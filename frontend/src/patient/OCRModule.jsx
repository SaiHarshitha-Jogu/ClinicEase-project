import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebase";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import Navbar1 from "./navbar1";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

import "./OCRModule.css";
import { Upload } from "lucide-react";
import { Clipboard, CheckCircle2 } from "lucide-react";

function OCRModule() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [output, setOutput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState("No file chosen");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const navigate = useNavigate();

  // Check if user is logged in
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        toast.error("Please log in to use this feature");
        navigate("/login", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setFileName(file ? file.name : "No file chosen");
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("prescription", selectedFile);

    try {
      // First verify user is logged in
      const user = auth.currentUser;
      if (!user) {
        toast.error("Please log in to save medicines");
        navigate("/login", { replace: true });
        return;
      }

      console.log("Uploading prescription for user:", user.uid);

     const API_URL = "https://clinicease-project.onrender.com";
      const response = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to process image: ${errorText}`);
      }

      const result = await response.json();
      console.log("Extracted medicine data:", result);

      if (!result.medicines || !Array.isArray(result.medicines)) {
        throw new Error("Invalid medicine data received");
      }

      setOutput(result.medicines);

      // Format the medicines data with additional fields
      const medicinesList = result.medicines.map(med => ({
        name: med.name?.trim() || 'Unknown Medicine',
        dosage: med.dosage?.trim() || 'No dosage specified',
        timing: med.timing?.trim() || 'Timing not specified',
        frequency: med.frequency?.trim() || 'Frequency not specified',
        instructions: med.instructions?.trim() || 'No special instructions'
      }));

      // Create the medicines document
      const medicineData = {
        userId: user.uid,
        userEmail: user.email,
        medicines: medicinesList,
        createdAt: Timestamp.now(),
        fileName: selectedFile.name
      };

      console.log("Attempting to save medicine data:", medicineData);

      // Save to Firebase
      const docRef = await addDoc(collection(db, "medicines"), medicineData);
      console.log("Medicines saved with ID:", docRef.id);

      toast.success("Medicines saved successfully!");
    } catch (error) {
      console.error("Error:", error);
      setOutput(error.message);
      toast.error(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopy = (med, index) => {
    const text = `Medicine: ${med.name}\nDosage: ${med.dosage}\nTiming: ${med.timing || "Not specified"}\nFrequency: ${med.frequency || "Not specified"}${med.instructions ? `\nInstructions: ${med.instructions}` : ""}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedIndex(null), 1500);
    }).catch(() => toast.error("Failed to copy"));
  };

  return (
    <div className="ocr-module">
      <Navbar1 />
      <div className="ocr-container">
        <div className="upload-section">
          <div className="upload-header">
            <h1>Upload Prescription</h1>
            <p>Select an image of your prescription to extract medicine details</p>
          </div>

          <form onSubmit={handleUpload} className="upload-form">
            <div className="file-input-container">
              <input
                type="file"
                id="prescription"
                accept="image/*"
                onChange={handleFileChange}
                required
                disabled={isUploading}
                className="file-input"
              />
              <label htmlFor="prescription" className="file-label">
                <Upload size={20} />
                <span>Choose File</span>
              </label>
              <span className="file-name">{fileName}</span>
            </div>

            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className={`upload-button ${isUploading || !selectedFile ? 'disabled' : ''}`}
            >
              {isUploading ? (
                <>
                  <div className="loading-spinner"></div>
                  <span>Processing...</span>
                </>
              ) : (
                'Upload Prescription'
              )}
            </button>
          </form>

          {output && (
            <div className="results-section">
              <div className="results-header">
                <h2>Extracted Medicine Details</h2>
                {Array.isArray(output) && (
                  <span className="results-count">{output.length} items</span>
                )}
              </div>
              <div className="medicines-list grid">
                {Array.isArray(output) ? (
                  output.map((med, index) => (
                    <div key={index} className="medicine-card">
                      <div className="medicine-card__header">
                        <div className="medicine-title">{med.name || 'Unknown Medicine'}</div>
                        <button type="button" className="icon-button" onClick={() => handleCopy(med, index)} aria-label="Copy medicine details">
                          {copiedIndex === index ? <CheckCircle2 size={18} /> : <Clipboard size={18} />}
                        </button>
                      </div>
                      <div className="medicine-badges">
                        {med.dosage && (
                          <span className="badge badge--dosage">{med.dosage}</span>
                        )}
                        <span className="badge badge--timing">{med.timing || 'Timing not specified'}</span>
                        <span className="badge badge--frequency">{med.frequency || 'Frequency not specified'}</span>
                      </div>
                      {med.instructions && (
                        <div className="medicine-instructions">
                          <span className="instructions-label">Instructions</span>
                          <p className="instructions-text">{med.instructions}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="error-message">{output}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OCRModule;
