// Preference is only navigation state. Never use it to authorize requests.
export function organizationPreference(
  ids: string[],
  ...preferences: (string | null | undefined)[]
) {
  return (
    preferences.find((value) => !!value && ids.includes(value)) || ids[0] || ""
  );
}
