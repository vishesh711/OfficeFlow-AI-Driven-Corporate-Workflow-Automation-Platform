// Temporary winston type declarations
declare module 'winston' {
  export interface Logger {
    error(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    info(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
  }

  export interface LoggerOptions {
    level?: string;
    format?: any;
    transports?: any[];
  }

  export function createLogger(options: LoggerOptions): Logger;

  export const format: {
    combine(...formats: any[]): any;
    timestamp(): any;
    errors(options: any): any;
    json(): any;
    simple(): any;
  };

  export const transports: {
    Console: new () => any;
    File: new (options: any) => any;
  };
}
