"""Low-rank SVD image representation."""
from io import BytesIO

import numpy as np
from scipy.linalg import svd

from metrics import image_metrics


def paper_sparsify(image: np.ndarray, modulo_step: float):
    """Interpret Eq. (3) as x - (x mod q), with configurable missing q.

    The paper prints Mod(x) without a divisor. For nonnegative grayscale
    pixels and q > 0 this floors values to multiples of q; it is not the
    usual magnitude soft-thresholding operator.
    """
    if modulo_step <= 0:
        raise ValueError("The modulo step must be positive.")
    matrix = np.asarray(image, dtype=np.float64)
    remainder = np.mod(matrix, modulo_step)
    return np.where(matrix > remainder, matrix - remainder, 0.0)


def compress_svd(image: np.ndarray, rank: int, reference_image=None):
    """Return a rank-r reconstruction, factors, singular values and quality curve."""

    u, singular_values, vt = svd(
        np.asarray(image, dtype=np.float64),
        full_matrices=False,
        check_finite=False
    )

    rank = max(1, min(int(rank), len(singular_values)))

    factors = (
        u[:, :rank].astype(np.float32),
        singular_values[:rank].astype(np.float32),
        vt[:rank, :].astype(np.float32)
    )

    reconstructed = (factors[0] * factors[1]) @ factors[2]

    # Calculate quality at multiple ranks using the same SVD decomposition
    quality_reference = image if reference_image is None else reference_image

    quality_curve = calculate_rank_quality(
        quality_reference, u, singular_values, vt
    )

    return (
        reconstructed,
        factors,
        singular_values.astype(np.float32),
        quality_curve
    )


def encode_factorization(factors) -> bytes:
    buffer = BytesIO()
    # Half precision keeps the stored representation compact while preserving
    # float32 singular values, whose magnitudes may exceed float16's range.
    np.savez_compressed(
        buffer,
        U=np.asarray(factors[0], dtype=np.float16),
        singular_values=np.asarray(factors[1], dtype=np.float32),
        Vt=np.asarray(factors[2], dtype=np.float16),
    )
    return buffer.getvalue()
def calculate_rank_quality(image, u, singular_values, vt):
    """Calculate PSNR at selected ranks using an existing SVD decomposition."""

    max_rank = len(singular_values)

    # Select up to 10 ranks across the available range
    ranks = sorted(set(
        np.linspace(1, max_rank, min(10, max_rank), dtype=int).tolist()
    ))

    results = []

    for k in ranks:
        reconstructed = (u[:, :k] * singular_values[:k]) @ vt[:k, :]

        quality = image_metrics(image, reconstructed)

        results.append({
            "rank": int(k),
            "psnr": quality["psnr"]
        })

    return results
