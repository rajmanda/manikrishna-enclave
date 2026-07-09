import asyncio
import logging
import os
import shutil
import tarfile
import tempfile
from datetime import datetime, timezone
from typing import Any

from bson import json_util
from app import db as database
from google.cloud import storage as gcs

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backup_db")

async def backup_mongodb_to_gcs(db: Any, bucket_name: str) -> str:
    """Backs up all MongoDB collections to a GCS bucket as a zipped tarball."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_filename = f"mongodb_backup_{timestamp}.tar.gz"
    
    # Get all collection names
    collections = await db.list_collection_names()
    logger.info(f"Starting database backup. Found {len(collections)} collections to backup.")

    # Create a temporary directory to save BSON dumps
    with tempfile.TemporaryDirectory() as temp_dir:
        backup_dir = os.path.join(temp_dir, "db_backup")
        os.makedirs(backup_dir, exist_ok=True)
        
        for coll_name in collections:
            logger.info(f"Dumping collection: '{coll_name}'")
            coll_file = os.path.join(backup_dir, f"{coll_name}.json")
            
            cursor = db[coll_name].find()
            docs = await cursor.to_list(length=100000)
            
            with open(coll_file, "w", encoding="utf-8") as f:
                # Write each document as Extended JSON on its own line
                for doc in docs:
                    f.write(json_util.dumps(doc) + "\n")
            
            logger.info(f"  Dumped {len(docs)} documents from '{coll_name}'")
        
        # Compress the temporary backup directory to a tarball
        local_tar_path = os.path.join(temp_dir, backup_filename)
        logger.info(f"Creating compressed tarball at {local_tar_path}")
        with tarfile.open(local_tar_path, "w:gz") as tar:
            tar.add(backup_dir, arcname="db_backup")
            
        # Upload to Google Cloud Storage
        logger.info(f"Uploading backup archive to GCS bucket: '{bucket_name}'")
        client = gcs.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(backup_filename)
        blob.upload_from_filename(local_tar_path)
        
        logger.info(f"Database backup uploaded successfully: '{backup_filename}'")
        return backup_filename


async def main() -> None:
    bucket_name = os.environ.get("GCS_BACKUP_BUCKET")
    if not bucket_name:
        logger.error("GCS_BACKUP_BUCKET environment variable is not set. Aborting.")
        return
        
    db = database.connect()
    try:
        await backup_mongodb_to_gcs(db, bucket_name)
    except Exception as e:
        logger.exception(f"Unhandled error in database backup job: {e}")
        # Re-raise so Cloud Run Job registers the execution as a failure
        raise e
    finally:
        database.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
