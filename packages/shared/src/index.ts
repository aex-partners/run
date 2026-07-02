export {
  UserRole,
  ConversationType,
  MessageRole,
  signUpSchema,
  signInSchema,
  ENTITY_FIELD_TYPES,
  entityFieldTypeSchema,
  entityFieldOptionSchema,
} from "./types/index.js";

export type {
  SignUpInput,
  SignInInput,
  EntityFieldType,
  EntityFieldOption,
} from "./types/index.js";

export {
  DEFAULT_AGENT_ID,
  DEFAULT_AGENT_NAME,
  DEFAULT_AGENT_SLUG,
} from "./constants.js";

export {
  ENTITY_KNOWLEDGE,
  getKnowledgeMap,
  getEntitiesForRoutines,
  buildEntityContextForAI,
} from "./knowledge/entity-knowledge.js";

export type {
  EntityKnowledge,
  FieldDefinition,
} from "./knowledge/entity-knowledge.js";

export { translateEntity } from "./knowledge/entity-translations.js";
