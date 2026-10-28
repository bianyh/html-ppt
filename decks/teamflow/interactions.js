(() => {
  const deck = document.querySelector('[data-deck-id="teamflow"]');
  if (!deck) return;
  const input = deck.querySelector("#team-size");
  function update() {
    const people = Number(input.value);
    const before = (people * 6 * 12) / 60;
    const after = (people * 6 * 3) / 60;
    deck.querySelector("#team-size-value").textContent = people + " 人";
    input.setAttribute("aria-valuetext", people + " 人");
    deck.querySelector("#before-value").textContent =
      before.toFixed(1) + " 小时";
    deck.querySelector("#after-value").textContent = after.toFixed(1) + " 小时";
    deck.querySelector("#saved-value").textContent = (before - after).toFixed(
      1,
    );
  }
  input.addEventListener("input", update);
  deck.querySelector("#revisit-calculator").addEventListener("click", () => {
    window.SlideDeck.goTo("calculator");
    if (window.SlideDeck.currentId === "calculator")
      input.focus({ preventScroll: true });
  });
  update();
})();
