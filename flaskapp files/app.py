from flask import Flask, request, jsonify
import subprocess
import os
import cv2
import requests
from datetime import datetime
from azure.storage.blob import BlobServiceClient, BlobClient

app = Flask(__name__)

@app.route('/process_blob', methods=['POST'])
def process_blob():
    blob_url = request.json['blob_url']
    image_path = download_blob(blob_url)
    if image_path:
        result, processed_image_path, processed_image_name = run_inference(image_path)
        processed_image_url = upload_to_blob(processed_image_path, processed_image_name)  # Upload the processed image
        os.remove(image_path)  # Delete the original image
        os.remove(processed_image_path)  # Delete the processed image
        return jsonify({'result': result, 'processedImageUrl': processed_image_url})
    return jsonify({'error': 'Failed to download or process image'}), 500

def download_blob(blob_url):
    local_dir = '/app/temporaryimages'
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, 'downloaded_image.jpg')
    subprocess.run(['wget', blob_url, '-O', local_path], check=True)
    return local_path if os.path.exists(local_path) else None

def run_inference(image_path):
    # Load the image for sending to the Roboflow API
    img = cv2.imread(image_path)
    _, img_encoded = cv2.imencode('.jpg', img)
    files = {'file': ('image.jpg', img_encoded.tobytes(), 'image/jpeg')}

    # Prepare headers and API Key
    headers = {
        'Authorization': 'Bearer QHtqjXPOLXWBrVOWdJMS'
    }

    # Roboflow model endpoint for 'cam-person-avpuh/1'
    url = ' '
    # Send post request to Roboflow
    response = requests.post(url, headers=headers, files=files)
    predictions = response.json()['predictions']

    # Build new image name with detected classes and their positions
    detected_classes = []
    for obj in predictions:
        if obj['class'] in ['human', 'face']:
            x = int(obj['x'] - obj['width'] / 2)
            y = int(obj['y'] - obj['height'] / 2)
            x2 = int(x + obj['width'])
            y2 = int(y + obj['height'])
            cv2.rectangle(img, (x, y), (x2, y2), (0, 255, 0), 2)  # Green rectangle
            detected_classes.append(f"{obj['class']}_{x}_{y}_{x2}_{y2}")

    # Save the processed image with the new name
    new_image_name = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_processed"
    if detected_classes:
        new_image_name += "_" + "_".join(detected_classes)
    new_image_name += ".jpg"
    processed_image_path = os.path.join('/app/temporaryimages', new_image_name)
    cv2.imwrite(processed_image_path, img)

    return "Detection complete", processed_image_path, new_image_name

def upload_to_blob(image_path, new_filename):
    connection_string = ' '
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    blob_client = blob_service_client.get_blob_client(container='processedelectron', blob=new_filename)
    with open(image_path, 'rb') as data:
        blob_client.upload_blob(data, overwrite=True)
    return blob_client.url

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
