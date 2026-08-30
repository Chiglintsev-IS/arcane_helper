export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function refusalOf(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  throw error;
}
