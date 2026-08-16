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
 * Причина отказа словами; дефект остаётся исключением.
 *
 * Разница не косметическая: по отказу игроку есть что сделать, по дефекту — нечего, и выдавать
 * второе за первое значит врать ему словами правил.
 */
export function refusalOf(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  throw error;
}
