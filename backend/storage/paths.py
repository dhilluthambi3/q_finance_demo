# backend/storage/paths.py
from typing import Tuple, Optional
from io import BytesIO
import numpy as np
import gridfs
from bson import ObjectId
from models.db import db  

_fs = gridfs.GridFS(db)  # uses 'fs.files'/'fs.chunks'


def save_paths_npz(job_id: str, time_grid: np.ndarray, paths: np.ndarray) -> str:
    """
    Stores a compressed NPZ with arrays:
      - t: shape (steps,)
      - X: shape (paths, steps) float32
    Returns GridFS id as str.
    """
    bio = BytesIO()
    np.savez_compressed(bio, t=time_grid.astype(np.float32), X=paths.astype(np.float32))
    bio.seek(0)
    _id = _fs.put(
        bio.read(),
        filename=f"mc_paths_{job_id}.npz",
        content_type="application/octet-stream",
        job_id=job_id,
        kind="mc_paths",
        n_paths=int(paths.shape[0]),
        steps=int(paths.shape[1]),
    )
    return str(_id)


def load_paths_subset(
    file_id: str, limit: int = 100, stride: int = 1
) -> Tuple[np.ndarray, np.ndarray, int, int]:
    """
    Loads the NPZ from GridFS and returns a subset:
      t: (steps_subset,)
      X: (min(limit, n_paths), steps_subset)
    Also returns (n_paths_total, steps_total).
    """
    gridout = _fs.get(ObjectId(file_id))
    raw = gridout.read()
    with np.load(BytesIO(raw)) as npz:
        t = npz["t"]
        X = npz["X"]
    n_paths, steps = X.shape
    limit = max(1, min(limit, n_paths))
    stride = max(1, int(stride))
    t_sub = t[::stride]
    X_sub = X[:limit, ::stride]
    return t_sub, X_sub, n_paths, steps
