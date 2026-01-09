import React, { useState, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faUpload } from '@fortawesome/free-solid-svg-icons';
import './PatientPhotoUpload.css';

const PatientPhotoUpload = ({ onPhotoCapture, existingPhoto, darkMode }) => {
  const [photo, setPhoto] = useState(existingPhoto || null);
  const fileInputRef = useRef(null);

  // Handle existingPhoto that might be a File object or data URL
  const [displayPhoto, setDisplayPhoto] = useState(() => {
    if (existingPhoto) {
      // If existingPhoto is a File object, convert to data URL for display
      if (existingPhoto instanceof File) {
        return URL.createObjectURL(existingPhoto);
      }
      // If it's already a data URL or string, use as-is
      return existingPhoto;
    }
    return null;
  });

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      try {
        // Check file size (limit to 5MB before processing)
        if (file.size > 5 * 1024 * 1024) {
          alert('Image file is too large. Please select an image smaller than 5MB.');
          return;
        }

        // Create a canvas to resize the image
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
          // Calculate new dimensions (max 800x600)
          let { width, height } = img;
          const maxWidth = 800;
          const maxHeight = 600;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw and compress the image
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to compressed data URL (quality 0.7)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          // Check if the compressed image is still too large
          const compressedSize = Math.round(compressedDataUrl.length * 0.75 / 1024); // Approximate size in KB
          if (compressedSize > 900) { // Leave some margin under 1MB
            alert('Image is still too large after compression. Please try a smaller image.');
            return;
          }

          setDisplayPhoto(compressedDataUrl);
          setPhoto(compressedDataUrl);
          onPhotoCapture(compressedDataUrl);
        };

        img.onerror = () => {
          alert('Failed to load the image. Please try another file.');
        };

        // Load the image
        img.src = URL.createObjectURL(file);

      } catch (error) {
        console.error('Error processing file:', error);
        alert('Failed to process the image file. Please try another file.');
      }
    } else if (file) {
      alert('Please select a valid image file (JPEG, PNG, etc.)');
    }
  };

  const removePhoto = () => {
    setPhoto(null);
    setDisplayPhoto(null);
    onPhotoCapture(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`patient-photo-upload ${darkMode ? 'dark' : ''}`}>
      <h3>Patient Photograph</h3>
      <p className="photo-subtitle">Optional: Add a photo for better identification</p>
      
      {displayPhoto ? (
        <div className="photo-preview">
          <img src={displayPhoto} alt="Patient" className="patient-photo" />
          <button 
            type="button" 
            className="remove-photo-btn"
            onClick={removePhoto}
            title="Remove photo"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      ) : (
        <div className="photo-options">
          <button 
            type="button" 
            className="photo-option-btn upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <FontAwesomeIcon icon={faUpload} />
            <span>Upload Photo</span>
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  );
};

export default PatientPhotoUpload;
