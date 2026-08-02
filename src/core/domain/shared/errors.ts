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
