const imageInput = document.getElementById("imageInput");
const sourceImage = document.getElementById("sourceImage");
const uploadMessage = document.getElementById("uploadMessage");
const circleCount = document.getElementById("circleCount");
const circleValue = document.getElementById("circleValue");
const generateBtn = document.getElementById("generateBtn");
const playBtn = document.getElementById("playBtn");
const pngBtn = document.getElementById("pngBtn");
const gifBtn = document.getElementById("gifBtn");
const statusText = document.getElementById("status");
const placeholder = document.getElementById("canvasPlaceholder");
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");

const SAMPLE_COUNT = 512;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const WORK_SIZE = 320; // longest side used for subject detection

const ALLOWED_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/x-ms-bmp",
    "image/svg+xml",
    "image/avif"
];

const ALLOWED_EXTENSIONS = [
    "png", "jpg", "jpeg", "jfif", "webp",
    "gif", "bmp", "svg", "avif"
];

let selectedFile = null;
let sourceRaster = null; // canvas holding the rasterized upload
let coefficients = [];
let maxRadius = 1;
let running = true;
let generated = false;
let currentTime = 0;
let previousFrame = 0;
let animationId = null;
let exporting = false;

const TAU = 2 * Math.PI;

function setStatus(message) {
    statusText.textContent = message;
}

function openCVIsReady() {
    return window.openCVReady && typeof cv !== "undefined";
}

function updateGenerateButton() {
    generateBtn.disabled = !selectedFile || !sourceRaster || !openCVIsReady();
}

window.addEventListener("opencv-ready", () => {
    updateGenerateButton();
    setStatus(selectedFile
        ? "Ready to generate"
        : "Ready — upload an image");
});

if (openCVIsReady()) {
    updateGenerateButton();
}

/* ---------- File loading (PNG, JPG, WebP, GIF, BMP, AVIF, SVG) ---------- */

function getExtension(name) {
    const match = /\.([a-z0-9]+)$/i.exec(name || "");
    return match ? match[1].toLowerCase() : "";
}

function isSupportedFile(file) {
    return (
        ALLOWED_TYPES.includes(file.type) ||
        ALLOWED_EXTENSIONS.includes(getExtension(file.name))
    );
}

function isSvgFile(file) {
    return (
        file.type === "image/svg+xml" ||
        getExtension(file.name) === "svg"
    );
}

// Some browsers cannot draw an SVG that has no explicit width/height,
// so we make sure it has them before loading it as an image.
async function createImageUrl(file) {
    if (!isSvgFile(file)) {
        return URL.createObjectURL(file);
    }

    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.documentElement;

    if (
        !svg ||
        svg.nodeName.toLowerCase() !== "svg" ||
        doc.querySelector("parsererror")
    ) {
        throw new Error("Invalid SVG");
    }

    const viewBox = (svg.getAttribute("viewBox") || "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);

    const vbW = viewBox.length === 4 && viewBox[2] > 0 ? viewBox[2] : 512;
    const vbH = viewBox.length === 4 && viewBox[3] > 0 ? viewBox[3] : 512;

    const widthAttr = svg.getAttribute("width");
    const heightAttr = svg.getAttribute("height");

    if (!widthAttr || widthAttr.includes("%")) {
        svg.setAttribute("width", vbW);
    }

    if (!heightAttr || heightAttr.includes("%")) {
        svg.setAttribute("height", vbH);
    }

    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], {
        type: "image/svg+xml;charset=utf-8"
    });

    return URL.createObjectURL(blob);
}

// Draw the loaded image onto a work canvas (keeps transparency).
function rasterizeSource(img) {
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const scale = WORK_SIZE / Math.max(w, h);

    const rw = Math.max(16, Math.round(w * scale));
    const rh = Math.max(16, Math.round(h * scale));

    const raster = document.createElement("canvas");
    raster.width = rw;
    raster.height = rh;

    const rctx = raster.getContext("2d", {
        willReadFrequently: true
    });

    rctx.drawImage(img, 0, 0, rw, rh);

    return raster;
}

imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];

    if (!file) return;

    if (!isSupportedFile(file)) {
        alert("Please choose a PNG, JPG, WebP, GIF, BMP, AVIF or SVG image.");
        imageInput.value = "";
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        alert("The image must be 8 MB or smaller.");
        imageInput.value = "";
        return;
    }

    selectedFile = file;
    sourceRaster = null;

    // Reset the previous result.
    generated = false;
    coefficients = [];
    maxRadius = 1;
    currentTime = 0;

    stopAnimation();
    clearCanvas();

    pngBtn.disabled = true;
    gifBtn.disabled = true;
    playBtn.disabled = true;
    generateBtn.disabled = true;

    let url;

    try {
        url = await createImageUrl(file);
    } catch (error) {
        console.error(error);
        selectedFile = null;
        sourceImage.hidden = true;
        uploadMessage.hidden = false;
        uploadMessage.textContent = "Could not read this image.";
        updateGenerateButton();
        return;
    }

    sourceImage.onload = () => {
        try {
            sourceRaster = rasterizeSource(sourceImage);
        } catch (error) {
            console.error(error);
            sourceRaster = null;
        }

        URL.revokeObjectURL(url);

        if (!sourceRaster) {
            selectedFile = null;
            sourceImage.hidden = true;
            uploadMessage.hidden = false;
            uploadMessage.textContent = "Could not read this image.";
            updateGenerateButton();
            return;
        }

        sourceImage.hidden = false;
        uploadMessage.hidden = true;
        setStatus(openCVIsReady()
            ? "Ready to generate"
            : "Loading image-processing engine...");

        updateGenerateButton();
    };

    sourceImage.onerror = () => {
        URL.revokeObjectURL(url);
        selectedFile = null;
        sourceRaster = null;
        sourceImage.hidden = true;
        uploadMessage.hidden = false;
        uploadMessage.textContent = "Could not read this image.";
        updateGenerateButton();
    };

    sourceImage.src = url;
});

circleCount.addEventListener("input", () => {
    circleValue.textContent = circleCount.value;

    if (generated) {
        currentTime = 0;
        drawFrame(0, true);
    }
});

generateBtn.addEventListener("click", generateDrawing);

playBtn.addEventListener("click", () => {
    running = !running;
    playBtn.textContent = running ? "Pause" : "Play";

    if (running) {
        previousFrame = 0;
        startAnimation();
    } else {
        stopAnimation();
    }
});

pngBtn.addEventListener("click", downloadPNG);
gifBtn.addEventListener("click", downloadGIF);

// Keep the canvas sharp on different screen sizes.
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (generated) {
        drawFrame(currentTime, true);
    } else {
        clearCanvas();
    }
}

window.addEventListener("resize", resizeCanvas);

function clearCanvas() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);
    placeholder.style.display = "flex";
}

resizeCanvas();

function generateDrawing() {
    if (!selectedFile || !sourceRaster || !openCVIsReady()) {
        setStatus("Please wait for the image engine to load.");
        return;
    }

    generateBtn.disabled = true;
    pngBtn.disabled = true;
    gifBtn.disabled = true;
    playBtn.disabled = true;

    setStatus("Finding the main subject... this may take a few seconds");

    // Let the browser update the UI before heavy processing.
    setTimeout(() => {
        try {
            processImage();
        } catch (error) {
            console.error(error);
            setStatus("Could not process this image.");
            alert(
                "Could not find a clear main subject. " +
                "Try an image where the person or object is centered " +
                "and well separated from the background."
            );
        } finally {
            updateGenerateButton();
        }
    }, 60);
}

/* ---------- Subject detection ---------- */

function maskIsUsable(mask) {
    if (!mask) return false;

    const ratio = cv.countNonZero(mask) / (mask.rows * mask.cols);

    return ratio > 0.005 && ratio < 0.97;
}

// 1) Transparent PNG / WebP / GIF / SVG: the alpha channel IS the subject.
function maskFromAlpha(raster) {
    const w = raster.width;
    const h = raster.height;

    const data = raster
        .getContext("2d", { willReadFrequently: true })
        .getImageData(0, 0, w, h).data;

    let transparent = 0;

    for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 250) transparent++;
    }

    const ratio = transparent / (w * h);

    // Only trust alpha when a meaningful part of the image is transparent.
    if (ratio < 0.01 || ratio > 0.995) return null;

    const mask = cv.Mat.zeros(h, w, cv.CV_8UC1);

    for (let i = 0; i < w * h; i++) {
        mask.data[i] = data[i * 4 + 3] > 16 ? 255 : 0;
    }

    return mask;
}

// 2) Photos: GrabCut, seeded with hints:
//    - outer border band  = sure background
//    - centre ellipse     = probably the subject
//    - tiny centre core   = sure subject
function maskFromGrabCut(rgba, w, h, marginFrac) {
    if (typeof cv.grabCut !== "function") {
        console.warn("cv.grabCut is not available in this OpenCV.js build");
        return null;
    }

    const rgb = new cv.Mat();
    const gcMask = new cv.Mat(h, w, cv.CV_8UC1);
    const bgdModel = new cv.Mat();
    const fgdModel = new cv.Mat();

    try {
        cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);

        const BGD = 0, FGD = 1, PR_BGD = 2, PR_FGD = 3;
        const mx = Math.max(2, Math.round(w * marginFrac));
        const my = Math.max(2, Math.round(h * marginFrac));
        const cx = w / 2;
        const cy = h / 2;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const nx = (x - cx) / (w / 2);
                const ny = (y - cy) / (h / 2);
                const d = nx * nx + ny * ny;

                let v = PR_BGD;

                if (d < 0.52) v = PR_FGD;   // ~72% ellipse
                if (d < 0.04) v = FGD;      // ~20% core

                if (
                    x < mx || x >= w - mx ||
                    y < my || y >= h - my
                ) {
                    v = BGD;
                }

                gcMask.data[y * w + x] = v;
            }
        }

        cv.grabCut(
            rgb,
            gcMask,
            new cv.Rect(0, 0, w, h),
            bgdModel,
            fgdModel,
            6,
            1 // GC_INIT_WITH_MASK
        );

        const out = cv.Mat.zeros(h, w, cv.CV_8UC1);

        for (let i = 0; i < w * h; i++) {
            const v = gcMask.data[i];
            if (v === FGD || v === PR_FGD) out.data[i] = 255;
        }

        return out;
    } catch (error) {
        console.warn("GrabCut failed:", error);
        return null;
    } finally {
        rgb.delete();
        gcMask.delete();
        bgdModel.delete();
        fgdModel.delete();
    }
}

// 3) Fallback: everything that differs from the border colour is subject.
function maskFromBackgroundColor(rgba, w, h) {
    const d = rgba.data;

    let r = 0, g = 0, b = 0, n = 0;

    const addPixel = (x, y) => {
        const i = (y * w + x) * 4;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
    };

    for (let x = 0; x < w; x++) {
        addPixel(x, 0);
        addPixel(x, h - 1);
    }

    for (let y = 1; y < h - 1; y++) {
        addPixel(0, y);
        addPixel(w - 1, y);
    }

    r /= n;
    g /= n;
    b /= n;

    const dist = cv.Mat.zeros(h, w, cv.CV_8UC1);

    for (let i = 0; i < w * h; i++) {
        const dr = d[i * 4] - r;
        const dg = d[i * 4 + 1] - g;
        const db = d[i * 4 + 2] - b;

        dist.data[i] = Math.min(
            255,
            Math.sqrt((dr * dr + dg * dg + db * db) / 3)
        );
    }

    const out = new cv.Mat();

    try {
        cv.GaussianBlur(dist, dist, new cv.Size(5, 5), 0);
        cv.threshold(
            dist,
            out,
            0,
            255,
            cv.THRESH_BINARY + cv.THRESH_OTSU
        );

        return out;
    } finally {
        dist.delete();
    }
}

// Remove specks and fill small gaps.
function cleanMask(mask) {
    const kernel = cv.Mat.ones(5, 5, cv.CV_8U);

    try {
        cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel);
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
    } finally {
        kernel.delete();
    }
}

// Outer contour of the largest connected subject.
function extractOutline(mask, w, h) {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    try {
        cv.findContours(
            mask,
            contours,
            hierarchy,
            cv.RETR_EXTERNAL,
            cv.CHAIN_APPROX_NONE
        );

        if (contours.size() === 0) {
            throw new Error("No contours found");
        }

        let bestIndex = -1;
        let bestArea = 0;

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            if (area > bestArea) {
                bestArea = area;
                bestIndex = i;
            }

            contour.delete();
        }

        if (bestIndex < 0 || bestArea < 20) {
            throw new Error("No useful outline found");
        }

        const best = contours.get(bestIndex);

        try {
            const data = best.data32S;
            const points = [];

            for (let i = 0; i < data.length; i += 2) {
                points.push({ x: data[i], y: data[i + 1] });
            }

            return points;
        } finally {
            best.delete();
        }
    } finally {
        contours.delete();
        hierarchy.delete();
    }
}

// True when the outline is basically the image frame (a full-size rectangle).
function outlineLooksLikeFrame(points, w, h) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let area = 0;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];

        if (a.x < minX) minX = a.x;
        if (a.x > maxX) maxX = a.x;
        if (a.y < minY) minY = a.y;
        if (a.y > maxY) maxY = a.y;

        area += a.x * b.y - b.x * a.y; // shoelace formula
    }

    area = Math.abs(area) / 2;

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;

    const spansWidth = bw >= w * 0.96;
    const spansHeight = bh >= h * 0.96;
    const fill = area / (bw * bh);

    return spansWidth && spansHeight && fill > 0.9;
}

// Circular moving average to remove pixel staircase noise.
function smoothPoints(points, radius) {
    const n = points.length;

    if (n < radius * 4) return points;

    const result = [];

    for (let i = 0; i < n; i++) {
        let sx = 0;
        let sy = 0;

        for (let k = -radius; k <= radius; k++) {
            const p = points[(i + k + n) % n];
            sx += p.x;
            sy += p.y;
        }

        const count = radius * 2 + 1;
        result.push({ x: sx / count, y: sy / count });
    }

    return result;
}

function processImage() {
    const raster = sourceRaster;
    const w = raster.width;
    const h = raster.height;

    // White-backed copy used for colour-based detection.
    const whiteCanvas = document.createElement("canvas");
    whiteCanvas.width = w;
    whiteCanvas.height = h;

    const whiteCtx = whiteCanvas.getContext("2d", {
        willReadFrequently: true
    });

    whiteCtx.fillStyle = "#ffffff";
    whiteCtx.fillRect(0, 0, w, h);
    whiteCtx.drawImage(raster, 0, 0);

    const rgba = cv.imread(whiteCanvas);

    // Try each method; reject any result that is just the image frame.
    const strategies = [
        { name: "transparency",      run: () => maskFromAlpha(raster) },
        { name: "grabcut-wide",      run: () => maskFromGrabCut(rgba, w, h, 0.05) },
        { name: "grabcut-tight",     run: () => maskFromGrabCut(rgba, w, h, 0.14) },
        { name: "background-colour", run: () => maskFromBackgroundColor(rgba, w, h) }
    ];

    try {
        let outline = null;

        for (const strategy of strategies) {
            let mask = null;

            try {
                mask = strategy.run();

                if (!maskIsUsable(mask)) {
                    console.log(strategy.name, "-> unusable mask");
                    continue;
                }

                cleanMask(mask);

                if (!maskIsUsable(mask)) {
                    console.log(strategy.name, "-> unusable after cleanup");
                    continue;
                }

                const points = extractOutline(mask, w, h);

                if (points.length < 10) {
                    console.log(strategy.name, "-> too few points");
                    continue;
                }

                if (outlineLooksLikeFrame(points, w, h)) {
                    console.log(strategy.name, "-> outline is the frame, skipped");
                    continue;
                }

                console.log("Subject found using:", strategy.name);
                outline = points;
                break;
            } catch (error) {
                console.warn(strategy.name, "failed:", error);
            } finally {
                if (mask) mask.delete();
            }
        }

        if (!outline) {
            throw new Error("Could not isolate a subject");
        }

        const smoothed = smoothPoints(outline, 3);

        // Centre the subject on its bounding box (y axis points up).
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        for (const p of smoothed) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
        }

        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        const points = smoothed.map(p => ({
            x: p.x - midX,
            y: midY - p.y
        }));

        const sampled = resampleContour(points, SAMPLE_COUNT);

        coefficients = calculateDFT(sampled);

        // Largest coefficients first.
        coefficients.sort(
            (a, b) => b.magnitude - a.magnitude
        );

        maxRadius = Math.max(
            1,
            ...sampled.map(p => Math.hypot(p.x, p.y))
        );

        currentTime = 0;
        generated = true;
        running = true;

        placeholder.style.display = "none";
        pngBtn.disabled = false;
        gifBtn.disabled = false;
        playBtn.disabled = false;
        playBtn.textContent = "Pause";

        setStatus(
            `${sampled.length} points · ${coefficients.length} coefficients`
        );

        drawFrame(0, true);
        startAnimation();
    } finally {
        rgba.delete();
    }
}

/* ---------- Fourier maths ---------- */

// Resample the closed contour at equal distances.
function resampleContour(points, count) {
    const cumulative = [0];
    let totalLength = 0;

    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];

        totalLength += Math.hypot(
            b.x - a.x,
            b.y - a.y
        );

        cumulative.push(totalLength);
    }

    if (totalLength === 0) {
        throw new Error("Contour length is zero");
    }

    const result = [];
    let edge = 0;

    for (let i = 0; i < count; i++) {
        const target = (i / count) * totalLength;

        while (
            edge < points.length - 1 &&
            cumulative[edge + 1] < target
        ) {
            edge++;
        }

        const a = points[edge];
        const b = points[(edge + 1) % points.length];

        const edgeLength =
            cumulative[edge + 1] - cumulative[edge];

        const t = edgeLength === 0
            ? 0
            : (target - cumulative[edge]) / edgeLength;

        result.push({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t
        });
    }

    return result;
}

// DFT of z[n] = x[n] + i*y[n].
function calculateDFT(points) {
    const N = points.length;
    const result = [];

    for (let k = 0; k < N; k++) {
        let re = 0;
        let im = 0;

        for (let n = 0; n < N; n++) {
            const angle = TAU * k * n / N;
            const x = points[n].x;
            const y = points[n].y;

            // Multiply (x + iy) by exp(-i * angle).
            re += x * Math.cos(angle) + y * Math.sin(angle);
            im += y * Math.cos(angle) - x * Math.sin(angle);
        }

        re /= N;
        im /= N;

        const frequency = k <= N / 2 ? k : k - N;

        result.push({
            re,
            im,
            frequency,
            magnitude: Math.hypot(re, im),
            phase: Math.atan2(im, re)
        });
    }

    return result;
}

// Evaluate the partial Fourier sum at time t.
function evaluate(t, terms) {
    let re = 0;
    let im = 0;

    for (const c of terms) {
        const angle = c.phase + TAU * c.frequency * t;

        re += c.magnitude * Math.cos(angle);
        im += c.magnitude * Math.sin(angle);
    }

    return { x: re, y: im };
}

function getTerms() {
    const count = Math.min(
        Number(circleCount.value),
        coefficients.length
    );

    return coefficients.slice(0, count);
}

/* ---------- Drawing & animation ---------- */

function drawFrame(t, showFullTrace = false) {
    if (!generated) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.clearRect(0, 0, w, h);

    const terms = getTerms();
    const scale = Math.min(w, h) * 0.43 / maxRadius;
    const cx = w / 2;
    const cy = h / 2;

    // Draw the reconstructed path first.
    ctx.beginPath();

    const traceSamples = 300;
    const end = showFullTrace ? 1 : t;
    const samples = showFullTrace
        ? traceSamples
        : Math.max(2, Math.ceil(t * traceSamples));

    for (let i = 0; i <= samples; i++) {
        const traceTime = end * i / samples;
        const p = evaluate(traceTime, terms);

        const x = cx + p.x * scale;
        const y = cy - p.y * scale;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.strokeStyle = "#55e6d0";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // Draw the chain of rotating vectors.
    let x = 0;
    let y = 0;

    for (const c of terms) {
        const angle = c.phase + TAU * c.frequency * t;
        const radius = c.magnitude;

        const nextX = x + radius * Math.cos(angle);
        const nextY = y + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.arc(
            cx + x * scale,
            cy - y * scale,
            radius * scale,
            0,
            TAU
        );

        ctx.strokeStyle = "rgba(124, 131, 255, 0.32)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + x * scale, cy - y * scale);
        ctx.lineTo(cx + nextX * scale, cy - nextY * scale);

        ctx.strokeStyle = "#9ca5ff";
        ctx.lineWidth = 1.1;
        ctx.stroke();

        x = nextX;
        y = nextY;
    }

    // Mark the moving endpoint.
    ctx.beginPath();
    ctx.arc(cx + x * scale, cy - y * scale, 3.5, 0, TAU);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    currentTime = t;
}

function animate(timestamp) {
    if (!running || !generated || exporting) return;

    if (previousFrame === 0) previousFrame = timestamp;

    const delta = timestamp - previousFrame;
    previousFrame = timestamp;

    // One complete drawing loop takes about five seconds.
    currentTime = (currentTime + delta / 5000) % 1;

    drawFrame(currentTime, false);

    animationId = requestAnimationFrame(animate);
}

function startAnimation() {
    stopAnimation();
    previousFrame = 0;

    if (running && generated && !exporting) {
        animationId = requestAnimationFrame(animate);
    }
}

function stopAnimation() {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

/* ---------- Export ---------- */

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;
    a.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Export a clean, complete outline as a PNG.
function downloadPNG() {
    if (!generated) return;

    const out = document.createElement("canvas");
    out.width = 1000;
    out.height = 1000;

    const outCtx = out.getContext("2d");
    const terms = getTerms();
    const scale = 1000 * 0.43 / maxRadius;

    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, 1000, 1000);

    outCtx.beginPath();

    const samples = 1200;

    for (let i = 0; i <= samples; i++) {
        const p = evaluate(i / samples, terms);
        const x = 500 + p.x * scale;
        const y = 500 - p.y * scale;

        if (i === 0) outCtx.moveTo(x, y);
        else outCtx.lineTo(x, y);
    }

    outCtx.closePath();
    outCtx.strokeStyle = "#111a2e";
    outCtx.lineWidth = 2;
    outCtx.lineJoin = "round";
    outCtx.stroke();

    out.toBlob(blob => {
        if (blob) downloadBlob(blob, "epicycle-outline.png");
        else alert("Could not create the PNG.");
    }, "image/png");
}

// Render and export one complete animation loop.
async function downloadGIF() {
    if (!generated || exporting) return;

    if (typeof GIF === "undefined") {
        alert("The GIF encoder has not loaded. Please refresh.");
        return;
    }

    exporting = true;
    const wasRunning = running;
    running = false;
    stopAnimation();

    gifBtn.disabled = true;
    pngBtn.disabled = true;
    generateBtn.disabled = true;
    playBtn.disabled = true;

    setStatus("Preparing GIF...");

    try {
        const gif = new GIF({
            workers: 2,
            quality: 10,
            width: canvas.width,
            height: canvas.height,
            workerScript:
                "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js"
        });

        const frames = 100;

        for (let i = 0; i < frames; i++) {
            const t = i / frames;

            drawFrame(t, false);

            gif.addFrame(canvas, {
                copy: true,
                delay: 50
            });

            setStatus(`Preparing GIF... ${i + 1}/${frames}`);

            // Allow the browser to update progress.
            if (i % 5 === 0) {
                await new Promise(resolve =>
                    setTimeout(resolve, 0)
                );
            }
        }

        gif.on("progress", progress => {
            setStatus(
                `Encoding GIF... ${Math.round(progress * 100)}%`
            );
        });

        gif.on("finished", blob => {
            downloadBlob(blob, "epicycle-animation.gif");

            exporting = false;
            running = wasRunning;

            gifBtn.disabled = false;
            pngBtn.disabled = false;
            playBtn.disabled = false;
            generateBtn.disabled = false;

            setStatus("GIF ready to download.");

            if (running) startAnimation();
            else drawFrame(currentTime, false);
        });

        gif.on("abort", () => {
            exporting = false;
            running = wasRunning;
            gifBtn.disabled = false;
            pngBtn.disabled = false;
            playBtn.disabled = false;
            updateGenerateButton();
            setStatus("GIF export cancelled.");
        });

        gif.render();
    } catch (error) {
        console.error(error);

        exporting = false;
        running = wasRunning;

        gifBtn.disabled = false;
        pngBtn.disabled = false;
        playBtn.disabled = false;
        updateGenerateButton();

        setStatus("GIF export failed.");
        alert("GIF export failed. Please try a smaller image.");
    }
}