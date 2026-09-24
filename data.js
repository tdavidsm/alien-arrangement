/*
 * Alien cards, cut from the "Aliens Activity" worksheet
 * (by John Bergmann and Jeff Christopherson).
 *
 * The worksheet split the aliens onto two sheets labeled "A" and "B" only so
 * they were easier to cut out — they are all one set. Here they are combined
 * into a single pool of 40 aliens. There is intentionally no answer key.
 */
const ALIENS = ["A", "B"].flatMap((sheet) =>
  Array.from({ length: 20 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { id: sheet + n, img: "images/" + sheet + n + ".png" };
  })
);
