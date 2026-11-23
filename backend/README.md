# Low-Rank Image Lab

A web-based image compression and reconstruction application using Singular Value Decomposition (SVD).

The project consists of a separate HTML, CSS, and JavaScript frontend and a Python FastAPI backend. Users can upload images, select compression parameters, view reconstructed images, examine image-quality metrics, and explore analysis graphs.

The backend handles image processing and exposes REST API endpoints. Interactive API documentation is available at `/docs`, and the health status endpoint is available at `/api/health`.

## Run on Windows

### Requirements
- Python 3.14 or newer
- uv package manager
- Visual Studio Code
- Live Server extension for VS Code

### 1. Start the backend

Open PowerShell in the `backend` folder:

```powershell
uv sync
```

Start the FastAPI server:

```powershell
.venv\Scripts\python.exe -m uvicorn backend:app --reload --host 127.0.0.1 --port 8000
```

The backend will run at:

`http://127.0.0.1:8000`

API documentation:

`http://127.0.0.1:8000/docs`

### 2. Start the frontend

Open the project in Visual Studio Code.

1. Open `frontend/index.html`.
2. Right-click inside the editor.
3. Select **Open with Live Server**.

The frontend will usually be available at:

`http://127.0.0.1:5500/frontend/index.html`

Keep both the backend terminal and Live Server running while using the application.

## API

The FastAPI backend currently exposes the following endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Checks whether the backend is running. |
| POST | `/api/process` | Uploads and processes an image using SVD compression and SVT reconstruction. |
| GET | `/docs` | Opens interactive API documentation. |

### Image Processing Request

`POST /api/process` accepts multipart form data.

**Input fields:**
- `file`: Image file to process.
- `rank`: Requested SVD rank.
- `modulo_step`: Pixel preprocessing parameter.
- `observed_fraction`: Fraction of image entries observed during SVT.
- `tau`: Singular-value threshold.
- `delta`: SVT step size.
- `initial_scale`: Initial scaling parameter.
- `tolerance`: Reconstruction stopping tolerance.
- `iterations`: Maximum number of SVT iterations.
- `seed`: Random seed.

**Response:**

The endpoint returns JSON containing:
- Original, compressed, and reconstructed image previews (base64-encoded PNGs).
- Image dimensions.
- Requested and effective rank.
- Downloadable SVD factor data (base64-encoded NPZ).
- Compression information and image-quality metrics, including SNR, PSNR, and SSIM.

Uploads are limited to 20 MiB, and image dimensions must not exceed 4096 pixels.

## Algorithm notes

Compression applies Eq. (3) before SVD. The paper prints `Mod(M)` without a modulus divisor, so the UI exposes `q` and interprets this as `M - (M mod q)` when `M > M mod q`, else zero. This floors nonnegative grayscale intensities to multiples of q; it is not the conventional magnitude soft-thresholding operator. After this preprocessing, the app computes `M = U Σ Vᵀ`, retains rank `r`, and reconstructs with `Uᵣ Σᵣ Vᵣᵀ` (Eqs. 4–5).

The primary compression ratio and space saving use paper Eq. (6): `CR = N×M / (k×(N+M+1))` and `SS = (1 - 1/CR)×100`. The downloadable `.npz` stores U and Vᵀ in float16 and singular values in float32. If this archive is not smaller than the uploaded file, the backend lowers the retained rank until it fits, or rank 1 is reached. This may reduce visual detail; the app reports the effective rank. The actual archive size is compared directly with the uploaded file, while Eq. (6) remains a theoretical factor-count measure.

SVT samples a fraction Ω from the **compressed image**, as in Algorithm 1. It initializes `Y⁰ = i₀ δ PΩ(K)` with `i₀=1`, computes the singular-value shrinkage `Dτ(Y)=U diag(max(σ−τ,0)) Vᵀ`, and updates observed entries by `Y ← Y + δ PΩ(K−X)`. It stops when relative observed-entry error is at most α or the iteration limit is reached. This implementation uses a full SVD each iteration instead of Algorithm 1's incremental partial-SVD rank search. The paper allows a sequence of step sizes but does not prescribe it; the app uses constant δ. The original upload is used for quality metrics, not for the hidden-pixel SVT observations.

SNR is `10 log10(sum(M²)/sum((M−X)²))`, PSNR uses 8-bit peak 255, and SSIM uses scikit-image with `data_range=255`.

## Paper fidelity and known ambiguities

The attached paper has now been reviewed. The app follows its pixel preprocessing + truncated-SVD + sampled SVT reconstruction structure, Eqs. (4)–(10), Algorithm 1's thresholding and observed-entry stopping rule, and the Eq. (6) compression-ratio convention. It does not claim exact reproduction: Eq. (3) omits the modulo divisor, and Algorithm 1 does not specify a concrete step-size schedule. This app uses configurable `q` and `i₀`, with constant δ. It also uses a full SVD per iteration instead of the paper's incremental partial-SVD search. No paper's experimental results are reproduced or claimed.

## Project Structure

```text
SVD-Web-App/
│
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
│
└── backend/
    ├── backend.py
    ├── svd_compression.py
    ├── reconstruction.py
    ├── metrics.py
    ├── app.py
    ├── requirements.txt
    ├── pyproject.toml
    ├── uv.lock
    └── README.md
```

### Main file responsibilities

- `index.html`: Frontend page structure.
- `style.css`: Frontend appearance and layout.
- `script.js`: Frontend interactions, API communication, and graph rendering.
- `backend.py`: FastAPI endpoints and image-processing orchestration.
- `svd_compression.py`: SVD-based image compression.
- `reconstruction.py`: Image reconstruction and SVT processing.
- `metrics.py`: Image-quality measurements such as SNR, PSNR, and SSIM.
- `app.py`: Legacy Streamlit interface; not used by the current frontend.
