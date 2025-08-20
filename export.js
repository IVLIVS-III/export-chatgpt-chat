(() => {
  async function exportSubtreeAsHTML(rootEl, opts = {}) {
    if (!rootEl || rootEl.nodeType !== 1) {
      throw new Error("Please pass a valid Element (e.g., document.querySelector(...)).");
    }
    const {
      inlineImages = false
    } = opts;

    const clonedRoot = rootEl.cloneNode(true);

    let uidCounter = 0;
    const uidToOriginal = new Map();
    const walkPair = (orig, clone) => {
      const uid = `x${++uidCounter}`;
      clone.setAttribute("data-uid", uid);
      uidToOriginal.set(uid, orig);
      const origKids = Array.from(orig.children);
      const cloneKids = Array.from(clone.children);
      for (let i = 0; i < cloneKids.length; i++) {
        walkPair(origKids[i], cloneKids[i]);
      }
    };
    walkPair(rootEl, clonedRoot);

	// remove scroll down button
	const maybeSrollButtonContainer = Array.from(clonedRoot.children).at(-1);
	if (maybeSrollButtonContainer.getElementsByTagName("svg")) {
		maybeSrollButtonContainer.remove();
	}

    const styleChunks = [];
    const makeRulesFor = (uid, el) => {
      const rules = [];
      const makeBlock = (selector, getCS) => {
        const cs = getCS();
        if (!cs) return;
        const lines = [];
        for (let i = 0; i < cs.length; i++) {
          const prop = cs[i];
		  if (prop.startsWith("margin-inline")) continue;
		  if (prop.startsWith("margin-left")) continue;
		  if (prop.startsWith("margin-right")) continue;
          const val = cs.getPropertyValue(prop);
          if (val != null && val !== "") {
            lines.push(`${prop}: ${val};`);
          }
        }
        if (lines.length) {
          rules.push(`${selector} { ${lines.join(" ")} }`);
        }
      };
      makeBlock(`[data-uid="${uid}"]`, () => getComputedStyle(el));
      makeBlock(`[data-uid="${uid}"]::before`, () => getComputedStyle(el, "::before"));
      makeBlock(`[data-uid="${uid}"]::after`, () => getComputedStyle(el, "::after"));
      return rules.join("\n");
    };

    const CHUNK_TARGET = 200;
    let bucket = [];
    let count = 0;
    for (const [uid, origEl] of uidToOriginal.entries()) {
      bucket.push(makeRulesFor(uid, origEl));
      count++;
      if (count >= CHUNK_TARGET) {
        styleChunks.push(bucket.join("\n"));
        bucket = [];
        count = 0;
      }
    }
    if (bucket.length) styleChunks.push(bucket.join("\n"));

    if (inlineImages) {
      const inlineOne = async img => {
        try {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:")) return;
          const absolute = new URL(src, document.baseURI).href;
          const resp = await fetch(absolute, { mode: "cors" });
          if (!resp.ok) return;
          const blob = await resp.blob();
          const dataURL = await new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = reject;
            fr.readAsDataURL(blob);
          });
          img.setAttribute("src", dataURL);
        } catch {}
      };
      const clonedImgs = clonedRoot.querySelectorAll("img[src]");
      for (const img of clonedImgs) {
        // eslint-disable-next-line no-await-in-loop
        await inlineOne(img);
      }
    }

    const docTitle = (document.title || "Export");
    const stylesHTML = styleChunks.map(css => `<style>${css}</style>`).join("\n");

    const container = document.createElement("div");
    container.appendChild(clonedRoot);
    const subtreeHTML = container.innerHTML;

	const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
	const darkModeCss = `<style> body { background-color: #212121e6; } </style>`;

    const fullHTML =
`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(docTitle)} — Chat Export</title>
${isDark ? darkModeCss : ""}
${stylesHTML}
</head>
<body>
${subtreeHTML}
</body>
</html>`;

    // 6) OPEN IN NEW TAB + AUTO-PRINT (no download)
    openInNewTab(fullHTML);

    function escapeHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function openInNewTab(html) {
  // Create a Blob URL for the complete HTML document
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  // Try to open directly (must be in a user gesture to avoid popup blockers)
  let win = null;
  try {
    win = window.open(url, "_blank"); // don't use "noopener" if you need to access window
  } catch {}

  if (win) {
    // If we have a handle, hook the load event so we can print automatically
    try {
      win.addEventListener("load", async function onLoad() {
        win.removeEventListener("load", onLoad);
        try { win.focus(); } catch {}
        // Wait for fonts if available for better fidelity
        try {
          if (win.document && win.document.fonts && win.document.fonts.ready) {
            await win.document.fonts.ready;
          }
        } catch {}
        try { win.print(); } catch {}
      });
    } catch {
      // If addEventListener on window fails, use polling fallback
      let tries = 0;
      const poll = setInterval(() => {
        if (!win || win.closed) {
          clearInterval(poll);
          return;
        }
        try {
          if (win.document && win.document.readyState === "complete") {
            clearInterval(poll);
            try { win.focus(); } catch {}
            try { win.print(); } catch {}
          }
        } catch {}
        if (++tries > 150) clearInterval(poll); // timeout after ~15s
      }, 100);
    }
  } else {
    // Fallback: simulated link click (less likely to be blocked)
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // In this fallback, we can't auto-print reliably due to lack of window handle
  }

  // Revoke after a short delay so the new tab has time to load the blob
  setTimeout(() => {
    try { URL.revokeObjectURL(url); } catch {}
  }, 60000); // 60s is safe
}

  }

  	function fetchChatElement() {
		return document.querySelector("#page-header").nextElementSibling.getElementsByTagName("article")[0].parentElement;
	}

  	const chat = fetchChatElement();

	if (chat !== undefined) {
		exportSubtreeAsHTML(chat);
	} 
})();
