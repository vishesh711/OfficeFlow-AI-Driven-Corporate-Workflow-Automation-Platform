import { CostMetrics, RateLimitState } from '../types/ai-types';
import { Logger } from '../utils/logger';

export class CostTracker {
  private logger: Logger;
  private costMetrics: CostMetrics[] = [];
  private rateLimitStates: Map<string, RateLimitState> = new Map();
  private readonly PRICING = {
    'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  };

  constructor(logger: Logger) {
    this.logger = logger;
  }

  trackUsage(metrics: CostMetrics): void {
    // Calculate estimated cost
    const pricing = this.PRICING[metrics.model as keyof typeof this.PRICING];
    if (pricing) {
      metrics.estimatedCost = 
        (metrics.promptTokens / 1000) * pricing.input +
        (metrics.completionTokens / 1000) * pricing.output;
    } else {
      // Default pricing for unknown models
      metrics.estimatedCost = (metrics.totalTokens / 1000) * 0.02;
      this.logger.warn('Unknown model pricing, using default rate', {
        model: metrics.model,
        defaultRate: 0.02,
      });
    }

    this.costMetrics.push(metrics);

    this.logger.info('AI usage tracked', {
      requestId: metrics.requestId,
      organizationId: metrics.organizationId,
      model: metrics.model,
      totalTokens: metrics.totalTokens,
      estimatedCost: metrics.estimatedCost,
      nodeType: metrics.nodeType,
    });

    // Clean up old metrics (keep last 1000 entries)
    if (this.costMetrics.length > 1000) {
      this.costMetrics = this.costMetrics.slice(-1000);
    }
  }

  getCostSummary(organizationId: string, timeRange?: { start: Date; end: Date }): {
    totalCost: number;
    totalTokens: number;
    requestCount: number;
    modelBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
    nodeTypeBreakdown: Record<string, { cost: number; tokens: number; requests: number }>;
  } {
    let filteredMetrics = this.costMetrics.filter(m => m.organizationId === organizationId);

    if (timeRange) {
      filteredMetrics = filteredMetrics.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    const summary = {
      totalCost: 0,
      totalTokens: 0,
      requestCount: filteredMetrics.length,
      modelBreakdown: {} as Record<string, { cost: number; tokens: number; requests: number }>,
      nodeTypeBreakdown: {} as Record<string, { cost: number; tokens: number; requests: number }>,
    };

    for (const metric of filteredMetrics) {
      summary.totalCost += metric.estimatedCost;
      summary.totalTokens += metric.totalTokens;

      // Model breakdown
      if (!summary.modelBreakdown[metric.model]) {
        summary.modelBreakdown[metric.model] = { cost: 0, tokens: 0, requests: 0 };
      }
      summary.modelBreakdown[metric.model].cost += metric.estimatedCost;
      summary.modelBreakdown[metric.model].tokens += metric.totalTokens;
      summary.modelBreakdown[metric.model].requests += 1;

      // Node type breakdown
      if (!summary.nodeTypeBreakdown[metric.nodeType]) {
        summary.nodeTypeBreakdown[metric.nodeType] = { cost: 0, tokens: 0, requests: 0 };
      }
      summary.nodeTypeBreakdown[metric.nodeType].cost += metric.estimatedCost;
      summary.nodeTypeBreakdown[metric.nodeType].tokens += metric.totalTokens;
      summary.nodeTypeBreakdown[metric.nodeType].requests += 1;
    }

    return summary;
  }

  checkRateLimit(organizationId: string, requestsPerMinute: number, tokensPerMinute: number): {
    allowed: boolean;
    reason?: string;
    resetTime?: Date;
  } {
    const now = new Date();
    const key = organizationId;
    let state = this.rateLimitStates.get(key);

    // Initialize or reset if window expired
    if (!state || (now.getTime() - state.windowStart.getTime()) >= 60000) {
      state = {
        requestCount: 0,
        tokenCount: 0,
        windowStart: now,
        isLimited: false,
      };
      this.rateLimitStates.set(key, state);
    }

    // Check limits
    if (state.requestCount >= requestsPerMinute) {
      const resetTime = new Date(state.windowStart.getTime() + 60000);
      return {
        allowed: false,
        reason: 'Request rate limit exceeded',
        resetTime,
      };
    }

    if (state.tokenCount >= tokensPerMinute) {
      const resetTime = new Date(state.windowStart.getTime() + 60000);
      return {
        allowed: false,
        reason: 'Token rate limit exceeded',
        resetTime,
      };
    }

    return { allowed: true };
  }

  updateRateLimit(organizationId: string, tokensUsed: number): void {
    const key = organizationId;
    const state = this.rateLimitStates.get(key);
    
    if (state) {
      state.requestCount += 1;
      state.tokenCount += tokensUsed;
      this.rateLimitStates.set(key, state);
    }
  }

  getTopConsumers(limit: number = 10): Array<{
    organizationId: string;
    totalCost: number;
    totalTokens: number;
    requestCount: number;
  }> {
    const orgSummaries = new Map<string, { cost: number; tokens: number; requests: number }>();

    for (const metric of this.costMetrics) {
      const existing = orgSummaries.get(metric.organizationId) || { cost: 0, tokens: 0, requests: 0 };
      existing.cost += metric.estimatedCost;
      existing.tokens += metric.totalTokens;
      existing.requests += 1;
      orgSummaries.set(metric.organizationId, existing);
    }

    return Array.from(orgSummaries.entries())
      .map(([organizationId, summary]) => ({
        organizationId,
        totalCost: summary.cost,
        totalTokens: summary.tokens,
        requestCount: summary.requests,
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, limit);
  }

  exportMetrics(organizationId?: string, format: 'json' | 'csv' = 'json'): string {
    let metrics = organizationId 
      ? this.costMetrics.filter(m => m.organizationId === organizationId)
      : this.costMetrics;

    if (format === 'csv') {
      const headers = [
        'requestId',
        'organizationId',
        'model',
        'promptTokens',
        'completionTokens',
        'totalTokens',
        'estimatedCost',
        'timestamp',
        'nodeType',
        'workflowId',
        'runId',
      ];

      const rows = metrics.map(m => [
        m.requestId,
        m.organizationId,
        m.model,
        m.promptTokens,
        m.completionTokens,
        m.totalTokens,
        m.estimatedCost.toFixed(6),
        m.timestamp.toISOString(),
        m.nodeType,
        m.workflowId || '',
        m.runId || '',
      ]);

      return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    return JSON.stringify(metrics, null, 2);
  }

  clearMetrics(organizationId?: string): void {
    if (organizationId) {
      this.costMetrics = this.costMetrics.filter(m => m.organizationId !== organizationId);
      this.logger.info('Cleared cost metrics for organization', { organizationId });
    } else {
      this.costMetrics = [];
      this.logger.info('Cleared all cost metrics');
    }
  }
}