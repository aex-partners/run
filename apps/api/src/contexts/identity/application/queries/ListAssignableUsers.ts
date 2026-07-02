// Read side (CQRS). Picker for assigning tasks: any authenticated user may list
// assignable peers (non-banned humans); bot users are excluded. Mirrors
// users.listAssignable.
export interface AssignableUser {
  id: string
  name: string
  email: string
  image: string | null
}

export interface ListAssignableUsers {
  execute(): Promise<AssignableUser[]>
}
