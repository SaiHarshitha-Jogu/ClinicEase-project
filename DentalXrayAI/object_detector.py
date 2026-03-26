from ultralytics import YOLO
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from waitress import serve
from PIL import Image, ImageDraw, ImageFont
import os
import logging
from datetime import datetime
from pathlib import Path

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base directory
BASE_DIR = Path(__file__).parent.absolute()

app = Flask(__name__)

# ✅ FIXED CORS (allow your frontend)
CORS(app, resources={r"/*": {"origins": "https://clinic-ease-project-f8v9.vercel.app"}})

# Load model
model = YOLO("best.pt")

# Folders
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'xrays')
RESULT_FOLDER = os.path.join(BASE_DIR, 'uploads', 'annotated_xrays')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

logger.info(f"Upload folder: {UPLOAD_FOLDER}")
logger.info(f"Result folder: {RESULT_FOLDER}")

@app.route("/")
def root():
    return "Dental X-ray Analysis API is running!"

# ---------------- DETECTION ----------------
@app.route("/detect", methods=["POST"])
def detect():
    buf = request.files["image_file"]
    boxes = detect_objects_on_image(buf.stream)
    return jsonify(boxes)

def detect_objects_on_image(buf):
    results = model.predict(Image.open(buf))
    result = results[0]
    output = []
    for box in result.boxes:
        x1, y1, x2, y2 = [round(x) for x in box.xyxy[0].tolist()]
        class_id = box.cls[0].item()
        prob = round(box.conf[0].item(), 2)
        prob_percentage = f"{prob * 100:.2f}%"
        output.append([x1, y1, x2, y2, result.names[class_id], prob_percentage])
    return output

# ---------------- ANALYSIS ----------------
def analyze_xray(filepath):
    img = Image.open(filepath).convert("RGB").resize((640, 640))

    results = model.predict(img)
    result = results[0]

    findings = []
    draw = ImageDraw.Draw(img)
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

    return img, findings

# ---------------- API ----------------
@app.route('/analyze-xray', methods=['POST', 'OPTIONS'])
def analyze_xray_route():

    # ✅ FIXED OPTIONS
    if request.method == 'OPTIONS':
        return '', 204

    if 'image_file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['image_file']

    filename = f"xray_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    logger.info(f"Saved uploaded file: {filepath}")

    output_image, findings = analyze_xray(filepath)

    output_filename = f"annotated_{filename}"
    output_path = os.path.join(RESULT_FOLDER, output_filename)
    output_image.save(output_path)
    logger.info(f"Saved annotated image: {output_path}")

    # ✅ FIXED HTTPS URL
    image_url = request.host_url.replace("http://", "https://") + "uploads/annotated_xrays/" + output_filename

    return jsonify({
        "annotatedImageUrl": image_url,
        "findings": findings
    })

# ---------------- SERVE FILES ----------------
@app.route('/uploads/annotated_xrays/<filename>')
def serve_annotated_file(filename):
    return send_from_directory(RESULT_FOLDER, filename)

@app.route('/uploads/xrays/<filename>')
def serve_original_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

# ---------------- START SERVER ----------------
if __name__ == "__main__":
    logger.info("Server starting...")
    port = int(os.environ.get('PORT', 10000))
    serve(app, host='0.0.0.0', port=port, threads=4)
