/* Browser-native runtime. No deck-specific selectors or dependencies. */
(() => {
  "use strict";
  const deck = document.querySelector(".presentation");
  if (!deck) return;
  const stage = deck.querySelector("#stage");
  const stageWrap = deck.querySelector(".stage-wrap");
  const slides = [...stage.querySelectorAll(":scope > .slide")];
  if (!slides.length) return;
  const $ = (selector) => deck.querySelector(selector);
  const overview = $("#overview");
  const grid = $("#overview-grid");
  const notes = $("#notes-panel");
  const help = $("#help-hint");
  const overviewButton = $("#overview-button");
  const notesButton = $("#notes-button");
  const pad = (value) => String(value).padStart(2, "0");
  let current = -1;
  let overlayOpener;
  let touch;
  let toastTimer;
  let helpTimer;

  function fitStage() {
    const bounds = stageWrap.getBoundingClientRect();
    stage.style.setProperty(
      "--stage-scale",
      Math.min(bounds.width / 1600, bounds.height / 900),
    );
  }

  function parseHash() {
    let value;
    try {
      value = decodeURIComponent(location.hash.slice(1));
    } catch {
      return 0;
    }
    const legacy = value.match(/^slide-([0-9]+)$/);
    if (legacy)
      return Math.max(0, Math.min(slides.length - 1, Number(legacy[1]) - 1));
    const index = slides.findIndex((slide) => slide.id === value);
    return index < 0 ? 0 : index;
  }

  function showToast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("is-visible"),
      2500,
    );
  }

  function goTo(target, options = {}) {
    let index =
      typeof target === "string"
        ? slides.findIndex((slide) => slide.id === target)
        : target;
    if (!Number.isInteger(index) || index < 0 || index >= slides.length)
      return false;
    const previous = current;
    const focusInSlide = slides[previous]?.contains(document.activeElement);
    current = index;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
      slide.inert = !active;
      slide.tabIndex = -1;
    });
    $("#current-slide").textContent = pad(current + 1);
    $("#slide-total").textContent = pad(slides.length);
    $("#progress-fill").style.width =
      ((current + 1) / slides.length) * 100 + "%";
    $(".progress-track").setAttribute(
      "aria-label",
      "第 " + (current + 1) + " 页，共 " + slides.length + " 页",
    );
    $("#prev-button").disabled = current === 0;
    $("#next-button").disabled = current === slides.length - 1;
    $("#notes-text").textContent = slides[current].dataset.notes;
    document.title =
      slides[current].dataset.title + " — " + deck.dataset.deckTitle;
    [...grid.children].forEach((card, i) => {
      card.classList.toggle("is-current", i === current);
      if (i === current) card.setAttribute("aria-current", "page");
      else card.removeAttribute("aria-current");
    });
    if (options.hash !== false) {
      const url = "#" + encodeURIComponent(slides[current].id);
      try {
        history.replaceState(null, "", url);
      } catch {
        location.hash = slides[current].id;
      }
    }
    if (focusInSlide && !overview.classList.contains("is-open"))
      slides[current].focus({ preventScroll: true });
    if (previous !== current)
      deck.dispatchEvent(
        new CustomEvent("slidechange", {
          detail: {
            index: current,
            id: slides[current].id,
            previousIndex: previous,
            previousId: slides[previous]?.id,
          },
        }),
      );
    return true;
  }

  function scalePreviews() {
    for (const card of grid.children) {
      const preview = card.querySelector(".overview-preview");
      preview.style.transform = "scale(" + card.clientWidth / 1600 + ")";
    }
  }

  function renderOverview() {
    grid.replaceChildren(
      ...slides.map((slide, index) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "overview-card";
        card.setAttribute(
          "aria-label",
          "第 " + (index + 1) + " 页：" + slide.dataset.title,
        );
        const preview = document.createElement("span");
        preview.className = "overview-preview";
        preview.dataset.theme = deck.dataset.theme;
        preview.setAttribute("aria-hidden", "true");
        preview.inert = true;
        const clone = slide.cloneNode(true);
        clone.classList.remove("is-active");
        for (const element of [clone, ...clone.querySelectorAll("*")]) {
          for (const attribute of [
            "id",
            "for",
            "aria-labelledby",
            "aria-describedby",
            "autofocus",
            "autoplay",
          ])
            element.removeAttribute(attribute);
          if (element.matches("button, input, select, textarea, a, [tabindex]"))
            element.setAttribute("tabindex", "-1");
        }
        preview.append(clone);
        const label = document.createElement("span");
        label.className = "overview-card-label";
        const title = document.createElement("b");
        title.textContent = slide.dataset.title;
        const number = document.createElement("span");
        number.textContent = pad(index + 1);
        label.append(title, number);
        card.append(preview, label);
        card.addEventListener("click", () => {
          goTo(index);
          closeOverview();
          slides[current].focus({ preventScroll: true });
        });
        return card;
      }),
    );
  }

  function closeNotes() {
    notes.classList.remove("is-open");
    notes.setAttribute("aria-hidden", "true");
    notes.inert = true;
    notesButton.setAttribute("aria-expanded", "false");
    notesButton.classList.remove("is-on");
  }

  function closeOverview() {
    if (!overview.classList.contains("is-open")) return;
    overview.classList.remove("is-open");
    overview.setAttribute("aria-hidden", "true");
    overview.inert = true;
    stageWrap.inert = false;
    $(".control-bar").inert = false;
    overviewButton.setAttribute("aria-expanded", "false");
    overviewButton.classList.remove("is-on");
    overlayOpener?.focus({ preventScroll: true });
  }

  function toggleOverview() {
    if (overview.classList.contains("is-open")) {
      closeOverview();
      return;
    }
    closeNotes();
    overlayOpener = document.activeElement;
    overview.inert = false;
    overview.classList.add("is-open");
    overview.setAttribute("aria-hidden", "false");
    overviewButton.setAttribute("aria-expanded", "true");
    overviewButton.classList.add("is-on");
    stageWrap.inert = true;
    $(".control-bar").inert = true;
    scalePreviews();
    overview.getBoundingClientRect();
    grid.children[current].focus({ preventScroll: true });
    grid.children[current].scrollIntoView({ block: "nearest" });
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (deck.requestFullscreen) await deck.requestFullscreen();
      else showToast("浏览器不支持全屏，可使用浏览器的全屏菜单。");
    } catch {
      showToast("无法开启全屏，可使用浏览器的全屏菜单。");
    }
  }

  renderOverview();
  closeNotes();
  overview.inert = true;
  goTo(parseHash(), { hash: false });
  fitStage();
  const observer = new ResizeObserver(() => {
    fitStage();
    scalePreviews();
  });
  observer.observe(stageWrap);
  observer.observe(grid);
  $("#prev-button").addEventListener("click", () => goTo(current - 1));
  $("#next-button").addEventListener("click", () => goTo(current + 1));
  overviewButton.addEventListener("click", toggleOverview);
  $("#close-overview").addEventListener("click", closeOverview);
  notesButton.addEventListener("click", () => {
    if (notes.classList.contains("is-open")) closeNotes();
    else {
      notes.inert = false;
      notes.classList.add("is-open");
      notes.setAttribute("aria-hidden", "false");
      notesButton.setAttribute("aria-expanded", "true");
      notesButton.classList.add("is-on");
    }
  });
  $("#close-notes").addEventListener("click", () => {
    closeNotes();
    notesButton.focus();
  });
  $("#fullscreen-button").addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    $("#fullscreen-button").setAttribute(
      "aria-pressed",
      String(Boolean(document.fullscreenElement)),
    );
    fitStage();
  });
  window.addEventListener("hashchange", () =>
    goTo(parseHash(), { hash: false }),
  );
  document.addEventListener("keydown", (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.defaultPrevented
    )
      return;
    const target = event.target;
    if (
      target.closest(
        'input, textarea, select, [contenteditable="true"], [data-slide-interactive]',
      )
    )
      return;
    const key = event.key.toLowerCase();
    const isOverview = overview.classList.contains("is-open");
    if (isOverview) {
      if (key === "escape" || key === "o") {
        event.preventDefault();
        closeOverview();
      } else if (key === "tab") {
        const focusable = [$("#close-overview"), ...grid.children];
        const position = focusable.indexOf(document.activeElement);
        if (
          (event.shiftKey && position <= 0) ||
          (!event.shiftKey && position === focusable.length - 1)
        ) {
          event.preventDefault();
          focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
        }
      } else if (
        [
          "arrowleft",
          "arrowright",
          "arrowup",
          "arrowdown",
          "home",
          "end",
        ].includes(key)
      ) {
        event.preventDefault();
        const columns =
          getComputedStyle(grid).gridTemplateColumns.split(" ").length;
        const position = [...grid.children].indexOf(document.activeElement);
        const offset =
          {
            arrowleft: -1,
            arrowright: 1,
            arrowup: -columns,
            arrowdown: columns,
          }[key] || 0;
        const next =
          key === "home"
            ? 0
            : key === "end"
              ? slides.length - 1
              : Math.max(0, Math.min(slides.length - 1, position + offset));
        grid.children[next].focus();
      } else if (key === "enter" || key === " ") {
        const card = document.activeElement.closest(".overview-card");
        if (card) {
          event.preventDefault();
          card.click();
        }
      } else if (/^[1-9]$/.test(key) && Number(key) <= slides.length) {
        goTo(Number(key) - 1);
        closeOverview();
      }
      return;
    }
    if (key === "escape") {
      closeNotes();
      help.classList.remove("is-visible");
      return;
    }
    if (key === " " && target.closest('button, a, [role="button"]')) return;
    const actions = {
      arrowright: () => goTo(current + 1),
      arrowdown: () => goTo(current + 1),
      " ": () => goTo(current + (event.shiftKey ? -1 : 1)),
      pagedown: () => goTo(current + 1),
      arrowleft: () => goTo(current - 1),
      arrowup: () => goTo(current - 1),
      pageup: () => goTo(current - 1),
      home: () => goTo(0),
      end: () => goTo(slides.length - 1),
      o: toggleOverview,
      n: () => notesButton.click(),
      f: toggleFullscreen,
    };
    if (actions[key]) {
      event.preventDefault();
      actions[key]();
    } else if (/^[1-9]$/.test(key) && Number(key) <= slides.length)
      goTo(Number(key) - 1);
    else if (key === "?") {
      help.classList.toggle("is-visible");
      clearTimeout(helpTimer);
      helpTimer = setTimeout(() => help.classList.remove("is-visible"), 5000);
    }
  });

  stage.addEventListener(
    "touchstart",
    (event) => {
      touch =
        event.touches.length === 1 &&
        !event.target.closest(
          "button, a, input, select, textarea, [data-slide-interactive]",
        )
          ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
          : null;
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchend",
    (event) => {
      if (!touch || !event.changedTouches.length) return;
      const dx = event.changedTouches[0].clientX - touch.x;
      const dy = event.changedTouches[0].clientY - touch.y;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3)
        goTo(current + (dx < 0 ? 1 : -1));
      touch = null;
    },
    { passive: true },
  );
  stage.addEventListener(
    "touchcancel",
    () => {
      touch = null;
    },
    { passive: true },
  );
  window.SlideDeck = Object.freeze({
    goTo,
    showToast,
    get current() {
      return current;
    },
    get currentId() {
      return slides[current].id;
    },
    get length() {
      return slides.length;
    },
  });
})();
