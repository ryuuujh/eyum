"use client";

import { useRouter } from "next/navigation";
import { startTransition, useOptimistic } from "react";
import { countries, type Country } from "../lib/workspace_navigation";

export function CountrySelect({ country_code }: { country_code?: Country["code"] }) {
  const router = useRouter();
  const [selected_code, set_selected_code] = useOptimistic<string>(country_code ?? "");

  function change_country(code: string) {
    const query = new URLSearchParams(window.location.search);
    query.set("country", code);
    startTransition(() => {
      set_selected_code(code);
      router.push(`?${query}${window.location.hash}`, { scroll: false });
    });
  }

  return (
    <div className="country_picker">
      <label htmlFor="export_country">수출국</label>
      <select
        id="export_country"
        name="country"
        value={selected_code}
        onChange={(event) => change_country(event.currentTarget.value)}
      >
        <option value="" disabled hidden>국가 선택</option>
        {countries.map((country) => (
          <option key={country.code} value={country.code}>{country.name}</option>
        ))}
      </select>
    </div>
  );
}
