// Lifecycle of a reminder. A reminder is born `scheduled`; the worker moves it
// to `fired`, or the user moves it to `cancelled`. Both are terminal.
export type ReminderStatus = 'scheduled' | 'fired' | 'cancelled'
