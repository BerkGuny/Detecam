import cv2
from azure.storage.blob import BlobServiceClient
import os
import datetime

connect_str = ' '
container_name = "containerelectron"

blob_service_client = BlobServiceClient.from_connection_string(connect_str)
container_client = blob_service_client.get_container_client(container_name)

def upload_frames_to_blob(frames, camera_id):
    for index, frame in enumerate(frames):
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        blob_name = f"{camera_id}_{timestamp}_{index}.jpg"
        _, encoded_image = cv2.imencode('.jpg', frame)
        blob_client = container_client.get_blob_client(blob_name)
        blob_client.upload_blob(encoded_image.tobytes(), overwrite=True)

def capture_and_upload(camera_id, batch_size=10):
    cap = cv2.VideoCapture(0)  # Varsayılan kamera
    frames = []
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
            if len(frames) >= batch_size:
                upload_frames_to_blob(frames, camera_id)
                frames = []  # Reset the frame list after uploading
    finally:
        if frames:  # Make sure to upload any remaining frames
            upload_frames_to_blob(frames, camera_id)
        cap.release()

if __name__ == "__main__":
    camera_id = "a_camera_id"
    capture_and_upload(camera_id, batch_size=10)  # You can adjust batch_size based on your needs
