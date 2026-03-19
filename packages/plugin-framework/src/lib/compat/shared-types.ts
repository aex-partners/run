/**
 * Compatibility layer: types originally from @activepieces/shared
 * that the pieces-framework depends on.
 *
 * Copied and adapted to avoid depending on the full @activepieces/shared package.
 */

import { z } from "zod";

// --- Enums ---

export enum PieceCategory {
  ARTIFICIAL_INTELLIGENCE = "ARTIFICIAL_INTELLIGENCE",
  COMMUNICATION = "COMMUNICATION",
  COMMERCE = "COMMERCE",
  CORE = "CORE",
  UNIVERSAL_AI = "UNIVERSAL_AI",
  FLOW_CONTROL = "FLOW_CONTROL",
  BUSINESS_INTELLIGENCE = "BUSINESS_INTELLIGENCE",
  ACCOUNTING = "ACCOUNTING",
  PRODUCTIVITY = "PRODUCTIVITY",
  CONTENT_AND_FILES = "CONTENT_AND_FILES",
  DEVELOPER_TOOLS = "DEVELOPER_TOOLS",
  CUSTOMER_SUPPORT = "CUSTOMER_SUPPORT",
  FORMS_AND_SURVEYS = "FORMS_AND_SURVEYS",
  HUMAN_RESOURCES = "HUMAN_RESOURCES",
  PAYMENT_PROCESSING = "PAYMENT_PROCESSING",
  MARKETING = "MARKETING",
  SALES_AND_CRM = "SALES_AND_CRM",
}

export enum TriggerStrategy {
  POLLING = "POLLING",
  WEBHOOK = "WEBHOOK",
  APP_WEBHOOK = "APP_WEBHOOK",
  MANUAL = "MANUAL",
}

export enum TriggerTestStrategy {
  SIMULATION = "SIMULATION",
  TEST_FUNCTION = "TEST_FUNCTION",
}

export enum WebhookHandshakeStrategy {
  NONE = "NONE",
  HEADER_PRESENT = "HEADER_PRESENT",
  QUERY_PRESENT = "QUERY_PRESENT",
  BODY_PARAM_PRESENT = "BODY_PARAM_PRESENT",
}

export const WebhookHandshakeConfiguration = z.object({
  strategy: z.nativeEnum(WebhookHandshakeStrategy),
  paramName: z.string().optional(),
});
export type WebhookHandshakeConfiguration = z.infer<
  typeof WebhookHandshakeConfiguration
>;

export enum AppConnectionType {
  OAUTH2 = "OAUTH2",
  PLATFORM_OAUTH2 = "PLATFORM_OAUTH2",
  CLOUD_OAUTH2 = "CLOUD_OAUTH2",
  SECRET_TEXT = "SECRET_TEXT",
  BASIC_AUTH = "BASIC_AUTH",
  CUSTOM_AUTH = "CUSTOM_AUTH",
  NO_AUTH = "NO_AUTH",
}

export enum OAuth2GrantType {
  AUTHORIZATION_CODE = "authorization_code",
  CLIENT_CREDENTIALS = "client_credentials",
}

export const BOTH_CLIENT_CREDENTIALS_AND_AUTHORIZATION_CODE =
  "both_client_credentials_and_authorization_code";

export enum ExecutionType {
  BEGIN = "BEGIN",
  RESUME = "RESUME",
}

export enum PieceType {
  CUSTOM = "CUSTOM",
  OFFICIAL = "OFFICIAL",
}

export enum PackageType {
  ARCHIVE = "ARCHIVE",
  REGISTRY = "REGISTRY",
}

export enum LocalesEnum {
  DUTCH = "nl",
  ENGLISH = "en",
  GERMAN = "de",
  FRENCH = "fr",
  SPANISH = "es",
  JAPANESE = "ja",
  CHINESE_SIMPLIFIED = "zh",
  PORTUGUESE = "pt",
  ARABIC = "ar",
  CHINESE_TRADITIONAL = "zh-TW",
}

export enum MarkdownVariant {
  BORDERLESS = "BORDERLESS",
  INFO = "INFO",
  WARNING = "WARNING",
  TIP = "TIP",
}

// --- Constants ---

export const MAX_KEY_LENGTH_FOR_CORWDIN = 512;
export const AUTHENTICATION_PROPERTY_NAME = "auth";

// --- Connection Value Types ---

export type SecretTextConnectionValue = {
  type: AppConnectionType.SECRET_TEXT;
  secret_text: string;
};

export type BasicAuthConnectionValue = {
  username: string;
  password: string;
  type: AppConnectionType.BASIC_AUTH;
};

export type BaseOAuth2ConnectionValue = {
  expires_in?: number;
  client_id: string;
  token_type: string;
  access_token: string;
  claimed_at: number;
  refresh_token: string;
  scope: string;
  token_url: string;
  authorization_method?: "HEADER" | "BODY";
  data: Record<string, unknown>;
  props?: Record<string, unknown>;
  grant_type?: OAuth2GrantType;
};

export type CloudOAuth2ConnectionValue = {
  type: AppConnectionType.CLOUD_OAUTH2;
} & BaseOAuth2ConnectionValue;

export type PlatformOAuth2ConnectionValue = {
  type: AppConnectionType.PLATFORM_OAUTH2;
  redirect_url: string;
} & BaseOAuth2ConnectionValue;

export type OAuth2ConnectionValueWithApp = {
  type: AppConnectionType.OAUTH2;
  client_secret: string;
  redirect_url: string;
} & BaseOAuth2ConnectionValue;

export type CustomAuthConnectionValue<
  T extends Record<string, unknown> = Record<string, unknown>,
> = {
  type: AppConnectionType.CUSTOM_AUTH;
  props: T;
};

export type NoAuthConnectionValue = {
  type: AppConnectionType.NO_AUTH;
};

export type AppConnectionValue<
  T extends AppConnectionType = AppConnectionType,
  PropsType extends Record<string, unknown> = Record<string, unknown>,
> = T extends AppConnectionType.SECRET_TEXT
  ? SecretTextConnectionValue
  : T extends AppConnectionType.BASIC_AUTH
    ? BasicAuthConnectionValue
    : T extends AppConnectionType.CLOUD_OAUTH2
      ? CloudOAuth2ConnectionValue
      : T extends AppConnectionType.PLATFORM_OAUTH2
        ? PlatformOAuth2ConnectionValue
        : T extends AppConnectionType.OAUTH2
          ? OAuth2ConnectionValueWithApp
          : T extends AppConnectionType.CUSTOM_AUTH
            ? CustomAuthConnectionValue<PropsType>
            : T extends AppConnectionType.NO_AUTH
              ? NoAuthConnectionValue
              : never;

// --- Utility Functions ---

export function assertNotNullOrUndefined<T>(
  value: T | null | undefined,
  fieldName: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is null or undefined`);
  }
}

export function isEmpty<T>(value: T | null | undefined): boolean {
  if (value == null) {
    return true;
  }
  if (typeof value === "string" || Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

export function isNil<T>(
  value: T | null | undefined,
): value is null | undefined {
  return value === null || value === undefined;
}

// --- Flow & Execution Types (simplified for framework needs) ---

export type ProjectId = string;
export type FlowRunId = string;

export type Cursor = string | null;
export type SeekPage<T> = {
  next: Cursor;
  previous: Cursor;
  data: T[];
};

export type TriggerPayload<T = unknown> = {
  body: T;
  rawBody?: unknown;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
};

export type EventPayload<B = unknown> = {
  body: B;
  rawBody?: unknown;
  method: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
};

export type ParseEventResponse = {
  event?: string;
  identifierValue?: string;
  reply?: {
    headers: Record<string, string>;
    body: unknown;
  };
};

export type ResumePayload = TriggerPayload;

export type RespondResponse = {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
};

export enum PauseType {
  DELAY = "DELAY",
  WEBHOOK = "WEBHOOK",
}

export enum ProgressUpdateType {
  NONE = "NONE",
  TEST_FLOW = "TEST_FLOW",
  BATCH = "BATCH",
}

export type DelayPauseMetadata = {
  type: PauseType.DELAY;
  resumeDateTime: string;
  requestIdToReply?: string;
  handlerId?: string;
  progressUpdateType?: ProgressUpdateType;
};

export type WebhookPauseMetadata = {
  type: PauseType.WEBHOOK;
  requestId: string;
  requestIdToReply?: string;
  response: RespondResponse;
  handlerId?: string;
  progressUpdateType?: ProgressUpdateType;
};

export type PauseMetadata = DelayPauseMetadata | WebhookPauseMetadata;

// --- Agent Types ---

export enum AgentToolType {
  PIECE = "PIECE",
}

export type AgentPieceToolMetadata = {
  pieceName: string;
  pieceVersion: string;
  actionName: string;
};

export type AgentPieceTool = {
  type: AgentToolType.PIECE;
  toolName: string;
  pieceMetadata: AgentPieceToolMetadata;
};

// --- PopulatedFlow (simplified) ---

export type FlowVersion = {
  id: string;
  flowId: string;
  displayName: string;
  trigger: unknown;
  state: string;
  valid: boolean;
};

export type PopulatedFlow = {
  id: string;
  status: string;
  version: FlowVersion;
};
