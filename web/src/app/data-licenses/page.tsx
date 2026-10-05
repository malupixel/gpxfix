export default function DataLicensesPage() {
  return <main className="mx-auto max-w-3xl space-y-5 p-6">
    <h1 className="text-2xl font-bold">Elevation data licence</h1>
    <p>Elevation added by TweakMyRoute using its local dataset is produced using Copernicus DEM GLO-30. Imported GPX files may contain elevations from other sources. Copernicus DEM is a surface model and can include vegetation and buildings.</p>
    <p>produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.</p>
    <p>The organisations in charge of the Copernicus programme by law or by delegation do not incur any liability for any use of the Copernicus WorldDEM-30.</p>
    <p>TweakMyRoute is not endorsed by the Copernicus programme, ESA or the dataset provider.</p>
    <a className="underline" href="https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf">Full Copernicus WorldDEM-30 licence</a>
  </main>;
}
