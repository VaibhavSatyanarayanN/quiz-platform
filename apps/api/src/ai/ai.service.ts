
import {
    GatewayTimeoutException,
    HttpException,
    Injectable,
    InternalServerErrorException,
    ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import FormData from 'form-data';

import type {
    GenerateFromPdfDto,
    GenerateQuizDto,
} from './dto/generate-quiz.dto.js';

@Injectable()
export class AiService {
    private readonly baseUrl: string;
    private readonly timeoutMs: number;

    constructor(private readonly httpService: HttpService) {
        this.baseUrl = (
            process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
        ).replace(/\/+$/, '');

        this.timeoutMs = Number(
            process.env.AI_SERVICE_TIMEOUT_MS ?? 180000,
        );

        if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
            throw new Error('AI_SERVICE_TIMEOUT_MS must be positive.');
        }
    }


    private serializeJsonField(
        value: unknown,
        fallback: unknown,
    ): string {
        if (value === undefined || value === null || value === '') {
            return JSON.stringify(fallback);
        }

        if (typeof value === 'string') {
            // Verify that a string already contains valid JSON.
            JSON.parse(value);
            return value;
        }

        return JSON.stringify(value);
    }


    async generateQuiz(request: GenerateQuizDto): Promise<unknown> {
        try {
            const response = await this.httpService.axiosRef.post(
                `${this.baseUrl}/generate`,
                request,
                {
                    timeout: this.timeoutMs,
                    headers: { 'Content-Type': 'application/json' },
                },
            );

            return response.data;
        } catch (error: unknown) {
            this.handleUpstreamError(error);
        }
    }

    async generateQuizFromPdf(
        file: Express.Multer.File,
        options: GenerateFromPdfDto,
    ): Promise<unknown> {
        const form = new FormData();

        form.append('file', file.buffer, {
            filename: file.originalname,
            contentType: 'application/pdf',
        });

        form.append(
            'question_count',
            String(options.question_count ?? 10),
        );
        form.append(
            'question_types',
            this.serializeJsonField(options.question_types, ['mcq']),
        );

        form.append(
            'difficulty_distribution',
            this.serializeJsonField(
                options.difficulty_distribution,
                { easy: 3, medium: 5, hard: 2 },
            ),
        );
        form.append(
            'target_audience',
            options.target_audience ?? 'General learners',
        );
        form.append('language', options.language ?? 'English');
        form.append(
            'max_revision_attempts',
            String(options.max_revision_attempts ?? 1),
        );

        try {
            const response = await this.httpService.axiosRef.post(
                `${this.baseUrl}/generate-from-pdf`,
                form,
                {
                    timeout: this.timeoutMs,
                    headers: form.getHeaders(),
                    maxBodyLength: 10 * 1024 * 1024,
                },
            );

            return response.data;
        } catch (error: unknown) {
            this.handleUpstreamError(error);
        }
    }

    private handleUpstreamError(error: unknown): never {
        if (axios.isAxiosError(error)) {
            const status = error.response?.status;

            // Do not expose Python tracebacks or internal error payloads.
            if (status && status >= 400 && status < 500) {
                throw new HttpException(
                    {
                        statusCode: status,
                        message: 'The AI service rejected the generation request.',
                    },
                    status,
                );
            }

            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                throw new GatewayTimeoutException(
                    'The AI service took too long to respond.',
                );
            }

            if (!error.response || (status !== undefined && status >= 500)) {
                throw new ServiceUnavailableException(
                    'The AI service is temporarily unavailable.',
                );
            }
        }

        throw new InternalServerErrorException(
            'An unexpected error occurred while calling the AI service.',
        );
    }
}
