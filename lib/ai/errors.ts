export class MissingAPIKeyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingAPIKeyError'
  }
}
