import os
import tarfile
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from app.cron.backup_db import backup_mongodb_to_gcs

@pytest.mark.anyio
@patch("app.cron.backup_db.gcs")
async def test_backup_mongodb_to_gcs_success(mock_gcs, db):
    # 1. Populate test collection with some documents
    test_coll = "test_cleanup_backup"
    await db[test_coll].delete_many({})
    await db[test_coll].insert_many([
        {"id": "doc-1", "name": "Item 1", "amount": 100},
        {"id": "doc-2", "name": "Item 2", "amount": 200},
    ])
    
    # 2. Mock GCS client and bucket
    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_blob = MagicMock()
    
    mock_gcs.Client.return_value = mock_client
    mock_client.bucket.return_value = mock_bucket
    mock_bucket.blob.return_value = mock_blob
    
    # Track GCS upload
    uploaded = False
    
    def mock_upload(filename):
        nonlocal uploaded
        uploaded = True
        assert os.path.exists(filename)
        
        # Verify contents while the temp directory is still alive!
        with tempfile.TemporaryDirectory() as extract_dir:
            with tarfile.open(filename, "r:gz") as tar:
                tar.extractall(path=extract_dir)
                
            dumped_file = os.path.join(extract_dir, "db_backup", f"{test_coll}.json")
            assert os.path.exists(dumped_file)
            
            with open(dumped_file, "r", encoding="utf-8") as f:
                lines = f.read().splitlines()
                
            assert len(lines) == 2
            assert '"id": "doc-1"' in lines[0]
            assert '"id": "doc-2"' in lines[1]
        
    mock_blob.upload_from_filename.side_effect = mock_upload
    
    # 3. Execute backup
    bucket_name = "test-backup-bucket"
    backup_file = await backup_mongodb_to_gcs(db, bucket_name)
    
    # 4. Verify GCS interactions
    mock_client.bucket.assert_called_once_with(bucket_name)
    mock_bucket.blob.assert_called_once_with(backup_file)
    mock_blob.upload_from_filename.assert_called_once()
    assert uploaded is True
        
    # Clean up test collection
    await db[test_coll].delete_many({})
