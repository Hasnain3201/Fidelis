"""In-memory US ZIP code centroid index for radius search.

Data is loaded from apps/api/data/zip_centroids.csv on first call and cached
for the lifetime of the process. Source: GeoNames postal codes (CC BY 4.0).
"""
from __future__ import annotations

import csv
import math
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "zip_centroids.csv"


@lru_cache(maxsize=1)
def load_centroids() -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    with DATA_PATH.open() as fh:
        reader = csv.reader(fh)
        next(reader, None)  # header
        for row in reader:
            if len(row) < 3:
                continue
            try:
                out[row[0]] = (float(row[1]), float(row[2]))
            except ValueError:
                continue
    return out


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.7613
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def find_nearby_zips(zip_code: str, radius_miles: float) -> list[str]:
    """Return all 5-digit US ZIPs whose centroid is within ``radius_miles`` of
    the centroid of ``zip_code``. Falls back to ``[zip_code]`` if the input ZIP
    is unknown."""
    centroids = load_centroids()
    origin = centroids.get(zip_code)
    if origin is None:
        return [zip_code]

    lat, lng = origin
    lat_delta = radius_miles / 69.0
    cos_lat = max(0.01, math.cos(math.radians(lat)))
    lng_delta = radius_miles / (69.0 * cos_lat)

    nearby: list[str] = []
    for zc, (zlat, zlng) in centroids.items():
        if abs(zlat - lat) > lat_delta or abs(zlng - lng) > lng_delta:
            continue
        if _haversine_miles(lat, lng, zlat, zlng) <= radius_miles:
            nearby.append(zc)

    if zip_code not in nearby:
        nearby.append(zip_code)
    return nearby
