import { Injectable } from '@nestjs/common';

export interface AiStubResponse {
  message: string;
  endpoint: string;
}

/**
 * Stub only. Real implementation is deferred to a future Python data
 * service + LLM integration (see BACKEND_SPEC.md §3.5). These methods
 * intentionally return a fixed placeholder rather than throwing, so the
 * controller can respond with HTTP 501 + a descriptive body instead of a
 * bare error.
 */
@Injectable()
export class AiService {
  analyzeData(endpoint = '/api/v1/ai/analyze-data'): AiStubResponse {
    return {
      message: 'AI service not yet implemented',
      endpoint,
    };
  }

  generateInsights(endpoint = '/api/v1/ai/generate-insights'): AiStubResponse {
    return {
      message: 'AI service not yet implemented',
      endpoint,
    };
  }
}