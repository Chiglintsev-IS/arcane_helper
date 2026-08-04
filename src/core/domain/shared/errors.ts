/**
 * Отказ домена: операция нарушила бы инвариант.
 *
 * Один тип на все домены, потому что вызывающий с ними обращается одинаково — показывает причину
 * игроку. Два класса отличались бы только именем в стеке.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

/**
 * Причина отказа словами — тому, кто спрашивает владельца заранее и обязан ответить, а не упасть.
 *
 * Отказ владельца входит в игру: его показывают там, где набирали. Всё остальное — сбой, и он идёт
 * дальше: сбой, названный причиной отказа, читался бы как правило игры.
 */
export function refusalReason(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  throw error;
}
