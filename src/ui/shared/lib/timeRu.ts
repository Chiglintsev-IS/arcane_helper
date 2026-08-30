export function timeRu(at: string): string {
  const moment = new Date(at);
  const hours = `${moment.getHours()}`.padStart(2, "0");
  const minutes = `${moment.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}
