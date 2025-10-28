// Type declarations for external dependencies

declare module 'crypto-js' {
  export interface CipherStatic {
    encrypt(message: string, key: string): any;
    decrypt(encryptedMessage: any, key: string): any;
  }

  export const AES: CipherStatic;

  export const enc: {
    Utf8: any;
  };
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    timeout?: number;
    params?: any;
    data?: any;
  }

  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: AxiosRequestConfig;
  }

  export interface AxiosInstance {
    get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
    interceptors: {
      request: {
        use(onFulfilled: (config: any) => any, onRejected?: (error: any) => any): void;
      };
      response: {
        use(onFulfilled: (response: any) => any, onRejected?: (error: any) => any): void;
      };
    };
  }

  export interface AxiosStatic extends AxiosInstance {
    create(config?: AxiosRequestConfig): AxiosInstance;
  }

  const axios: AxiosStatic;
  export default axios;
}

declare module 'googleapis' {
  export interface OAuth2Client {
    setCredentials(credentials: any): void;
  }

  export const google: {
    auth: {
      OAuth2: new (clientId: string, clientSecret: string, redirectUri: string) => OAuth2Client;
    };
    admin: (options: { version: string; auth: any }) => any;
  };

  export namespace admin_directory_v1 {
    export interface Schema$User {
      id?: string;
      primaryEmail?: string;
      name?: {
        givenName?: string;
        familyName?: string;
        fullName?: string;
      };
      password?: string;
      changePasswordAtNextLogin?: boolean;
      orgUnitPath?: string;
      suspended?: boolean;
      includeInGlobalAddressList?: boolean;
      customSchemas?: Record<string, any>;
      creationTime?: string;
      lastLoginTime?: string;
      suspensionReason?: string;
    }
  }
}

declare module 'joi' {
  export interface ValidationError {
    details: Array<{
      message: string;
      path: (string | number)[];
      type: string;
      context?: any;
    }>;
  }

  export interface ValidationResult {
    error?: ValidationError;
    value: any;
  }

  export interface Schema {
    validate(value: any, options?: any): ValidationResult;
  }

  export interface StringSchema extends Schema {
    email(): StringSchema;
    valid(...values: any[]): StringSchema;
    required(): StringSchema;
    optional(): StringSchema;
    when(ref: string, options: any): StringSchema;
  }

  export interface AnySchema extends Schema {
    required(): AnySchema;
  }

  export interface ArraySchema extends Schema {
    items(schema: Schema): ArraySchema;
    optional(): ArraySchema;
  }

  export interface ObjectSchema extends Schema {
    // Object schema methods
  }

  export function string(): StringSchema;
  export function array(): ArraySchema;
  export function object(schema?: Record<string, Schema>): ObjectSchema;
  export function required(): AnySchema;
}
