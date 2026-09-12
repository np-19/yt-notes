export class ExpressError extends Error {
  constructor(
    public override message: string,
    public status: number,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'ExpressError';
  }
}
