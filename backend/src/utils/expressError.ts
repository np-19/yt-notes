

interface IExpressError extends Error {
  status: number;
  message: string;
}

class ExpressError extends Error implements IExpressError {

    constructor(public message: string, public status: number, public cause?: unknown) {
        super(message);
    }
}

export { ExpressError, type IExpressError };
