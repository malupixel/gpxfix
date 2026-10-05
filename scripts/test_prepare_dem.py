"""Offline synthetic-raster verification. Run with /usr/bin/python3 -m unittest discover -s scripts."""
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

try:
    from osgeo import gdal
except ImportError:
    gdal = None

SCRIPT = Path(__file__).with_name("prepare-dem.py")


class PreparationArgumentsTest(unittest.TestCase):
    def test_dry_run_does_not_create_output(self):
        with tempfile.TemporaryDirectory() as work:
            output = Path(work) / "dem"
            result = subprocess.run([sys.executable, str(SCRIPT), "--bounds", "21", "52", "22", "53", "--output", str(output), "--dry-run"], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertFalse(output.exists())
            self.assertIn("N52E021.hgt", result.stdout)

    def test_real_preparation_requires_license_acceptance(self):
        with tempfile.TemporaryDirectory() as work:
            result = subprocess.run([sys.executable, str(SCRIPT), "--bounds", "21", "52", "22", "53", "--output", work], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("--accept-license", result.stderr)
            self.assertEqual(list(Path(work).iterdir()), [])

    def test_repository_output_is_rejected(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "--bounds", "21", "52", "22", "53", "--output", str(SCRIPT.parent.parent / "data"), "--dry-run"], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("outside the repository", result.stderr)


@unittest.skipIf(gdal is None, "GDAL is only needed for offline conversion tests")
class PreparationRasterTest(unittest.TestCase):
    def test_node_alignment_and_shared_south_east_edges(self):
        gdal.UseExceptions()
        with tempfile.TemporaryDirectory() as work:
            target = Path(work)
            sources = target / "source-cog"
            sources.mkdir()
            for lat, lon, value in [(52, 21, 100), (52, 22, 200), (51, 21, 300), (51, 22, 400)]:
                stem = f"Copernicus_DSM_COG_10_N{lat}_00_E0{lon}_00_DEM"
                # Match official COG node-centred bounds and latitude-dependent width.
                raster = gdal.GetDriverByName("GTiff").Create(str(sources / (stem + ".tif")), 2400, 3600, 1, gdal.GDT_Float32, options=["COMPRESS=DEFLATE"])
                raster.SetGeoTransform((lon - .5 / 2400, 1 / 2400, 0, lat + 1 + .5 / 3600, 0, -1 / 3600))
                raster.SetProjection("EPSG:4326")
                raster.GetRasterBand(1).Fill(value)
                raster = None
            result = subprocess.run([sys.executable, str(SCRIPT), "--bounds", "21", "52", "22", "53", "--output", work, "--accept-license"], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            hgt = gdal.Open(str(target / "N52E021.hgt"))
            self.assertEqual((hgt.RasterXSize, hgt.RasterYSize), (3601, 3601))
            transform = hgt.GetGeoTransform()
            self.assertAlmostEqual(transform[0] + transform[1] / 2, 21)
            self.assertAlmostEqual(transform[3] + transform[5] / 2, 53)
            import struct
            band = hgt.GetRasterBand(1)
            def height(x, y):
                return struct.unpack("h", band.ReadRaster(x, y, 1, 1, buf_type=gdal.GDT_Int16))[0]
            self.assertEqual(height(1800, 1800), 100)
            self.assertEqual(height(3600, 1800), 200)
            self.assertEqual(height(1800, 3600), 300)
            self.assertEqual(height(3600, 3600), 400)


if __name__ == "__main__":
    unittest.main()
