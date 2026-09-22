import { AxiosError } from 'axios';

export interface ApiErrorResponse {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export class ApiError extends Error {
  statusCode: number;
  details?: string | string[];

  constructor(message: string, statusCode = 500, details?: string | string[]) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiErrorResponse | undefined;
    if (data?.message) {
      if (Array.isArray(data.message)) {
        return data.message.join(', ');
      }
      return data.message;
    }
    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}
