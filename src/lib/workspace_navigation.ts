export const countries = [
  { code: "sg", name: "싱가포르" },
  { code: "fr", name: "프랑스" },
] as const;

export const features = [
  { slug: "products", title: "제품 관리", country_scoped: false },
  { slug: "regulations", title: "식품 규제", country_scoped: true },
  { slug: "labels", title: "라벨링", country_scoped: true },
  { slug: "export_documents", title: "CI/PL", country_scoped: true },
  { slug: "export_declaration", title: "수출신고서", country_scoped: true },
  { slug: "certificates", title: "CoA 번역", country_scoped: true },
  { slug: "login_management", title: "내 계정", country_scoped: false },
] as const;

export type Country = (typeof countries)[number];
export type Feature = (typeof features)[number];
export type CountryQuery = { country?: string | string[] };

export function find_country(value: CountryQuery["country"]) {
  return countries.find((country) => country.code === value);
}

export function workspace_href(path: string, country: Country | undefined) {
  return country ? `${path}?country=${country.code}` : path;
}
