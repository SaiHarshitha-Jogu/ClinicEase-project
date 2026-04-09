from ultralytics import YOLO
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from waitress import serve
from PIL import Image, ImageDraw, ImageFont
import os
import logging
from datetime import datetime
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, storage
import json

# Firebase initialization
firebase_json = os.environ.get("FIREBASE_KEY")
cred_dict = json.loads(firebase_json)

cred = credentials.Certificate(cred_dict)
firebase_admin.initialize_app(cred, {
    "storageBucket": "clinic-ease-firebase.firebasestorage.app"
})

bucket = storage.bucket()

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.absolute()

app = Flask(__name__)

# ✅ FIXED CORS
CORS(app, supports_credentials=True)

# Load model
model = YOLO("best.pt")

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'xrays')
RESULT_FOLDER = os.path.join(BASE_DIR, 'uploads', 'annotated_xrays')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

@app.route("/")
def root():
    return "Dental X-ray Analysis API is running!"

# ---------------- ANALYSIS ----------------
def analyze_xray(filepath):
    orig_img = Image.open(filepath).convert("RGB")
    orig_w, orig_h = orig_img.size

    # Optional improvement
    results = model.predict(orig_img, imgsz=640)
    result = results[0]

    findings = []
    draw = ImageDraw.Draw(orig_img)
    font = ImageFont.load_default()

    for box in result.boxes:
        x1, y1, x2, y2 = [round(x) for x in box.xyxy[0].tolist()]

        class_id = box.cls[0].item()
        conf = round(box.conf[0].item(), 2)
        conf_percent = f"{conf * 100:.2f}%"
        label = result.names[class_id]

        findings.append({
            "label": label,
            "confidence": conf_percent,
            "coordinates": [x1, y1, x2, y2]
        })

        draw.rectangle([x1, y1, x2, y2], outline="green", width=3)
        draw.text((x1, y1 - 10), f"{label} ({conf_percent})", fill="green", font=font)

    return orig_img, findings

# ---------------- API ----------------
@app.route('/analyze-xray', methods=['POST', 'OPTIONS'])
def analyze_xray_route():

    # ✅ FIXED OPTIONS
    if request.method == 'OPTIONS':
        response = jsonify({"message": "ok"})
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "POST,OPTIONS"
        return response, 200

    if 'image_file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['image_file']
    filename = f"xray_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    file.save(filepath)

    # Upload original
    with open(filepath, "rb") as f:
        blob_xray = bucket.blob(f"xrays/{filename}")
        blob_xray.upload_from_file(f, content_type=file.content_type)
        blob_xray.make_public()

    # Process
    output_image, findings = analyze_xray(filepath)

    # Save annotated
    output_filename = f"annotated_{filename}"
    output_path = os.path.join(RESULT_FOLDER, output_filename)

    output_image.save(output_path)

    with open(output_path, "rb") as f:
        blob_annotated = bucket.blob(f"annotated_xrays/{output_filename}")
        blob_annotated.upload_from_file(f, content_type='image/jpeg')
        blob_annotated.make_public()

    image_url = blob_annotated.public_url

    return jsonify({
        "annotatedImageUrl": image_url,
        "findings": findings
    })

# ---------------- CORS HEADERS ----------------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

# ---------------- START SERVER ----------------
if __name__ == "__main__":
    logger.info("Server starting...")
    port = int(os.environ.get("PORT", 10000))
    serve(app, host="0.0.0.0", port=port)
