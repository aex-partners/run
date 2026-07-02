// Driving port (read). Returns the parsed value for a key, or null if absent.
export interface GetSettingQuery {
  key: string
}

export interface GetSetting {
  execute(query: GetSettingQuery): Promise<unknown>
}
