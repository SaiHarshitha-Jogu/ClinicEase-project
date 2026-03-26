import React, { useState } from "react";

function OCRModule() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // ✅ Image Compression (ADDED)
  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = 0.5;

          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          }, "image/jpeg", 0.6);
        };
      };
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);

    try {
      // ✅ Wake up backend
      await fetch("https://clinic-ease-backend.onrender.com/");

      // ✅ Compress image
      const compressedFile = await compressImage(file);

      const formData = new FormData();
      formData.append("file", compressedFile);

      // ✅ API Call (UPDATED URL)
      const res = await fetch(
        "https://clinic-ease-backend.onrender.com/upload-prescription",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      console.log("Extracted medicine data:", data);
      setResult(data);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed!");
    }

    setLoading(false);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload Prescription</h2>

      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={loading}
      />

      {loading && <p>Processing... please wait ⏳</p>}

      {result && (
        <div>
          <h3>Extracted Data:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default OCRModule;
