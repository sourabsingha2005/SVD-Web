"""Singular-value-thresholding matrix completion."""
import numpy as np
from scipy.linalg import svd


def complete_with_svt(image: np.ndarray, observed_fraction: float, tau: float, delta: float,
                      iterations: int, seed: int = 7, tolerance: float = 0.01,
                      initial_scale: float = 1.0):
    """Recover a low-rank matrix from samples using paper Algorithm 1.

    This uses a full SVD at each iteration rather than Algorithm 1's
    incremental partial-SVD search for the thresholded rank. Singular
    triplets are retained only when sigma > tau. Step size is held constant;
    the paper allows a sequence of step sizes but does not prescribe one.
    """
    matrix = np.asarray(image, dtype=np.float64)
    rng = np.random.default_rng(seed)
    mask = rng.random(matrix.shape) < float(observed_fraction)
    if not mask.any():
        mask.flat[0] = True
    observed_matrix = np.where(mask, matrix, 0.0)
    y = float(initial_scale) * float(delta) * observed_matrix
    estimate = np.zeros_like(matrix)
    threshold = max(0.0, float(tau))
    errors = []
    for _ in range(int(iterations)):
        u, s, vt = svd(y, full_matrices=False, check_finite=False)
        keep = s > threshold
        shrunk = s[keep] - threshold
        estimate = (u[:, keep] * shrunk) @ vt[keep, :] if keep.any() else np.zeros_like(matrix)
        residual = np.where(mask, estimate - matrix, 0.0)
        relative_error = float(np.linalg.norm(residual) / max(np.linalg.norm(observed_matrix), 1e-12))
        errors.append(relative_error)
        if relative_error <= float(tolerance):
            break
        y += float(delta) * np.where(mask, matrix - estimate, 0.0)
    return estimate, mask, errors
