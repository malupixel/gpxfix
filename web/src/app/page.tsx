"use client";
import { UploadForm } from "@/features/routes/upload-form";
import { RouteDemo } from "@/features/landing/route-demo";
import { useTranslation } from "react-i18next";
import Link from "next/link";

export default function Home() {
  const { t } = useTranslation();
  return <main className="landing-page"><div className="landing-shell">
    <section className="landing-intro" aria-labelledby="landing-heading">
      <p className="landing-eyebrow"><span aria-hidden="true">↗</span>{t('landing.community')}</p>
      <h1 id="landing-heading">{t('landing.headline')}<br/><span>{t('landing.headlineAccent')}</span></h1>
      <p className="landing-description">{t('landing.explanation')}</p>
      <div className="landing-intro-links"><a href="#start-your-route">{t('landing.startLink')} <span aria-hidden="true">↓</span></a><span>{t('common.noAccount')}</span></div>
    </section>
    <div className="landing-workspace">
      <RouteDemo />
      <section id="start-your-route" className="landing-start" aria-labelledby="start-heading">
        <div className="landing-start-heading"><span className="landing-section-mark" aria-hidden="true">↗</span><div><h2 id="start-heading">{t('landing.startTitle')}</h2><p>{t('landing.startHelp')}</p></div></div>
        <section className="landing-upload" aria-labelledby="upload-heading"><h3 id="upload-heading">{t('landing.uploadTitle')}</h3><p>{t('landing.uploadHelp')}</p><UploadForm compact /></section>
        <div className="landing-or"><span>{t('landing.or')}</span></div>
        <section className="landing-draw" aria-labelledby="draw-heading"><div><h3 id="draw-heading">{t('landing.drawTitle')}</h3><p>{t('landing.drawShortHelp')}</p></div><Link href="/draw" aria-label={t('landing.drawTitle')}><span aria-hidden="true">↗</span></Link></section>
      </section>
    </div>
    <p className="landing-closing">{t('landing.closing')}</p>
  </div></main>;
}
