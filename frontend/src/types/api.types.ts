export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
};

export type ApiErrorResponse = {
  statusCode: number;
  message: string;
  error?: string;
};
