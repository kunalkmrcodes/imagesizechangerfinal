// resizer.js — Client-Side Canvas Engine for ImageSizeChanger

(function () {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const browseButton = document.getElementById("browseButton");
  const fileList = document.getElementById("fileList");
  const controls = document.getElementById("controls");
  const widthInput = document.getElementById("widthInput");
  const heightInput = document.getElementById("heightInput");
  const widthUnit = document.getElementById("widthUnit");
  const heightUnit = document.getElementById("heightUnit");
  const lockButton = document.getElementById("lockButton");
  const unitButtons = document.querySelectorAll(".unit-button");
  const presetButtons = document.querySelectorAll(".preset");
  const formatButtons = document.querySelectorAll(".format-button");
  const resizeButton = document.getElementById("resizeButton");
  const targetSizeInput = document.getElementById("targetSizeInput");
  const targetSizeUnit = document.getElementById("targetSizeUnit");
  const selectedCount = document.getElementById("selectedCount");
  const originalSize = document.getElementById("originalSize");
  const progressArea = document.getElementById("progressArea");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");

  if (!dropZone || !fileInput || !browseButton || !resizeButton) return;

  let selectedFiles = [];
  let aspectLocked = true;
  let currentUnit = "pixels";
  let currentFormat = "image/jpeg";
  let currentImageWidth = 0;
  let currentImageHeight = 0;
  let aspectRatio = 1;

  function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function getTargetBytes() {
    const value = parseFloat(targetSizeInput.value);
    if (!value || isNaN(value) || value <= 0) return null;
    const unit = targetSizeUnit.value;
    return unit === "MB" ? Math.round(value * 1024 * 1024) : Math.round(value * 1024);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Unable to load image."));
      };
      img.src = url;
    });
  }

  function updateSelectedCount() {
    const count = selectedFiles.length;
    selectedCount.textContent = `${count} image${count === 1 ? "" : "s"} selected`;
    controls.hidden = count === 0;
  }

  function renderFiles() {
    fileList.innerHTML = "";
    if (!selectedFiles.length) {
      fileList.hidden = true;
      updateSelectedCount();
      return;
    }

    fileList.hidden = false;
    selectedFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "file-item";

      const info = document.createElement("div");
      info.className = "file-info";

      const name = document.createElement("span");
      name.className = "file-name";
      name.textContent = file.name;

      const meta = document.createElement("span");
      meta.className = "file-meta";
      meta.textContent = `${formatBytes(file.size)} · ${file.type || "Image"}`;

      info.appendChild(name);
      info.appendChild(meta);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-file";
      removeBtn.dataset.index = String(index);
      removeBtn.innerHTML = "×";
      removeBtn.ariaLabel = `Remove ${file.name}`;

      item.appendChild(info);
      item.appendChild(removeBtn);
      fileList.appendChild(item);
    });

    updateSelectedCount();
  }

  async function handleFiles(files) {
    const images = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!images.length) {
      alert("Please select a valid image file.");
      return;
    }

    selectedFiles = images;
    renderFiles();

    try {
      const image = await loadImage(selectedFiles[0]);
      currentImageWidth = image.naturalWidth;
      currentImageHeight = image.naturalHeight;
      aspectRatio = currentImageWidth / currentImageHeight;

      widthInput.value = currentImageWidth;
      heightInput.value = currentImageHeight;
      originalSize.textContent = `Original: ${currentImageWidth} × ${currentImageHeight}px · ${formatBytes(selectedFiles[0].size)}`;
    } catch {
      originalSize.textContent = "Could not read image dimensions.";
    }
  }

  function updateHeightFromWidth() {
    const width = Number(widthInput.value);
    if (width && aspectRatio) {
      heightInput.value = Math.max(1, Math.round(width / aspectRatio));
    }
  }

  function updateWidthFromHeight() {
    const height = Number(heightInput.value);
    if (height && aspectRatio) {
      widthInput.value = Math.max(1, Math.round(height * aspectRatio));
    }
  }

  browseButton.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    fileInput.click();
  });

  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) handleFiles(fileInput.files);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragging");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer?.files;
    if (files?.length) handleFiles(files);
  });

  fileList.addEventListener("click", (e) => {
    const button = e.target.closest(".remove-file");
    if (!button) return;
    selectedFiles.splice(Number(button.dataset.index), 1);
    renderFiles();
    if (!selectedFiles.length) {
      fileInput.value = "";
      originalSize.textContent = "Original size will appear here.";
    }
  });

  widthInput.addEventListener("input", () => {
    if (aspectLocked && currentUnit === "pixels") updateHeightFromWidth();
  });

  heightInput.addEventListener("input", () => {
    if (aspectLocked && currentUnit === "pixels") updateWidthFromHeight();
  });

  lockButton.addEventListener("click", () => {
    aspectLocked = !aspectLocked;
    lockButton.classList.toggle("active", aspectLocked);
    lockButton.setAttribute("aria-pressed", String(aspectLocked));
    if (aspectLocked) {
      const width = Number(widthInput.value);
      const height = Number(heightInput.value);
      if (width && height) aspectRatio = width / height;
    }
  });

  unitButtons.forEach((button) => {
    button.addEventListener("click", () => {
      unitButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      currentUnit = button.dataset.unit;
      widthUnit.textContent = currentUnit === "pixels" ? "px" : "%";
      heightUnit.textContent = currentUnit === "pixels" ? "px" : "%";

      if (currentUnit === "percent") {
        widthInput.value = 100;
        heightInput.value = 100;
      } else if (currentImageWidth && currentImageHeight) {
        widthInput.value = currentImageWidth;
        heightInput.value = currentImageHeight;
      }
    });
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const width = Number(button.dataset.width);
      const height = Number(button.dataset.height);
      currentUnit = "pixels";
      unitButtons.forEach((item) => item.classList.toggle("active", item.dataset.unit === "pixels"));
      widthUnit.textContent = "px";
      heightUnit.textContent = "px";
      widthInput.value = width;
      heightInput.value = height;
      if (aspectLocked) aspectRatio = width / height;
    });
  });

  formatButtons.forEach((button) => {
    button.addEventListener("click", () => {
      formatButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      currentFormat = button.dataset.format;
    });
  });

  function getExtension(mime) {
    if (mime === "image/png") return "png";
    if (mime === "image/webp") return "webp";
    return "jpg";
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    });
  }

  async function compressToTargetSize(canvas, type, targetBytes) {
    if (!targetBytes || type === "image/png") {
      const blob = await canvasToBlob(canvas, type, 0.92);
      return { blob, quality: 0.92 };
    }

    let minQ = 0.05;
    let maxQ = 0.98;
    let bestBlob = null;
    let bestQ = 0.92;

    for (let i = 0; i < 7; i++) {
      const midQ = (minQ + maxQ) / 2;
      const blob = await canvasToBlob(canvas, type, midQ);

      if (!blob) break;

      bestBlob = blob;
      bestQ = midQ;

      if (blob.size > targetBytes) {
        maxQ = midQ;
      } else {
        minQ = midQ;
        if (targetBytes - blob.size < 2048) break;
      }
    }

    return { blob: bestBlob, quality: bestQ };
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  resizeButton.addEventListener("click", async () => {
    if (!selectedFiles.length) {
      alert("Please select at least one image.");
      return;
    }

    resizeButton.disabled = true;
    progressArea.hidden = false;
    progressBar.style.width = "0%";
    const targetBytes = getTargetBytes();

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        progressText.textContent = `Processing ${i + 1} of ${selectedFiles.length}…`;

        const image = await loadImage(file);
        let outputWidth = Number(widthInput.value);
        let outputHeight = Number(heightInput.value);

        if (currentUnit === "percent") {
          outputWidth = Math.round((image.naturalWidth * outputWidth) / 100);
          outputHeight = Math.round((image.naturalHeight * outputHeight) / 100);
        }

        if (outputWidth < 1 || outputHeight < 1 || !Number.isFinite(outputWidth) || !Number.isFinite(outputHeight)) {
          throw new Error("Please enter valid dimensions.");
        }

        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported.");

        if (currentFormat === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, outputWidth, outputHeight);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(image, 0, 0, outputWidth, outputHeight);

        const { blob } = await compressToTargetSize(canvas, currentFormat, targetBytes);
        if (!blob) throw new Error("Unable to compress image.");

        const ext = getExtension(currentFormat);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const newFilename = `${nameWithoutExt}-resized.${ext}`;

        downloadBlob(blob, newFilename);
        progressBar.style.width = `${Math.round(((i + 1) / selectedFiles.length) * 100)}%`;
      }

      progressText.textContent = "Done! Downloading...";
    } catch (error) {
      console.error(error);
      progressText.textContent = "Something went wrong.";
      alert(error instanceof Error ? error.message : "Unable to process the image.");
    } finally {
      resizeButton.disabled = false;
    }
  });
})();
