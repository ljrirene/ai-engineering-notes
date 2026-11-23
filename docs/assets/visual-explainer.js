/* Optional enhancement. Without JavaScript, both complete flows remain visible and
   each step's native <details> works by keyboard and touch. */
(function () {
  "use strict";
  const lesson = document.querySelector(".vl-lesson");
  if (!lesson) return;
  const expand = lesson.querySelector(".vl-expand-all");
  const details = Array.from(lesson.querySelectorAll(".vl-method-step .vl-step-detail"));
  if (!expand || !details.length) return;
  expand.hidden = false;
  const updateLabel = () => {
    const allOpen = details.every(d => d.open);
    expand.setAttribute("aria-expanded", String(allOpen));
    expand.textContent = allOpen ? "收起两侧全部细节" : "展开两侧全部细节";
  };
  expand.addEventListener("click", () => {
    const shouldOpen = !details.every(d => d.open);
    details.forEach(d => { d.open = shouldOpen; });
    updateLabel();
  });
  details.forEach(d => d.addEventListener("toggle", updateLabel));
  updateLabel();
}());
