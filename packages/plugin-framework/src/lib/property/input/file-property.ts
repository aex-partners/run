import { z } from "zod";
import { BasePropertySchema, TPropertyValue } from "./common.js";
import { PropertyType } from "./property-type.js";

export class ApFile {
    constructor(
        public filename: string,
        public data: Buffer,
        public extension?: string
    ) { }

    get base64(): string {
        return this.data.toString('base64');
    }
}

export const FileProperty = z.object({
    ...BasePropertySchema.shape,
    ...TPropertyValue(z.unknown(), PropertyType.FILE).shape,
})

export type FileProperty<R extends boolean> = BasePropertySchema &
    TPropertyValue<ApFile, PropertyType.FILE, R>;
