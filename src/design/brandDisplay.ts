/** Presentation only for known first-party prose retained in older saved records. */
export function displayFirstPartyBrand(text: string): string {
  return text.replace('Assessment Practice', 'TraitGame')
}
