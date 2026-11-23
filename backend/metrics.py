"""Image quality measures with explicit zero-error handling."""
import numpy as np
from skimage.metrics import peak_signal_noise_ratio, structural_similarity


def image_metrics(reference: np.ndarray, estimate: np.ndarray):
    ref = np.asarray(reference, dtype=np.float64)
    pred = np.asarray(estimate, dtype=np.float64)
    error = ref - pred
    signal_power = float(np.mean(ref ** 2))
    noise_power = float(np.mean(error ** 2))
    snr = float("inf") if noise_power == 0 else 10 * np.log10(signal_power / noise_power) if signal_power else float("-inf")
    psnr = peak_signal_noise_ratio(ref, pred, data_range=255)
    ssim = structural_similarity(ref, pred, data_range=255) if min(ref.shape) >= 7 else float("nan")
    return {"snr": "∞" if np.isinf(snr) else f"{snr:.2f}", "psnr": "∞" if np.isinf(psnr) else f"{psnr:.2f} dB", "ssim": f"{ssim:.4f}" if np.isfinite(ssim) else "N/A (image < 7 px)"}
