// pwa-app-engine.js — Premium PWA App Engine v2.0

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

  // Activate PWA App Mode ONLY in standalone mode!
  if (!isStandalone()) {
    pwaApp.style.display = "none";
    return;
  }

  // Hide non-PWA body children
  Array.from(document.body.children).forEach((child) => {
    if (child !== pwaApp && child.tagName !== "SCRIPT" && child.tagName !== "STYLE") {
      child.style.display = "none";
    }
  });

  pwaApp.style.display = "flex";
  const appContent = pwaApp.querySelector(".app-content");
  if (appContent) appContent.style.display = "block";

  // App State
  let activeFile = null;
  let activeImage = null;
  let originalWidth = 0;
  let originalHeight = 0;
  let aspectRatio = 1;

  let optAspectLocked = true;
  let resizeAspectLocked = true;

  let optQuality = 0.82;
  let compressQuality = 0.82;
  let optFormat = "image/jpeg";
  let convertFormat = "image/jpeg";

  let processedBlob = null;
  let processedFilename = "image-optimized.jpg";

  // View Navigation System
  const views = ["viewHome", "viewWorkspace", "viewProcessing", "viewResult", "viewHistory", "viewSettings"];
  const navMap = { navHomeBtn: "viewHome", navHistoryBtn: "viewHistory", navSettingsBtn: "viewSettings" };

  function switchView(targetView) {
    views.forEach((vId) => {
      const el = document.getElementById(vId);
      if (el) el.classList.toggle("active", vId === targetView);
    });

    Object.keys(navMap).forEach((navId) => {
      const btn = document.getElementById(navId);
      if (btn) btn.classList.toggle("active", navMap[navId] === targetView);
    });
  }

  Object.keys(navMap).forEach((navId) => {
    const btn = document.getElementById(navId);
    if (btn) btn.addEventListener("click", () => switchView(navMap[navId]));
  });

  document.querySelectorAll(".appGoHomeBtn").forEach((btn) => {
    btn.addEventListener("click", () => switchView("viewHome"));
  });

  document.getElementById("appSettingsGearBtn")?.addEventListener("click", () => switchView("viewSettings"));

  // Workspace Panel Switching (Optimize | Resize | Compress | Convert)
  const panels = {
    tabPanelOpt: "panelOpt",
    tabPanelResize: "panelResize",
    tabPanelCompress: "panelCompress",
    tabPanelConvert: "panelConvert"
  };

  function switchWorkspacePanel(targetPanelId, activeTabId) {
    Object.values(panels).forEach((pId) => {
      const p = document.getElementById(pId);
      if (p) p.style.display = pId === targetPanelId ? "flex" : "none";
    });

    Object.keys(panels).forEach((tId) => {
      const tab = document.getElementById(tId);
      if (tab) tab.classList.toggle("active", tId === activeTabId);
    });
  }

  Object.keys(panels).forEach((tabId) => {
    document.getElementById(tabId)?.addEventListener("click", () => {
      switchWorkspacePanel(panels[tabId], tabId);
    });
  });

  // Home Upload Trigger & File Selection
  const pwaHomeUploadCard = document.getElementById("pwaHomeUploadCard");
  const pwaHomeFileInput = document.getElementById("pwaHomeFileInput");

  pwaHomeUploadCard?.addEventListener("click", () => pwaHomeFileInput?.click());
  document.getElementById("pwaWorkspaceChangeImgBtn")?.addEventListener("click", () => pwaHomeFileInput?.click());

  pwaHomeFileInput?.addEventListener("change", async () => {
    if (!pwaHomeFileInput.files?.length) return;
    await handleImageSelection(pwaHomeFileInput.files[0]);
  });

  // Quick Action Tool Chips on Home Screen
  document.getElementById("toolOptChip")?.addEventListener("click", () => {
    if (!activeFile) pwaHomeFileInput?.click();
    else { switchWorkspacePanel("panelOpt", "tabPanelOpt"); switchView("viewWorkspace"); }
  });

  document.getElementById("toolResizeChip")?.addEventListener("click", () => {
    if (!activeFile) pwaHomeFileInput?.click();
    else { switchWorkspacePanel("panelResize", "tabPanelResize"); switchView("viewWorkspace"); }
  });

  document.getElementById("toolCompressChip")?.addEventListener("click", () => {
    if (!activeFile) pwaHomeFileInput?.click();
    else { switchWorkspacePanel("panelCompress", "tabPanelCompress"); switchView("viewWorkspace"); }
  });

  document.getElementById("toolConvertChip")?.addEventListener("click", () => {
    if (!activeFile) pwaHomeFileInput?.click();
    else { switchWorkspacePanel("panelConvert", "tabPanelConvert"); switchView("viewWorkspace"); }
  });

  // Image Selection Handler
  async function handleImageSelection(file) {
    try {
      activeFile = file;
      activeImage = await loadImage(file);
      originalWidth = activeImage.naturalWidth;
      originalHeight = activeImage.naturalHeight;
      aspectRatio = originalWidth / originalHeight;

      // Update Workspace Image Card
      const thumbImg = document.getElementById("pwaWorkspaceThumb");
      if (thumbImg) thumbImg.src = URL.createObjectURL(file);
      document.getElementById("pwaWorkspaceFileName").textContent = file.name;
      document.getElementById("pwaWorkspaceFileSpecs").textContent = `${originalWidth} × ${originalHeight}px · ${formatBytes(file.size)}`;

      // Populate Inputs
      document.getElementById("optWidth").value = originalWidth;
      document.getElementById("optHeight").value = originalHeight;
      document.getElementById("resizeWidth").value = originalWidth;
      document.getElementById("resizeHeight").value = originalHeight;

      switchWorkspacePanel("panelOpt", "tabPanelOpt");
      switchView("viewWorkspace");
    } catch (err) {
      alert("Unable to load image: " + err.message);
    }
  }

  // Dimension & Aspect Ratio Lock Logic
  setupRatioLock("optWidth", "optHeight", "optLockBtn", () => optAspectLocked, (val) => optAspectLocked = val);
  setupRatioLock("resizeWidth", "resizeHeight", "resizeLockBtn", () => resizeAspectLocked, (val) => resizeAspectLocked = val);

  function setupRatioLock(wId, hId, lockBtnId, getLocked, setLocked) {
    const wInput = document.getElementById(wId);
    const hInput = document.getElementById(hId);
    const lockBtn = document.getElementById(lockBtnId);

    wInput?.addEventListener("input", () => {
      if (getLocked() && wInput.value && aspectRatio) {
        hInput.value = Math.max(1, Math.round(Number(wInput.value) / aspectRatio));
      }
    });

    hInput?.addEventListener("input", () => {
      if (getLocked() && hInput.value && aspectRatio) {
        wInput.value = Math.max(1, Math.round(Number(hInput.value) * aspectRatio));
      }
    });

    lockBtn?.addEventListener("click", () => {
      setLocked(!getLocked());
      lockBtn.classList.toggle("active", getLocked());
    });
  }

  // Resize Percentage Preset Scale Chips
  document.querySelectorAll(".resizeScaleBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const scale = Number(btn.dataset.scale);
      if (originalWidth && originalHeight) {
        document.getElementById("resizeWidth").value = Math.round(originalWidth * scale);
        document.getElementById("resizeHeight").value = Math.round(originalHeight * scale);
      }
    });
  });

  // Quality Segment Buttons
  setupSegmentGroup(".optQualityBtn", (val) => optQuality = Number(val));
  setupSegmentGroup(".compressQualityBtn", (val) => compressQuality = Number(val));
  setupSegmentGroup(".optFormatBtn", (val) => optFormat = val);

  function setupSegmentGroup(selector, onSelect) {
    document.querySelectorAll(selector).forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(selector).forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        onSelect(btn.dataset.q || btn.dataset.fmt);
      });
    });
  }

  // Convert Format Choice Cards
  document.querySelectorAll(".convertFmtChoice").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".convertFmtChoice").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      convertFormat = card.dataset.fmt;
    });
  });

  // Submissions
  document.getElementById("optSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    const w = Number(document.getElementById("optWidth").value) || originalWidth;
    const h = Number(document.getElementById("optHeight").value) || originalHeight;
    const targetVal = Number(document.getElementById("optTargetVal").value);
    const unit = document.getElementById("optTargetUnit").value;
    const targetBytes = targetVal ? (unit === "MB" ? targetVal * 1024 * 1024 : targetVal * 1024) : null;

    await executeProcessing(w, h, optQuality, optFormat, targetBytes, "optimized");
  });

  document.getElementById("resizeSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    const w = Number(document.getElementById("resizeWidth").value) || originalWidth;
    const h = Number(document.getElementById("resizeHeight").value) || originalHeight;

    await executeProcessing(w, h, 0.92, activeFile.type || "image/jpeg", null, "resized");
  });

  document.getElementById("compressSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    const targetVal = Number(document.getElementById("compressTargetVal").value);
    const unit = document.getElementById("compressTargetUnit").value;
    const targetBytes = targetVal ? (unit === "MB" ? targetVal * 1024 * 1024 : targetVal * 1024) : null;

    await executeProcessing(originalWidth, originalHeight, compressQuality, activeFile.type || "image/jpeg", targetBytes, "compressed");
  });

  document.getElementById("convertSubmitBtn")?.addEventListener("click", async () => {
    if (!activeImage || !activeFile) return;
    await executeProcessing(originalWidth, originalHeight, 0.92, convertFormat, null, "converted");
  });

  // Canvas Image Processing Engine
  async function executeProcessing(targetW, targetH, quality, type, targetBytes, actionLabel) {
    switchView("viewProcessing");

    await new Promise((r) => setTimeout(r, 100)); // Smooth UI transition

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    if (type === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(activeImage, 0, 0, targetW, targetH);

    let blob = null;
    if (targetBytes && type !== "image/png") {
      blob = await compressToTargetSize(canvas, type, targetBytes);
    } else {
      blob = await canvasToBlob(canvas, type, quality);
    }

    displayResults(blob, activeFile, `${targetW} × ${targetH}px`, actionLabel, type);
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
  }

  async function compressToTargetSize(canvas, type, targetBytes) {
    let minQ = 0.05;
    let maxQ = 0.98;
    let bestBlob = null;
    for (let i = 0; i < 7; i++) {
      const midQ = (minQ + maxQ) / 2;
      const blob = await canvasToBlob(canvas, type, midQ);
      if (!blob) break;
      bestBlob = blob;
      if (blob.size > targetBytes) maxQ = midQ;
      else {
        minQ = midQ;
        if (targetBytes - blob.size < 2048) break;
      }
    }
    return bestBlob;
  }

  function displayResults(blob, origFile, newSpecs, actionLabel, outFormat) {
    processedBlob = blob;
    const ext = outFormat === "image/png" ? "png" : outFormat === "image/webp" ? "webp" : "jpg";
    const baseName = origFile.name.replace(/\.[^/.]+$/, "");
    processedFilename = `${baseName}-${actionLabel}.${ext}`;

    const origBytes = origFile.size;
    const outBytes = blob.size;
    const savedPct = origBytes > outBytes ? Math.round(((origBytes - outBytes) / origBytes) * 100) : 0;

    document.getElementById("appResultBadge").textContent = savedPct > 0 ? `Saved ${savedPct}%` : "Processed";
    document.getElementById("appResultOriginalSpecs").textContent = `${formatBytes(origBytes)}`;
    document.getElementById("appResultNewSpecs").textContent = `${formatBytes(outBytes)} (${newSpecs})`;

    saveHistoryRecord(origFile.name, actionLabel, formatBytes(outBytes));
    switchView("viewResult");
  }

  // Download Action & Toast Confirmation
  document.getElementById("appDownloadMainBtn")?.addEventListener("click", () => {
    if (!processedBlob) return;
    const url = URL.createObjectURL(processedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = processedFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    showToast("✓ Saved to your device");
  });

  document.getElementById("appShareBtn")?.addEventListener("click", async () => {
    if (!processedBlob || !navigator.share) {
      alert("Web Share API is not supported on this browser.");
      return;
    }
    try {
      const file = new File([processedBlob], processedFilename, { type: processedBlob.type });
      await navigator.share({ files: [file], title: "Processed Image" });
    } catch {}
  });

  function showToast(msg) {
    const toast = document.getElementById("appToast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 2500);
  }

  // History System
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem("pwa_app_history_v2") || "[]");
    } catch { return []; }
  }

  function saveHistoryRecord(filename, action, weight) {
    const list = getHistory();
    list.unshift({
      name: filename,
      action: action,
      weight: weight,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    });
    if (list.length > 20) list.pop();
    try { localStorage.setItem("pwa_app_history_v2", JSON.stringify(list)); } catch {}
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    const recentEl = document.getElementById("appRecentList");
    const historyEl = document.getElementById("appHistoryList");

    const html = list.length
      ? list.map((item) => `
        <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:14px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="font-size:0.86rem; color:#fff; display:block;">${item.name}</strong>
            <span style="font-size:0.75rem; color:#94a3b8;">${item.action} · ${item.weight}</span>
          </div>
          <span style="font-size:0.75rem; color:#64748b;">${item.time}</span>
        </div>
      `).join("")
      : `<div style="text-align: center; padding: 24px; color: #64748b; font-size: 0.84rem; background: rgba(255,255,255,0.02); border-radius: 16px;">No processed images yet</div>`;

    if (recentEl) recentEl.innerHTML = html;
    if (historyEl) historyEl.innerHTML = html;
  }

  function clearHistory() {
    try { localStorage.removeItem("pwa_app_history_v2"); } catch {}
    renderHistory();
  }

  document.getElementById("appClearRecentBtn")?.addEventListener("click", clearHistory);
  document.getElementById("appClearHistoryBtn")?.addEventListener("click", clearHistory);

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
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
      img.src = url;
    });
  }

  renderHistory();
  switchView("viewHome");
})();
