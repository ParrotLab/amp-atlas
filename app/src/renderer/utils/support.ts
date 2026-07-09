// The Airtable "Report a problem" form. Empty until the form is built; fill this one line in then.
export const SUPPORT_FORM_URL = ''

/** Whether Report-a-problem should open the form (vs. just copying logs). */
export function shouldOpenForm(url: string): boolean {
  return url.trim().length > 0
}
