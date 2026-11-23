"""Streamlit frontend for the FastAPI image-processing backend."""
import base64
import os

import requests
import streamlit as st
from PIL import Image


API_URL = os.environ.get("IMAGE_LAB_API_URL", "http://127.0.0.1:8000")
st.set_page_config(page_title="Low-Rank Image Lab", page_icon="◫", layout="wide")
st.markdown("""
<style>
.stApp {background: #f5f7fb; color: #162235}
.block-container {max-width: 1180px; padding-top: 2rem}
.hero {padding: 1.7rem 2rem; border-radius: 18px; background: linear-gradient(115deg,#142d4e,#246c83); color:white; margin-bottom:1.2rem}
.hero h1 {margin:0; font-size:2.2rem}.hero p {margin:.5rem 0 0; color:#d8eaf2}
[data-testid="stMetric"] {background:white; border:1px solid #e3e9f1; padding:1rem; border-radius:12px}
[data-testid="stDownloadButton"] button {background:#fff !important; color:#111 !important; border:1px solid #cbd5e1 !important}
[data-testid="stDownloadButton"] button:hover {background:#f1f5f9 !important; color:#111 !important; border-color:#94a3b8 !important}
</style>
<div class="hero"><h1>Low-Rank Image Lab</h1><p>Explore truncated SVD compression and singular-value thresholding reconstruction.</p></div>
""", unsafe_allow_html=True)
st.caption("Research prototype • grayscale pipeline • processing runs through the FastAPI backend")
uploaded = st.file_uploader("Choose an image", type=["png", "jpg", "jpeg", "bmp", "tif", "tiff"])
if uploaded is None:
    st.info("Upload a grayscale or color image to begin. Color images are converted to grayscale for analysis.")
    st.stop()

try:
    image = Image.open(uploaded).convert("L")
except Exception as exc:
    st.error(f"Could not read this image: {exc}")
    st.stop()

with st.sidebar:
    st.header("Compression")
    rank = st.slider("Retained SVD rank", 1, min(200, *image.size), min(32, min(image.size)))
    st.caption("Lower rank uses fewer factor values and usually loses more detail.")
    modulo_step = st.slider("Eq. (3) modulo step q", 1.0, 64.0, 16.0, 1.0,
                            help="The paper omits the divisor in Mod(M). This is the explicit interpretation used here.")
    st.header("SVT reconstruction")
    observed = st.slider("Observed pixels", 10, 95, 50, format="%d%%") / 100
    tau = st.slider("Singular-value threshold τ", 0.0, 2000.0, 40.0, 5.0)
    delta = st.slider("Step size δ", 0.1, 2.0, 1.2, 0.1)
    initial_scale = st.number_input("Initialization multiplier i₀", min_value=0.01, max_value=100.0, value=1.0, step=0.5)
    tolerance = st.number_input("Observed error tolerance α", min_value=0.0001, max_value=1.0, value=0.01, format="%.4f")
    iterations = st.slider("Iterations", 5, 100, 30, 5)
    seed = st.number_input("Sampling seed", min_value=0, max_value=999999, value=7)

with st.spinner("Sending image to the backend for processing…"):
    try:
        response = requests.post(
            f"{API_URL.rstrip('/')}/api/process",
            files={"file": (uploaded.name, uploaded.getvalue(), uploaded.type or "application/octet-stream")},
            data={"rank": rank, "modulo_step": modulo_step, "observed_fraction": observed, "tau": tau,
                  "delta": delta, "initial_scale": initial_scale, "tolerance": tolerance,
                  "iterations": iterations, "seed": int(seed)},
            timeout=300,
        )
        response.raise_for_status()
        result = response.json()
    except requests.RequestException as exc:
        st.error(f"Could not reach the API at {API_URL}. Start the backend first. Details: {exc}")
        st.stop()

def decoded(value):
    return base64.b64decode(value)


def format_bytes(value):
    if value < 1024:
        return f"{value} B"
    if value < 1024 ** 2:
        return f"{value / 1024:.1f} KB"
    return f"{value / (1024 ** 2):.2f} MB"


original_png = decoded(result["original_png"])
compressed_png = decoded(result["compressed_png"])
reconstructed_png = decoded(result["reconstructed_png"])
factor_file = decoded(result["factors_npz"])

st.subheader("Image results")
columns = st.columns(3)
for col, title, preview in zip(columns, ["Original", f"Truncated SVD · rank {result['rank']}", "SVT completion"],
                               [original_png, compressed_png, reconstructed_png]):
    with col:
        st.markdown(f"**{title}**")
        st.image(preview, use_container_width=True)
st.caption(f"Output dimensions: {image.width} × {image.height} pixels. SVD and SVT keep the source dimensions; compression reduces the representation, not the pixel width or height.")
if result["rank"] < result["requested_rank"]:
    st.info(f"The requested rank was {result['requested_rank']}. It was reduced to {result['rank']} so the compressed SVD data is smaller than the uploaded file. Lower rank can reduce image detail.")

size_cols = st.columns(3)
input_size = len(uploaded.getvalue())
factor_size = len(factor_file)
size_cols[0].metric("Uploaded image", format_bytes(input_size))
size_cols[1].metric("Compressed SVD data (.npz)", format_bytes(factor_size))
if factor_size <= input_size:
    saved_text = f"{format_bytes(input_size - factor_size)} smaller ({100 * (1 - factor_size / max(1, input_size)):.1f}% saved)"
else:
    saved_text = f"{format_bytes(factor_size - input_size)} larger ({100 * (factor_size / max(1, input_size) - 1):.1f}% larger)"
size_cols[2].metric("Difference", saved_text)
st.caption("The .npz file stores the low-rank SVD factors (U, singular values, and Vᵀ), which can be used to rebuild the compressed approximation. It is data for reconstruction, not a viewable image. The backend lowers rank only when needed to fit this archive under the uploaded file size; if rank 1 still cannot fit, the difference will remain positive.")

metrics = result["metrics"]
svd_metrics, svt_metrics = metrics["svd"], metrics["svt"]
st.subheader("Quality and storage estimates")
items = [("Paper CR (Eq. 6)", metrics["compression_ratio"]),
         ("Paper space saved", metrics["space_saved_percent"]),
         ("SVD PSNR", svd_metrics["psnr"]), ("SVD SSIM", svd_metrics["ssim"]),
         ("SVT PSNR", svt_metrics["psnr"])]
for col, (label, value) in zip(st.columns(5), items):
    col.metric(label, value)
st.caption(f"SVD SNR: {svd_metrics['snr']} dB · SVT SNR: {svt_metrics['snr']} dB · SVT SSIM: {svt_metrics['ssim']}. Paper CR uses Eq. (6), a rank-factor count model; the actual half-precision factor archive comparison is {metrics['factor_storage_ratio']}× against the uploaded file, saving {metrics['factor_space_saved_percent']}.")
st.caption(f"Sparse pixels after Eq. (3) interpretation: {metrics['paper_sparsity_percent']:.1f}% · SVT samples from the SVD-compressed image: {metrics['observed_fraction']:.1%} · final observed-pixel error: {metrics['final_observed_error']:.4g}")

st.subheader("Downloads")
d1, d2, d3 = st.columns(3)
d1.download_button("Download SVD image", compressed_png, "svd-compressed.png", "image/png")
d2.download_button("Download SVT reconstruction", reconstructed_png, "svt-reconstructed.png", "image/png")
d3.download_button("Download compressed SVD data (.npz)", factor_file, "svd-factors.npz", "application/octet-stream")

with st.expander("What the algorithms do"):
    st.markdown("""
    **Paper compression flow:** Eq. (3) first sparsifies pixel values. Because its printed `Mod(M)` has no divisor, this app interprets it as `M mod q` and retains `M - (M mod q)` for positive pixels. Then it computes SVD, keeps the chosen rank, and reconstructs with the truncated factors. The UI reports Eq. (6)'s theoretical compression ratio and separately reports the actual float32 factor file size.

    **Paper retrieval flow:** Algorithm 1 samples entries from the compressed image, initializes the dual matrix from those observations, applies singular-value shrinkage at threshold τ, and updates observed entries with step size δ. It stops when relative observed-entry error reaches α or the iteration limit. This implementation computes a full SVD each round instead of the paper's incremental partial-SVD search. The paper permits a step-size sequence but does not specify one; this app uses a constant δ and exposes `i₀` as a parameter.

    Eq. (3)'s missing modulo divisor and Algorithm 1's unspecified step-size schedule are paper ambiguities. Those choices are exposed or explicitly stated above; results are an informed implementation, not an exact reproduction.
    """)
