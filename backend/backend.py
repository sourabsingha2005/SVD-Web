"""FastAPI service for image compression and SVT reconstruction."""

import base64
from io import BytesIO

import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError

from svd_compression import compress_svd, encode_factorization, paper_sparsify
from metrics import image_metrics
from reconstruction import complete_with_svt


app = FastAPI(
    title="Low-Rank Image Lab API",
    description="Grayscale truncated-SVD compression and SVT image completion.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def png_base64(array: np.ndarray) -> str:
    output = BytesIO()
    Image.fromarray(np.clip(array, 0, 255).astype(np.uint8)).save(output, format="PNG")
    return base64.b64encode(output.getvalue()).decode("ascii")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "low-rank-image-lab"}


@app.post("/api/process")
def process_image(
    file: UploadFile = File(...),
    rank: int = Form(32, ge=1, le=500),
    modulo_step: float = Form(16.0, gt=0.0, le=255.0),
    observed_fraction: float = Form(0.5, gt=0.0, le=1.0),
    tau: float = Form(40.0, ge=0.0),
    delta: float = Form(1.2, gt=0.0, le=2.0),
    initial_scale: float = Form(1.0, gt=0.0, le=100.0),
    tolerance: float = Form(0.01, gt=0.0, le=1.0),
    iterations: int = Form(30, ge=1, le=200),
    seed: int = Form(7, ge=0, le=999999),
):
    """Process one uploaded image. Images return as base64-encoded PNGs."""
    payload = file.file.read(MAX_UPLOAD_BYTES + 1)
    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image uploads are limited to 20 MiB.")
    try:
        image = Image.open(BytesIO(payload)).convert("L")
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="Upload a valid PNG, JPEG, BMP, or TIFF image.") from None

    original = np.asarray(image, dtype=np.float64)
    if min(original.shape) < 1 or max(original.shape) > 4096:
        raise HTTPException(status_code=413, detail="Image dimensions must be at most 4096 × 4096.")
    requested_rank = min(rank, min(original.shape))
    rank = requested_rank
    sparse_image = paper_sparsify(original, modulo_step)
    compressed, factors, all_singular_values, quality_curve = compress_svd(
    sparse_image, rank, reference_image=original
    )
    factor_payload = encode_factorization(factors)
    while len(factor_payload) >= len(payload) and rank > 1:
        rank -= 1
        factors = (factors[0][:, :rank], factors[1][:rank], factors[2][:rank, :])
        compressed = (factors[0] * factors[1]) @ factors[2]
        factor_payload = encode_factorization(factors)
    reconstructed, mask, history = complete_with_svt(
        compressed, observed_fraction, tau, delta, iterations, seed, tolerance, initial_scale
    )
    compressed_metrics = image_metrics(original, compressed)
    reconstructed_metrics = image_metrics(original, reconstructed)
    paper_compression_ratio = original.size / (rank * (original.shape[0] + original.shape[1] + 1))
    # Calculate compression ratio at each sampled rank
    compression_curve = [
        {
            "rank": point["rank"],
            "compression_ratio": original.size / (
                point["rank"] * (original.shape[0] + original.shape[1] + 1)
            )
        }
        for point in quality_curve
    ]
    return {
        "width": image.width,
        "height": image.height,
        "rank": rank,
        "quality_curve": quality_curve,
        "compression_curve": compression_curve,
        "requested_rank": requested_rank,
        "singular_values": all_singular_values.tolist(),
        "original_png": png_base64(original),
        "compressed_png": png_base64(compressed),
        "reconstructed_png": png_base64(reconstructed),
        "factors_npz": base64.b64encode(factor_payload).decode("ascii"),
        "metrics": {
            "compression_ratio": f"{paper_compression_ratio:.2f}×",
            "space_saved_percent": f"{100 * (1 - 1 / paper_compression_ratio):.1f}%",
            "factor_storage_ratio": f"{len(payload) / max(1, len(factor_payload)):.2f}×",
            "factor_space_saved_percent": f"{100 * (1 - len(factor_payload) / len(payload)):.1f}%",
            "paper_compression_ratio": f"{paper_compression_ratio:.2f}×",
            "paper_space_saved_percent": f"{100 * (1 - 1 / paper_compression_ratio):.1f}%",
            "paper_sparsity_percent": float(np.mean(sparse_image == 0) * 100),
            "svd": compressed_metrics,
            "svt": reconstructed_metrics,
            "observed_fraction": float(mask.mean()),
            "final_observed_error": history[-1],
        },
    }
