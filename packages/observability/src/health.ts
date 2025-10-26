import { Request, Response } from 'express';
import { Logger } from './logger';

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: Record<string, any>;
  responseTime?: number;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  checks: Record<string, HealthCheckResult>;
}

export class HealthService {
  private checks: Map<string, HealthCheck> = new Map();
  private serviceName: string;
  private serviceVersion: string;
  private startTime: number;
  private logger: Logger;

  constructor(serviceName: string, serviceVersion: string, logger: Logger) {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
    this.startTime = Date.now();
    this.logger = logger;
  }

  addCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    this.logger.debug('Health check added', { checkName: check.name });
  }

  removeCheck(name: string): void {
    this.checks.delete(name);
    this.logger.debug('Health check removed', { checkName: name });
  }

  async getHealth(): Promise<HealthStatus> {
    const checkResults: Record<string, HealthCheckResult> = {};
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

    // Run all health checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(async ([name, check]) => {
      const startTime = Date.now();
      try {
        const result = await Promise.race([
          check.check(),
          this.timeoutPromise(5000), // 5 second timeout
        ]);
        
        result.responseTime = Date.now() - startTime;
        checkResults[name] = result;

        // Update overall status
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        const result: HealthCheckResult = {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Health check failed',
          responseTime: Date.now() - startTime,
        };
        checkResults[name] = result;
        overallStatus = 'unhealthy';
        
        this.logger.warn('Health check failed', {
          checkName: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(checkPromises);

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      version: this.serviceVersion,
      uptime: Date.now() - this.startTime,
      checks: checkResults,
    };
  }

  private timeoutPromise(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout after ${ms}ms`)), ms);
    });
  }

  // Express middleware for health endpoints
  healthHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const health = await this.getHealth();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Health check endpoint error', error instanceof Error ? error : new Error(String(error)));
        res.status(500).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          version: this.serviceVersion,
          error: 'Health check system failure',
        });
      }
    };
  }

  // Kubernetes liveness probe (simple check)
  livenessHandler() {
    return (req: Request, res: Response): void => {
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        uptime: Date.now() - this.startTime,
      });
    };
  }

  // Kubernetes readiness probe (full health check)
  readinessHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      try {
        const health = await this.getHealth();
        const isReady = health.status === 'healthy' || health.status === 'degraded';
        
        res.status(isReady ? 200 : 503).json({
          status: isReady ? 'ready' : 'not_ready',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          checks: health.checks,
        });
      } catch (error) {
        this.logger.error('Readiness check error', error instanceof Error ? error : new Error(String(error)));
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          error: 'Readiness check failed',
        });
      }
    };
  }
}

// Common health checks
export const commonHealthChecks = {
  database: (connectionCheck: () => Promise<boolean>): HealthCheck => ({
    name: 'database',
    check: async (): Promise<HealthCheckResult> => {
      try {
        const isConnected = await connectionCheck();
        return {
          status: isConnected ? 'healthy' : 'unhealthy',
          message: isConnected ? 'Database connection healthy' : 'Database connection failed',
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Database check failed',
        };
      }
    },
  }),

  redis: (pingCheck: () => Promise<string>): HealthCheck => ({
    name: 'redis',
    check: async (): Promise<HealthCheckResult> => {
      try {
        const result = await pingCheck();
        return {
          status: result === 'PONG' ? 'healthy' : 'unhealthy',
          message: result === 'PONG' ? 'Redis connection healthy' : 'Redis ping failed',
          details: { response: result },
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Redis check failed',
        };
      }
    },
  }),

  kafka: (adminCheck: () => Promise<boolean>): HealthCheck => ({
    name: 'kafka',
    check: async (): Promise<HealthCheckResult> => {
      try {
        const isHealthy = await adminCheck();
        return {
          status: isHealthy ? 'healthy' : 'unhealthy',
          message: isHealthy ? 'Kafka connection healthy' : 'Kafka connection failed',
        };
      } catch (error) {
        return {
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Kafka check failed',
        };
      }
    },
  }),

  memory: (thresholdMB: number = 1000): HealthCheck => ({
    name: 'memory',
    check: async (): Promise<HealthCheckResult> => {
      const usage = process.memoryUsage();
      const usedMB = usage.heapUsed / 1024 / 1024;
      const totalMB = usage.heapTotal / 1024 / 1024;
      
      const status = usedMB > thresholdMB ? 'degraded' : 'healthy';
      
      return {
        status,
        message: `Memory usage: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB`,
        details: {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          rss: usage.rss,
        },
      };
    },
  }),
};