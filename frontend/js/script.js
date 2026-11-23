console.log("SVD Studio frontend loaded successfully!");

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const compressBtn = document.getElementById("compressBtn");
const compressMessage = document.getElementById("compressMessage");
const analysisRank = document.getElementById("analysisRank");
const analysisDimensions = document.getElementById("analysisDimensions");
const analysisMaxRank = document.getElementById("analysisMaxRank");
const rankInsight = document.getElementById("rankInsight");
let latestSingularValues = [];
// Rank vs Image Quality graph elements
const qualityCanvas = document.getElementById("qualityCanvas");
const qualityChartMessage = document.getElementById("qualityChartMessage");

let latestQualityCurve = [];
// Rank vs Compression graph elements
const compressionCanvas = document.getElementById("compressionCanvas");
const compressionChartMessage = document.getElementById("compressionChartMessage");

let latestCompressionCurve = [];
// Singular value graph elements
const singularValueCanvas = document.getElementById("singularValueCanvas");
const singularChartMessage = document.getElementById("singularChartMessage");

navItems.forEach((item) => {

    item.addEventListener("click", () => {

        // Remove active from all navigation buttons
        navItems.forEach((nav) => {
            nav.classList.remove("active");
        });

        // Activate the clicked navigation button
        item.classList.add("active");

        // Get the page name from the clicked button
        const pageName = item.dataset.page;

        // Hide all pages
        pages.forEach((page) => {
            page.classList.remove("active");
        });

        // Show the selected page
        document.getElementById(pageName).classList.add("active");
        // Draw singular value graph when Analysis page opens
        if (pageName === "analysis" && latestSingularValues.length > 0) {
            drawSingularValueGraph(latestSingularValues);
            singularChartMessage.style.display = "none";
        }
        // Draw Rank vs Image Quality graph
        if (pageName === "analysis" && latestQualityCurve.length > 0) {
            drawQualityGraph(latestQualityCurve);
            qualityChartMessage.style.display = "none";
        }
        // Draw Rank vs Compression graph
        if (pageName === "analysis" && latestCompressionCurve.length > 0) {
            drawCompressionGraph(latestCompressionCurve);
            compressionChartMessage.style.display = "none";
        }

    });

});

// =============================
// IMAGE UPLOAD FUNCTIONALITY
// =============================

const uploadBtn = document.getElementById("uploadBtn");
const imageInput = document.getElementById("imageInput");
const uploadBox = document.getElementById("uploadBox");

const previewContainer = document.getElementById("previewContainer");
const imagePreview = document.getElementById("imagePreview");
const imageDetails = document.getElementById("imageDetails");

const comparisonSection = document.getElementById("comparisonSection");

const originalComparisonImage =
    document.getElementById("originalComparisonImage");

const reconstructedImage =
    document.getElementById("reconstructedImage");

const originalComparisonInfo =
    document.getElementById("originalComparisonInfo");

const reconstructedComparisonInfo =
    document.getElementById("reconstructedComparisonInfo");


// Open file picker when button is clicked

uploadBtn.addEventListener("click", () => {
    imageInput.click();
});


// When an image is selected
imageInput.addEventListener("change", () => {

    const file = imageInput.files[0];

    if (file) {
        // Validate file type
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/bmp"
        ];

        if (!allowedTypes.includes(file.type)) {
            compressMessage.textContent =
                "Unsupported file type. Please upload JPG, PNG, WEBP, or BMP.";

            imageInput.value = "";
            return;
        }

        // Validate file size (20 MB maximum)
        const maxFileSize = 20 * 1024 * 1024;

        if (file.size > maxFileSize) {
            compressMessage.textContent =
                "Image is too large. Maximum file size is 20 MB.";

            imageInput.value = "";
            return;
        }

        // Reset previous results
        resultsSection.classList.remove("show");

        resultImage.src = "";
        resultImage.style.display = "none";
        resultPlaceholder.style.display = "block";

        differenceImage.src = "";
        differenceImage.style.display = "none";
        differencePlaceholder.style.display = "block";

        originalComparisonImage.src = "";
        reconstructedImage.src = "";

        // Reset metrics
        snrValue.textContent = "--";
        psnrValue.textContent = "--";
        ratioValue.textContent = "--";
        storageValue.textContent = "--";

        // Reset download
        downloadBtn.disabled = true;
        reconstructedImageData = null;
        downloadMessage.textContent = "";

        // Reset messages
        compressMessage.textContent = "";

        // Display newly uploaded image
        displayImage(file);

    }

});

// Display the selected image
// Store the current temporary image URL
let currentImageURL = null;


// Display the selected image
function displayImage(file) {

    if (!file.type.startsWith("image/")) {
        alert("Please select a valid image.");
        return;
    }

    // Remove the previous temporary URL if it exists
    if (currentImageURL) {
        URL.revokeObjectURL(currentImageURL);
    }

    // Create a temporary URL for the new image
    currentImageURL = URL.createObjectURL(file);

    imagePreview.src = currentImageURL;

    // Update original comparison image
    originalComparisonImage.src = currentImageURL;

    // Temporary placeholder until backend reconstruction is ready
    reconstructedImage.src = currentImageURL;

    // Show comparison section
    comparisonSection.classList.add("show");

    // Update comparison information
    originalComparisonInfo.textContent =
        "Original uploaded image";

    reconstructedComparisonInfo.textContent =
        "Preview only — actual SVD reconstruction will appear after compression";

    previewContainer.classList.add("show");

    imagePreview.onload = () => {

        const width = imagePreview.naturalWidth;
        const height = imagePreview.naturalHeight;
        analysisDimensions.textContent = `${width} × ${height}`;

        const maxRank = Math.min(width, height);

        analysisMaxRank.textContent = maxRank;

        rankSlider.max = Math.min(maxRank, 100);

        if (Number(rankSlider.value) > Number(rankSlider.max)) {
            rankSlider.value = rankSlider.max;
        }

        rankValue.textContent = rankSlider.value;
        analysisRank.textContent = rankSlider.value;

        const size = (file.size / 1024).toFixed(2);

        imageDetails.innerHTML = `
            <p><strong>File name:</strong> ${file.name}</p>
            <p><strong>Dimensions:</strong> ${width} × ${height} pixels</p>
            <p><strong>File size:</strong> ${size} KB</p>
        `;

        // Enable compression
        compressBtn.disabled = false;

        // Update compression message
        compressMessage.textContent = "Ready to compress your image.";

        updateRankInsight(Number(rankSlider.value));

    };

}
// =============================
// DRAG AND DROP FUNCTIONALITY
// =============================

// Prevent browser from opening the file when dropped
uploadBox.addEventListener("dragover", (event) => {
    event.preventDefault();
});

// Highlight the upload area while dragging
uploadBox.addEventListener("dragenter", (event) => {
    event.preventDefault();
    uploadBox.classList.add("dragover");
});

// Remove highlight when dragging away
uploadBox.addEventListener("dragleave", () => {
    uploadBox.classList.remove("dragover");
});

// Handle the dropped file
uploadBox.addEventListener("drop", (event) => {
    event.preventDefault();

    uploadBox.classList.remove("dragover");

    const file = event.dataTransfer.files[0];

    if (file) {
        displayImage(file);
    }
});

// =============================
// REPLACE IMAGE
// =============================

const replaceImageBtn = document.getElementById("replaceImageBtn");

replaceImageBtn.addEventListener("click", () => {
    imageInput.click();
});


// =============================
// REMOVE IMAGE
// =============================

const removeImageBtn = document.getElementById("removeImageBtn");

removeImageBtn.addEventListener("click", () => {

    // Clear image preview
    imagePreview.src = "";

    // Hide preview section
    previewContainer.classList.remove("show");

    // Clear image information
    imageDetails.innerHTML = "";

    // Release temporary image URL
    if (currentImageURL) {
        URL.revokeObjectURL(currentImageURL);
        currentImageURL = null;
    }

    // Reset file input
    imageInput.value = "";

    // Clear comparison images
    originalComparisonImage.src = "";
    reconstructedImage.src = "";

    // Hide comparison section
    comparisonSection.classList.remove("show");

    // Reset comparison information
    originalComparisonInfo.textContent = "";
    reconstructedComparisonInfo.textContent = "";

    compressBtn.disabled = true;
    compressMessage.textContent = "Upload an image to get started.";

    analysisRank.textContent = "--";
    analysisDimensions.textContent = "--";
    analysisMaxRank.textContent = "--";

    rankSlider.max = 100;
    rankSlider.value = 50;

    rankValue.textContent = 50;
    rankInsight.textContent =
    "Upload an image and adjust the rank to explore the relationship between compression and reconstruction quality.";

});

// =============================
// COMPRESSION RANK SLIDER
// =============================

const rankSlider = document.getElementById("rankSlider");
const rankValue = document.getElementById("rankValue");
const rankDescription = document.getElementById("rankDescription");


rankSlider.addEventListener("input", () => {

    // Read the current slider value
    const k = Number(rankSlider.value);

    // Update the displayed rank
    rankValue.textContent = k;
    analysisRank.textContent = k;

    // Update the description
    if (k <= 20) {

        rankDescription.textContent =
            "Low rank: retain less information. " +
            "Expect stronger compression and more visible loss of image detail.";

    } else if (k <= 50) {

        rankDescription.textContent =
            "Moderate rank: a balance between compression and reconstructed image quality.";

    } else {

        rankDescription.textContent =
            "High rank: retain more information for better reconstruction, " +
            "but compression savings may be smaller.";

    }
    updateRankInsight(k);

});


const resultsSection = document.getElementById("resultsSection");

// Result elements
const snrValue = document.getElementById("mseValue");
const psnrValue = document.getElementById("psnrValue");
const ratioValue = document.getElementById("ratioValue");
const storageValue = document.getElementById("storageValue");

const resultImage = document.getElementById("resultImage");
const resultPlaceholder = document.getElementById("resultPlaceholder");
const difference_image = document.getElementById("differenceImage");
const differencePlaceholder = document.getElementById("differencePlaceholder");

compressBtn.addEventListener("click", async () => {

    const file = imageInput.files[0];

    if (!file) {
        compressMessage.textContent = "Please upload an image first.";
        return;
    }
    // Clear results from any previous compression attempt
    resultsSection.classList.remove("show");

    resultImage.src = "";
    resultImage.style.display = "none";
    resultPlaceholder.style.display = "block";

    differenceImage.src = "";
    differenceImage.style.display = "none";
    differencePlaceholder.style.display = "block";

    originalComparisonImage.src = "";
    reconstructedImage.src = "";

    snrValue.textContent = "--";
    psnrValue.textContent = "--";
    ratioValue.textContent = "--";
    storageValue.textContent = "--";

    downloadBtn.disabled = true;
    reconstructedImageData = null;
    downloadMessage.textContent = "";

    compressBtn.disabled = true;
    compressMessage.textContent = "Processing image... Please wait.";
    compressBtn.textContent = "Processing...";

    try {

        // Prepare the image and selected rank
        const formData = new FormData();

        formData.append("file", file);
        formData.append("rank", rankSlider.value);

        // Send the image to the FastAPI backend
        const response = await fetch(
            "http://127.0.0.1:8000/api/process",
            {
                method: "POST",
                body: formData
            }
        );

        if (!response.ok) {

            let errorMessage = `Request failed (${response.status})`;

            try {
                const errorData = await response.json();

                if (errorData.detail) {
                    errorMessage = errorData.detail;
                }

            } catch (parseError) {
                console.log("Could not read backend error response.");
            }

            throw new Error(errorMessage);
        }

        const data = await response.json();
        // Store Rank vs Image Quality measurements
        latestQualityCurve = data.quality_curve || [];
        // Store Rank vs Compression measurements
        latestCompressionCurve = data.compression_curve || [];
        console.table(data.quality_curve);
        // Display Singular Value Distribution
        latestSingularValues = data.singular_values || [];

        // Hide the placeholder message
    
        // Update Analysis overview cards
        analysisRank.textContent = data.rank;

        analysisDimensions.textContent =
            `${data.width} × ${data.height}`;

        analysisMaxRank.textContent =
            Math.min(data.width, data.height);

        // Display image quality metrics
        snrValue.textContent = data.metrics.svt.snr;
        psnrValue.textContent = data.metrics.svt.psnr;
        ratioValue.textContent = data.metrics.compression_ratio;
        storageValue.textContent = data.metrics.space_saved_percent;

        // Display original and reconstructed images in comparison section

        originalComparisonImage.src =
            "data:image/png;base64," + data.original_png;

        reconstructedImage.src =
            "data:image/png;base64," + data.reconstructed_png;

        originalComparisonInfo.textContent =
            `Original image · ${data.width} × ${data.height}`;

        reconstructedComparisonInfo.textContent =
            `Reconstructed image · Rank ${data.rank} · ${data.width} × ${data.height}`;

        // Display reconstructed image
        resultImage.src =
            "data:image/png;base64," + data.reconstructed_png;
            // Store reconstructed image for downloading
            reconstructedImageData =
                "data:image/png;base64," + data.reconstructed_png;

            // Enable download button after successful processing
            downloadBtn.disabled = false;

            downloadMessage.textContent =
                "Your reconstructed image is ready to download.";

        resultImage.onerror = () => {
            console.error("Reconstructed image failed to load.");
        };

        resultPlaceholder.style.display = "none";
        resultImage.style.display = "block";

        // Generate and display the image difference visualization
        const originalSrc = "data:image/png;base64," + data.original_png;
        const reconstructedSrc = "data:image/png;base64," + data.reconstructed_png;

        differenceImage.src = await generateDifferenceImage(
            originalSrc,
            reconstructedSrc
        );

        differencePlaceholder.style.display = "none";
        differenceImage.style.display = "block";

        // Show results
        resultsSection.classList.add("show");

        compressMessage.textContent = "Image processed successfully!";

    } catch (error) {
        console.error("Compression error:", error);

        compressMessage.textContent = "Error: " + error.message;

    } finally {

        compressBtn.disabled = false;
        compressBtn.textContent = "Compress Image";

    }

});
// =============================
// DOWNLOAD RECONSTRUCTED IMAGE
// =============================

const downloadBtn = document.getElementById("downloadBtn");
const downloadMessage = document.getElementById("downloadMessage");

let reconstructedImageData = null;

downloadBtn.addEventListener("click", () => {

    if (!reconstructedImageData) {
        return;
    }

    const link = document.createElement("a");

    link.href = reconstructedImageData;
    link.download = "svd_reconstructed_image.png";

    link.click();

    downloadMessage.textContent =
        "Your reconstructed image has been downloaded.";

});

// =============================
// RANK INSIGHT FUNCTION
// =============================

function updateRankInsight(k) {

    const maxRank = Number(rankSlider.max);
    const percentage = (k / maxRank) * 100;

    if (percentage <= 20) {

        rankInsight.textContent =
            `You are retaining a very small number of components (${k} out of ${maxRank}). ` +
            `This can produce strong compression, but much of the image detail may be lost.`;

    } else if (percentage <= 50) {

        rankInsight.textContent =
            `You are retaining ${k} components out of ${maxRank}. ` +
            `This is a relatively low rank, so compression is prioritized over fine detail.`;

    } else if (percentage <= 80) {

        rankInsight.textContent =
            `You are retaining ${k} components out of ${maxRank}. ` +
            `More information is preserved, which generally helps reconstruction quality, ` +
            `though the storage requirement increases.`;

    } else {

        rankInsight.textContent =
            `You are retaining ${k} components out of ${maxRank}, ` +
            `which is close to the selected maximum rank. ` +
            `This generally preserves more image information, but offers less compression.`;

    }
}

// =============================
// GENERATE IMAGE DIFFERENCE
// =============================

function generateDifferenceImage(originalSrc, reconstructedSrc) {

    return new Promise((resolve, reject) => {

        const originalImg = new Image();
        const reconstructedImg = new Image();

        originalImg.onload = () => {

            reconstructedImg.onload = () => {

                // Create a canvas matching the image dimensions
                const canvas = document.createElement("canvas");

                canvas.width = originalImg.naturalWidth;
                canvas.height = originalImg.naturalHeight;

                const ctx = canvas.getContext("2d");

                // Draw the original image
                ctx.drawImage(originalImg, 0, 0);

                const originalData = ctx.getImageData(
                    0, 0, canvas.width, canvas.height
                );

                // Draw the reconstructed image
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(
                    reconstructedImg,
                    0, 0,
                    canvas.width,
                    canvas.height
                );

                const reconstructedData = ctx.getImageData(
                    0, 0, canvas.width, canvas.height
                );

                // Compare pixel values
                const diffImage = ctx.createImageData(
                    canvas.width,
                    canvas.height
                );

                const amplification = 4;

                for (let i = 0; i < originalData.data.length; i += 4) {

                    const difference = Math.abs(
                        originalData.data[i] - reconstructedData.data[i]
                    );

                    const intensity = Math.min(
                        255,
                        difference * amplification
                    );

                    diffImage.data[i] = intensity;
                    diffImage.data[i + 1] = intensity;
                    diffImage.data[i + 2] = intensity;
                    diffImage.data[i + 3] = 255;

                }

                // Display the generated difference image
                ctx.putImageData(diffImage, 0, 0);

                resolve(canvas.toDataURL("image/png"));

            };

            reconstructedImg.onerror = reject;

            reconstructedImg.src = reconstructedSrc;

        };

        originalImg.onerror = reject;

        originalImg.src = originalSrc;

    });

}
// =================================
// DRAW SINGULAR VALUE DISTRIBUTION
// =================================

function drawSingularValueGraph(values) {

    if (!values || values.length === 0) {
        return;
    }

    const canvas = singularValueCanvas;
    const ctx = canvas.getContext("2d");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    console.log("Canvas dimensions:", width, height);
    console.log("Singular values:", values);

    canvas.width = width;
    canvas.height = height;

    const padding = 40;

    const maxValue = Math.max(...values);
    const minValue = 0;

    // Clear previous graph
    ctx.clearRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {

        const y = padding +
            (height - 2 * padding) * i / 4;

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

    }

    // Draw singular value curve
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();

    values.forEach((value, index) => {

        const x = padding +
            (index / Math.max(1, values.length - 1)) *
            (width - 2 * padding);

        const y = height - padding -
            ((value - minValue) / (maxValue - minValue || 1)) *
            (height - 2 * padding);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }

    });

    ctx.stroke();
}
// =================================
// DRAW RANK VS IMAGE QUALITY GRAPH
// =================================

function drawQualityGraph(data) {

    if (!data || data.length === 0) return;

    const canvas = qualityCanvas;
    const ctx = canvas.getContext("2d");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;

    const padding = 45;

    const ranks = data.map(item => item.rank);
    const psnrValues = data.map(item => parseFloat(item.psnr));

    const minRank = Math.min(...ranks);
    const maxRank = Math.max(...ranks);
    const minPSNR = Math.min(...psnrValues);
    const maxPSNR = Math.max(...psnrValues);

    const xRange = maxRank - minRank || 1;
    const yRange = maxPSNR - minPSNR || 1;

    ctx.clearRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = padding +
            (height - 2 * padding) * i / 4;

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // Draw quality curve
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((item, index) => {

        const x = padding +
            ((item.rank - minRank) / xRange) *
            (width - 2 * padding);

        const y = height - padding -
            ((parseFloat(item.psnr) - minPSNR) / yRange) *
            (height - 2 * padding);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Draw measurement points
    data.forEach(item => {

        const x = padding +
            ((item.rank - minRank) / xRange) *
            (width - 2 * padding);

        const y = height - padding -
            ((Number(item.psnr) - minPSNR) / yRange) *
            (height - 2 * padding);

        ctx.fillStyle = "#6366f1";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawCompressionGraph(data) {
    if (!data || data.length === 0) return;

    const canvas = compressionCanvas;
    const ctx = canvas.getContext("2d");

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;

    const padding = 45;

    const ranks = data.map(item => item.rank);
    const ratios = data.map(item => item.compression_ratio);

    const minRank = Math.min(...ranks);
    const maxRank = Math.max(...ranks);
    const minRatio = Math.min(...ratios);
    const maxRatio = Math.max(...ratios);

    const xRange = maxRank - minRank || 1;
    const yRange = maxRatio - minRatio || 1;

    ctx.clearRect(0, 0, width, height);

    // Draw horizontal grid lines
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = padding + (height - 2 * padding) * i / 4;

        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
    }

    // Draw compression curve
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((item, index) => {
        const x = padding +
            ((item.rank - minRank) / xRange) * (width - 2 * padding);

        const y = height - padding -
            ((item.compression_ratio - minRatio) / yRange) * (height - 2 * padding);

        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Draw data points
    data.forEach(item => {
        const x = padding +
            ((item.rank - minRank) / xRange) * (width - 2 * padding);

        const y = height - padding -
            ((item.compression_ratio - minRatio) / yRange) * (height - 2 * padding);

        ctx.fillStyle = "#6366f1";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}
