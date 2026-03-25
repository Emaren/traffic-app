export function flagFromCountryCode(countryCode?: string): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) {
    return "";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

export function withFlag(countryCode: string | undefined, label: string): string {
  const flag = flagFromCountryCode(countryCode);
  return flag ? `${flag} ${label}` : label;
}
