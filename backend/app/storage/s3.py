"""S3-compatible object storage client (MinIO in dev, Scaleway/OVH in prod)."""

from __future__ import annotations

import functools

import boto3
from botocore.client import BaseClient
from botocore.config import Config

from app.config import get_settings


@functools.lru_cache
def get_s3_client() -> BaseClient:
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def put_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Upload raw bytes and return the object key."""
    settings = get_settings()
    get_s3_client().put_object(
        Bucket=settings.s3_bucket_dce,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return key


def get_bytes(key: str) -> bytes:
    settings = get_settings()
    resp = get_s3_client().get_object(Bucket=settings.s3_bucket_dce, Key=key)
    return resp["Body"].read()
