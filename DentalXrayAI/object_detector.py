from ultralytics import YOLO
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from waitress import serve
from PIL import Image, ImageDraw, ImageFont
import os
import logging
from datetime import datetime
from pathlib import Path

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Get the absolute path of the project's root directory (ClinicEaseUnified)
BASE_DIR = Path(__file__).parent.parent.absolute()

app = Flask(__name__)

# Enable CORS for all routes and all origins
CORS(app, resources={
    r"/*": {
        "origins": "*",  # Allow all origins for development
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

model = YOLO("best.pt")

# Define upload and result folders
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads', 'xrays')
RESULT_FOLDER = os.path.join(BASE_DIR, 'uploads', 'annotated_xrays')

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULT_FOLDER, exist_ok=True)

logger.info(f"Upload folder: {UPLOAD_FOLDER}")
logger.info(f"Result folder: {RESULT_FOLDER}")

@app.route("/")
def root():
    return "Dental X-ray Analysis API is running!"

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

def analyze_xray(filepath):
    results = model.predict(filepath)
    result = results[0]
    findings = []
    img = Image.open(filepath).convert("RGB")
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

@app.route('/analyze-xray', methods=['POST', 'OPTIONS'])
def analyze_xray_route():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        return response

    if 'image_file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['image_file']
    filename = f"xray_{datetime.now().strftime('%Y%m%d%H%M%S')}.jpg"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    logger.info(f"Saved uploaded file to: {filepath}")

    output_image, findings = analyze_xray(filepath)
    output_filename = f"annotated_{filename}"
    output_path = os.path.join(RESULT_FOLDER, output_filename)
    output_image.save(output_path)
    logger.info(f"Saved annotated image to: {output_path}")

    # Return full URL for the image
    base_url = os.environ.get('BASE_URL', 'http://localhost:8080')
    image_url = f"{base_url}/uploads/annotated_xrays/{output_filename}"
    logger.info(f"Image will be available at: {image_url}")
    
    response = jsonify({
        "annotatedImageUrl": image_url,    
        "findings": findings
    })
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/uploads/annotated_xrays/<filename>')
def serve_annotated_file(filename):
    logger.info(f"Serving annotated file: {filename} from {RESULT_FOLDER}")
    response = send_from_directory(RESULT_FOLDER, filename)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

@app.route('/uploads/xrays/<filename>')
def serve_original_file(filename):
    logger.info(f"Serving original file: {filename} from {UPLOAD_FOLDER}")
    response = send_from_directory(UPLOAD_FOLDER, filename)
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

if __name__ == "__main__":
    logger.info("Server starting...")
    logger.info(f"Upload directory: {UPLOAD_FOLDER}")
    logger.info(f"Result directory: {RESULT_FOLDER}")
    port = int(os.environ.get('PORT', 8080))
    serve(app, host='0.0.0.0', port=port, threads=4)