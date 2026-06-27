import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiService } from './ai.service';

/**
 * TODO (deferred, BACKEND_SPEC.md §3.5): wire this up to a future Python
 * data service for /analyze-data (anomaly detection, curve fitting) and
 * an LLM provider (Gemini/OpenAI) streamed over SSE for
 * /generate-insights. Both endpoints are intentionally stubbed for now.
 */
@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze-data')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: '[Stub] Automated data statistics/curve-fitting. Returns 501.' })
  analyzeData() {
    return this.aiService.analyzeData();
  }

  @Post('generate-insights')
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({ summary: '[Stub] LLM-generated insight summary. Returns 501.' })
  generateInsights() {
    return this.aiService.generateInsights();
  }
}