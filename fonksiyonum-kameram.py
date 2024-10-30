import azure.functions as func
from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
from datetime import datetime, timedelta
import requests
import json
import logging
import time

# Set up basic configuration for logging
logging.basicConfig(level=logging.INFO)

# API and Azure Storage Configuration
AZURE_CONTAINER_NAME = "containerelectron"
DOCKER_ENDPOINT = " " 
STORAGE_CONNECTION_STRING = " "

def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        while True:
            blob_service_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
            container_client = blob_service_client.get_container_client(AZURE_CONTAINER_NAME)
            blobs = container_client.list_blobs()

            # Sort blobs by their last modified date
            sorted_blobs = sorted(blobs, key=lambda b: b.last_modified, reverse=True)

            results = []
            if sorted_blobs:
                recent_blob = sorted_blobs[0]
                logging.info(f"Processing most recent blob: {recent_blob.name}")

                blob_url = get_blob_url_with_sas(blob_service_client.account_name, AZURE_CONTAINER_NAME, recent_blob.name)
                result = process_image(blob_url, recent_blob.name)
                results.append(result)
            else:
                results.append({"status": "No blobs found in container."})

            # Print the results to logging
            logging.info(f"Results: {json.dumps(results)}")

            # Sleep for a short period before checking again
            time.sleep(1)  # Adjust the sleep duration as needed

    except Exception as e:
        logging.error(f"An unexpected error occurred: {str(e)}")
        return func.HttpResponse(
            "Internal server error: " + str(e),
            status_code=500
        )

    return func.HttpResponse(
        body=json.dumps(results),
        status_code=200,
        headers={"Content-Type": "application/json"}
    )

def get_blob_url_with_sas(account_name, container_name, blob_name):
    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=container_name,
        blob_name=blob_name,
        account_key=' ',
        permission=BlobSasPermissions(read=True, list=True),
        expiry=datetime.utcnow() + timedelta(hours=1)
    )
    return f"https://{account_name}.blob.core.windows.net/{container_name}/{blob_name}?{sas_token}"

def process_image(blob_url, image_name):
    logging.info(f"Sending blob URL to Docker for processing: {blob_url}")
    headers = {'Content-Type': 'application/json'}
    payload = json.dumps({'blob_url': blob_url})
    response = requests.post(DOCKER_ENDPOINT, headers=headers, data=payload)
    
    if response.status_code == 200:
        logging.info(f"Blob successfully processed by Docker at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} for image {image_name}")
        # Assume response.text contains URL to the processed image
        return {
            "image_name": image_name,
            "status": "Processed successfully",
            "processed_image_url": response.text  # This should be the URL to the processed image
        }
    else:
        logging.error(f"Error during processing for image {image_name}: {response.text}")
        return {
            "image_name": image_name,
            "status": "Failed to process",
            "error_detail": response.text
        }
