"use client";
import { useTranslation } from "react-i18next";

export default function DataLicensesPage() {
  const { t } = useTranslation();
  return <main className="mx-auto max-w-3xl space-y-5 p-6">
    <h1 className="text-2xl font-bold">{t("licenses.title")}</h1>
    <p>{t("licenses.description")}</p>
    <p>{t("licenses.attribution")}</p>
    <p>{t("licenses.liability")}</p>
    <p>{t("licenses.endorsement")}</p>
    <a className="underline" href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf">{t("licenses.fullLicense")}</a>
  </main>;
}
