export interface EntityRegistry {
  entityIdBySlug(slug: string): Promise<string | null>
}
