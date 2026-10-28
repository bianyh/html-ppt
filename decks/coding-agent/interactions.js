(() => {
  const deck = document.querySelector('[data-deck-id="coding-agent"]');
  if (!deck) return;
  let timers = [];
  const button = deck.querySelector("#build-button");
  const steps = [...deck.querySelectorAll(".build-step")];
  const preview = deck.querySelector("#mini-browser");
  const status = deck.querySelector("#build-status");
  function resetBuild() {
    timers.forEach(clearTimeout);
    timers = [];
    steps.forEach((step) => step.classList.remove("is-done"));
    preview.classList.remove("is-visible");
    status.textContent = "等待开始";
    button.disabled = false;
    button.innerHTML = "<span>✳</span> 开始构建 <b>↗</b>";
  }
  button.addEventListener("click", () => {
    resetBuild();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    status.textContent = "正在理解…";
    button.disabled = true;
    button.innerHTML = "<span>✳</span> 正在构建 <b>···</b>";
    steps[0].classList.add("is-done");
    const finish = () => {
      steps[1].classList.add("is-done");
      steps[2].classList.add("is-done");
      status.textContent = "检查完成 · 模拟演示";
      preview.classList.add("is-visible");
      button.disabled = false;
      button.innerHTML = "<span>↻</span> 再构建一次 <b>↗</b>";
    };
    if (reduced) finish();
    else {
      timers.push(
        setTimeout(() => {
          steps[1].classList.add("is-done");
          status.textContent = "正在搭建…";
        }, 650),
      );
      timers.push(setTimeout(finish, 1400));
    }
  });
  const sceneButton = deck.querySelector("#scene-button");
  sceneButton.setAttribute("aria-pressed", "false");
  sceneButton.addEventListener("click", () => {
    const exploring = deck
      .querySelector(".web-scene")
      .classList.toggle("is-exploring");
    sceneButton.setAttribute("aria-pressed", String(exploring));
    deck.querySelector("#scene-caption").textContent = exploring
      ? "你刚刚改变了这个空间。"
      : "等待你的探索";
    sceneButton.innerHTML = exploring
      ? "再试一次 <b>↺</b>"
      : "体验一下 <b>↗</b>";
  });
  deck.querySelector("#start-idea").addEventListener("click", () => {
    window.SlideDeck.goTo("live-demo");
    requestAnimationFrame(() => button.focus({ preventScroll: true }));
  });
  deck.addEventListener("slidechange", (event) => {
    if (event.detail.previousId === "live-demo") resetBuild();
  });
  resetBuild();
})();
