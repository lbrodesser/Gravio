export class AppError extends Error {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational
    Object.setPrototypeOf(this, new.target.prototype)
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ErrorHandler {
  static handle(error: unknown): AppError {
    if (error instanceof AppError) return error
    if (error instanceof Error) {
      return new AppError(error.message, 500)
    }
    return new AppError('Ein unbekannter Fehler ist aufgetreten.', 500)
  }

  static toUserMessage(error: unknown): string {
    const appError = ErrorHandler.handle(error)
    if (appError.isOperational) return appError.message
    return 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.'
  }
}
