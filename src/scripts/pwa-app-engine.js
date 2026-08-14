// pwa-app-engine.js — Standalone PWA Mobile App Engine & Canvas Controller

(function () {
  const pwaApp = document.getElementById("pwaAppInterface");
  if (!pwaApp) return;

  function isStandalone() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator && window.navigator.standalone === true)
    );
  }

  // Activate PWA App Mode ONLY when running in standalone mode!
  if (!isStandalone()) {
    pwaApp.style.display = "none";
    return;
  }

  // Standalone Mode Active — Hide website interface, unhide PWA App UI
  const siteHeader = document.querySelector(".site-header");
  const mainContent = document.querySelector("main");
  const siteFooter = document.querySelector(".site-footer");

  if (siteHeader) siteHeader.style.display = "none";
  if (mainContent && mainContent.id !== "pwaAppInterface") mainContent.style.display = "none";
  if (siteFooter) siteFooter.style.display = "none";

  // Also wrap any top-level body children except #pwaAppInterface
  Array.from(document.body.children).forEach((child) => {
    if (child !== pwaApp && child.tagName !== "SCRIPT" && child.tagName !== "STYLE") {
      child.style.display = "none";
    }
  });

  pwaApp.style.display = "flex";

  // State
  let currentView = "viewHome";
  let activeFile = null;
  let activeImage = null;
  let originalWidth = 0;
  let originalHeight = 0;
  let aspectRatio = 1;
  let aspectLocked = true;
  let processedBlob = null;
  let processedFilename = "image-optimized.jpg";
  let selectedFormat = "image/jpeg";
  let selectedOptFormat = "image/jpeg";

  // Views & Tabs Navigation
  const views = ["viewHome", "viewResize", "viewCompress", "viewConvert", "viewOptimize", "viewProcessing", "viewResult", "viewHistory", "viewSettings"];
  const navTabs = {
    tabHomeBtn: "viewHome",
    tabHistoryBtn: "viewHistory",
    tabSettingsBtn: "viewSettings"
  };

  function switchView(targetView) {
    views.forEach((vId) => {
      const el = document.getElementById(vId);
      if (el) el.classList.toggle("active", vId === targetView);
    });
    currentView = targetView;

    // Update bottom nav active state
    Object.keys(navTabs).forEach((tabId) => {
      const btn = document.getElementById(tabId);
      if (btn) btn.classList.toggle("active", navTabs[tabId] === targetView);
    });
  }

  Object.keys(navTabs).forEach((tabId) => {
    const btn = document.getElementById(tabId);
    if (btn) btn.addEventListener("click", () => switchView(navTabs[tabId]));
  });

  document.querySelectorAll(".appGoHomeBtn").forEach((btn) => {
    btn.addEventListener("click", () => switchView("viewHome"));
  });

  document.getElementById("appSettingsGearBtn")?.addEventListener("click", () => switchView("viewSettings"));

  // Dashboard Triggers
  document.getElementById("cardResizeTrigger")?.addEventListener("click", () => switchView("viewResize"));
  document.getElementById("cardCompressTrigger")?.addEventListener("click", () => switchView("viewCompress"));
  document.getElementById("cardConvertTrigger")?.addEventListener("click", () => switchView("viewConvert"));
  document.getElementById("cardOptimizeTrigger")?.addEventListener("click", () => switchView("viewOptimize"));

  // Helper Utilities
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
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

  // --- WORKFLOW 1: RESIZE ---
  const pwaResizeUploadBox = document.getElementById("pwaResizeUploadBox");
  const pwaResizeFileInput = document.getElementById("pwaResizeFileInput");
  const pwaResizePreviewArea = document.getElementById("pwaResizePreviewArea");
  const pwaResizeWidth = document.getElementById("pwaResizeWidth");
  const pwaResizeHeight = document.getElementById("pwaResizeHeight");
  const pwaResizeLockBtn = document.getElementById("pwaResizeLockBtn");

  pwaResizeUploadBox?.addEventListener("click", () => pwaResizeFileInput?.click());
  document.getElementById("pwaResizeChangeFileBtn")?.addEventListener("click", () => pwaResizeFileInput?.click());

  pwaResizeFileInput?.addEventListener("change", async () => {
    if (!pwaResizeFileInput.files?.length) return;
    activeFile = pwaResizeFileInput.files[0];
    activeImage = await loadImage(activeFile);
    originalWidth = activeImage.naturalWidth;
    originalHeight = activeImage.naturalHeight;
    aspectRatio = originalWidth / originalHeight;

    document.getElementById("pwaResizeFileName").textContent = activeFile.name;
    document.getElementById("pwaResizeFileMeta").textContent = `Original: ${originalWidth} × ${originalHeight}px · ${formatBytes(activeFile.size)}`;
    pwaResizeWidth.value = originalWidth;
    pwaResizeHeight.value = originalHeight;

    pwaResizeUploadBox.style.display = "none";
    pwaResizePreviewArea.style.display = "flex";
  });

  pwaResizeWidth?.addEventListener("input", () => {
    if (aspectLocked && pwaResizeWidth.value && aspectRatio) {
      pwaResizeHeight.value = Math.max(1, Math.round(Number(pwaResizeWidth.value) / aspectRatio));
    }
  });

  pwaResizeHeight?.addEventListener("input", () => {
    if (aspectLocked && pwaResizeHeight.value && aspectRatio) {
      pwaResizeWidth.value = Math.max(1, Math.round(Number(pwaResizeHeight.value) * aspectRatio));
    }
  });

  pwaResizeLockBtn?.addEventListener("click", () => {
    aspectLocked = !aspectLocked;
    pwaResizeLockBtn.classList.toggle("active", aspectLocked);
  });

  document.querySelectorAll(".app-preset-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const w = Number(btn.dataset.width);
      const h = Number(btn.dataset.height);
      pwaResizeWidth.value = w;
      pwaResizeHeight.value = h;
    });
  });

  document.getElementById("pwaResizeSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    const targetW = Number(pwaResizeWidth.value) || originalWidth;
    const targetH = Number(pwaResizeHeight.value) || originalHeight;

    switchView("viewProcessing");
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (activeFile.type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(activeImage, 0, 0, targetW, targetH);

    const blob = await canvasToBlob(canvas, activeFile.type || "image/jpeg", 0.92);
    displayResult(blob, activeFile, `${targetW} × ${targetH}px`, "resized");
  });

  // --- WORKFLOW 2: COMPRESS ---
  const pwaCompressUploadBox = document.getElementById("pwaCompressUploadBox");
  const pwaCompressFileInput = document.getElementById("pwaCompressFileInput");
  const pwaCompressPreviewArea = document.getElementById("pwaCompressPreviewArea");

  pwaCompressUploadBox?.addEventListener("click", () => pwaCompressFileInput?.click());
  document.getElementById("pwaCompressChangeFileBtn")?.addEventListener("click", () => pwaCompressFileInput?.click());

  pwaCompressFileInput?.addEventListener("change", async () => {
    if (!pwaCompressFileInput.files?.length) return;
    activeFile = pwaCompressFileInput.files[0];
    activeImage = await loadImage(activeFile);
    document.getElementById("pwaCompressFileName").textContent = activeFile.name;
    document.getElementById("pwaCompressFileMeta").textContent = `Original Size: ${formatBytes(activeFile.size)}`;
    pwaCompressUploadBox.style.display = "none";
    pwaCompressPreviewArea.style.display = "flex";
  });

  document.getElementById("pwaCompressSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    const targetVal = Number(document.getElementById("pwaCompressTargetSize").value);
    const unit = document.getElementById("pwaCompressTargetUnit").value;
    let targetBytes = null;
    if (targetVal && targetVal > 0) {
      targetBytes = unit === "MB" ? targetVal * 1024 * 1024 : targetVal * 1024;
    }

    switchView("viewProcessing");
    const canvas = document.createElement("canvas");
    canvas.width = activeImage.naturalWidth;
    canvas.height = activeImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(activeImage, 0, 0);

    const { blob } = await compressToTargetSize(canvas, activeFile.type || "image/jpeg", targetBytes);
    displayResult(blob, activeFile, `${activeImage.naturalWidth} × ${activeImage.naturalHeight}px`, "compressed");
  });

  // --- WORKFLOW 3: CONVERT ---
  const pwaConvertUploadBox = document.getElementById("pwaConvertUploadBox");
  const pwaConvertFileInput = document.getElementById("pwaConvertFileInput");
  const pwaConvertPreviewArea = document.getElementById("pwaConvertPreviewArea");

  pwaConvertUploadBox?.addEventListener("click", () => pwaConvertFileInput?.click());
  document.getElementById("pwaConvertChangeFileBtn")?.addEventListener("click", () => pwaConvertFileInput?.click());

  pwaConvertFileInput?.addEventListener("change", async () => {
    if (!pwaConvertFileInput.files?.length) return;
    activeFile = pwaConvertFileInput.files[0];
    activeImage = await loadImage(activeFile);
    document.getElementById("pwaConvertFileName").textContent = activeFile.name;
    document.getElementById("pwaConvertFileMeta").textContent = `Format: ${activeFile.type || "Image"} · ${formatBytes(activeFile.size)}`;
    pwaConvertUploadBox.style.display = "none";
    pwaConvertPreviewArea.style.display = "flex";
  });

  document.querySelectorAll(".pwaFormatOption").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pwaFormatOption").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedFormat = btn.dataset.format;
    });
  });

  document.getElementById("pwaConvertSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    switchView("viewProcessing");
    const canvas = document.createElement("canvas");
    canvas.width = activeImage.naturalWidth;
    canvas.height = activeImage.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (selectedFormat === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(activeImage, 0, 0);
    const blob = await canvasToBlob(canvas, selectedFormat, 0.92);
    displayResult(blob, activeFile, `${activeImage.naturalWidth} × ${activeImage.naturalHeight}px`, "converted", selectedFormat);
  });

  // --- WORKFLOW 4: QUICK OPTIMIZE ---
  const pwaOptimizeUploadBox = document.getElementById("pwaOptimizeUploadBox");
  const pwaOptimizeFileInput = document.getElementById("pwaOptimizeFileInput");
  const pwaOptimizePreviewArea = document.getElementById("pwaOptimizePreviewArea");

  pwaOptimizeUploadBox?.addEventListener("click", () => pwaOptimizeFileInput?.click());
  document.getElementById("pwaOptimizeChangeFileBtn")?.addEventListener("click", () => pwaOptimizeFileInput?.click());

  pwaOptimizeFileInput?.addEventListener("change", async () => {
    if (!pwaOptimizeFileInput.files?.length) return;
    activeFile = pwaOptimizeFileInput.files[0];
    activeImage = await loadImage(activeFile);
    originalWidth = activeImage.naturalWidth;
    originalHeight = activeImage.naturalHeight;
    aspectRatio = originalWidth / originalHeight;

    document.getElementById("pwaOptimizeFileName").textContent = activeFile.name;
    document.getElementById("pwaOptimizeFileMeta").textContent = `Original: ${originalWidth} × ${originalHeight}px · ${formatBytes(activeFile.size)}`;
    document.getElementById("pwaOptimizeWidth").value = originalWidth;
    document.getElementById("pwaOptimizeHeight").value = originalHeight;

    pwaOptimizeUploadBox.style.display = "none";
    pwaOptimizePreviewArea.style.display = "flex";
  });

  document.querySelectorAll(".pwaOptFormatOption").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".pwaOptFormatOption").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedOptFormat = btn.dataset.format;
    });
  });

  document.getElementById("pwaOptimizeSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    const targetW = Number(document.getElementById("pwaOptimizeWidth").value) || originalWidth;
    const targetH = Number(document.getElementById("pwaOptimizeHeight").value) || originalHeight;
    const targetVal = Number(document.getElementById("pwaOptimizeTargetSize").value);
    const unit = document.getElementById("pwaOptimizeTargetUnit").value;
    let targetBytes = null;
    if (targetVal && targetVal > 0) {
      targetBytes = unit === "MB" ? targetVal * 1024 * 1024 : targetVal * 1024;
    }

    switchView("viewProcessing");
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (selectedOptFormat === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(activeImage, 0, 0, targetW, targetH);

    const { blob } = await compressToTargetSize(canvas, selectedOptFormat, targetBytes);
    displayResult(blob, activeFile, `${targetW} × ${targetH}px`, "optimized", selectedOptFormat);
  });

  // --- RESULT DISPLAY & DOWNLOAD ---
  function displayResult(blob, originalFile, newSpecs, actionName, formatMime) {
    processedBlob = blob;
    const ext = formatMime ? (formatMime === "image/png" ? "png" : formatMime === "image/webp" ? "webp" : "jpg") : (originalFile.name.split(".").pop() || "jpg");
    const nameWithoutExt = originalFile.name.replace(/\.[^/.]+$/, "");
    processedFilename = `${nameWithoutExt}-${actionName}.${ext}`;

    const origBytes = originalFile.size;
    const outBytes = blob.size;
    const savedPct = origBytes > outBytes ? Math.round(((origBytes - outBytes) / origBytes) * 100) : 0;

    document.getElementById("pwaResultSavedBadge").textContent = savedPct > 0 ? `Saved ${savedPct}%` : "Processed";
    document.getElementById("pwaResultOriginalMeta").textContent = `${formatBytes(origBytes)}`;
    document.getElementById("pwaResultOutputMeta").textContent = `${formatBytes(outBytes)} (${newSpecs})`;

    saveHistoryRecord(originalFile.name, actionName, formatBytes(outBytes));
    switchView("viewResult");
  }

  document.getElementById("pwaDownloadBtn")?.addEventListener("click", () => {
    if (!processedBlob) return;
    const url = URL.createObjectURL(processedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = processedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  document.getElementById("pwaShareBtn")?.addEventListener("click", async () => {
    if (!processedBlob || !navigator.share) {
      alert("Sharing is not supported on this browser.");
      return;
    }
    try {
      const file = new File([processedBlob], processedFilename, { type: processedBlob.type });
      await navigator.share({ files: [file], title: "Processed Image" });
    } catch (e) {
      console.log("Share error/cancelled:", e);
    }
  });

  // --- LOCAL HISTORY SYSTEM ---
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem("pwa_app_history") || "[]");
    } catch {
      return [];
    }
  }

  function saveHistoryRecord(filename, action, outputWeight) {
    const list = getHistory();
    list.unshift({
      name: filename,
      action: action,
      weight: outputWeight,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    if (list.length > 20) list.pop();
    try {
      localStorage.setItem("pwa_app_history", JSON.stringify(list));
    } catch {}
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    const recentContainer = document.getElementById("appRecentList");
    const historyContainer = document.getElementById("pwaHistoryContainer");

    const html = list.length
      ? list.map((item) => `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="font-size:0.88rem; color:#fff; display:block;">${item.name}</strong>
            <span style="font-size:0.75rem; color:#94a3b8;">${item.action} · ${item.weight}</span>
          </div>
          <span style="font-size:0.75rem; color:#64748b;">${item.time}</span>
        </div>
      `).join("")
      : `<div style="text-align: center; padding: 20px; color: #64748b; font-size: 0.85rem;">No recent activity</div>`;

    if (recentContainer) recentContainer.innerHTML = html;
    if (historyContainer) historyContainer.innerHTML = html;
  }

  function clearHistory() {
    try {
      localStorage.removeItem("pwa_app_history");
    } catch {}
    renderHistory();
  }

  document.getElementById("appClearRecentBtn")?.addEventListener("click", clearHistory);
  document.getElementById("pwaClearHistoryViewBtn")?.addEventListener("click", clearHistory);

  renderHistory();
})();
