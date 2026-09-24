/*
 * Alien card sets, cut from the "Aliens Activity" worksheet
 * (by John Bergmann and Jeff Christopherson).
 * Each set has 20 aliens. Students arrange them to discover a pattern.
 * There is intentionally no answer key.
 */
const SETS = {
  A: Array.from({ length: 20 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { id: "A" + n, img: "images/A" + n + ".png" };
  }),
  B: Array.from({ length: 20 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { id: "B" + n, img: "images/B" + n + ".png" };
  }),
};
