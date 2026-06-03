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

type VisitorLocationFields = {
  city?: string | null;
  area?: string | null;
  country?: string | null;
};

export function formatVisitorLocation(
  location: VisitorLocationFields,
  fallback = "Location pending",
): string {
  const parts = [location.city, location.area, location.country].flatMap((value) => {
    const cleaned = value?.trim();
    return cleaned && cleaned.toLowerCase() !== "unknown" ? [cleaned] : [];
  });

  return parts.length > 0 ? parts.join(", ") : fallback;
}
