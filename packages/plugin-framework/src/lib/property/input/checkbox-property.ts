import { z } from "zod";
import { BasePropertySchema, TPropertyValue } from "./common.js";
import { PropertyType } from "./property-type.js";

export const CheckboxProperty = z.object({
  ...BasePropertySchema.shape,
  ...TPropertyValue(z.boolean(), PropertyType.CHECKBOX).shape,
})

export type CheckboxProperty<R extends boolean> = BasePropertySchema &
  TPropertyValue<boolean, PropertyType.CHECKBOX, R>;
