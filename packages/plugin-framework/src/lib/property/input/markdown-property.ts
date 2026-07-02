import { z } from 'zod';
import { BasePropertySchema, TPropertyValue } from './common.js';
import { PropertyType } from './property-type.js';
import { MarkdownVariant } from '../../compat/shared-types.js';

export const MarkDownProperty = z.object({
  ...BasePropertySchema.shape,
  ...TPropertyValue(z.void(), PropertyType.MARKDOWN).shape,
});

export type MarkDownProperty = BasePropertySchema &
  TPropertyValue<
    undefined,
    PropertyType.MARKDOWN,
    false
  > & {
    variant?: MarkdownVariant;
  };
