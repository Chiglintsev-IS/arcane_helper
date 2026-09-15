/**
 * Где экран оставил каждую свою страницу. Место запоминается, пока по странице ведут, а не при
 * уходе с неё: к тому времени на месте прокрутки стоит уже другая страница, и браузер успевает
 * подрезать положение под её высоту.
 */
export function scrollPlaces(): {
  readonly at: (place: string) => number;
  readonly leftAt: (place: string, top: number) => void;
} {
  const places = new Map<string, number>();
  return {
    at: (place) => places.get(place) ?? 0,
    leftAt: (place, top) => {
      places.set(place, top);
    },
  };
}
