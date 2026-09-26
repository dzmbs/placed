"""Download verified MPFB source and CC0 assets into the workspace."""

import argparse
import hashlib
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOOLING = ROOT / "data/tooling/mpfb"
PACKS = [
    (
        "mpfb-v2.0.17.zip",
        "https://github.com/makehumancommunity/mpfb2/archive/refs/tags/v2.0.17.zip",
        "d08e726c798fdc4eefb02b06b6c4efe37d40b5439777e53cf96dce0e5073297d",
        TOOLING,
    ),
    (
        "system-assets.zip",
        "https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip",
        "b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107",
        TOOLING / "assets",
    ),
    (
        "dress01_cc0.zip",
        "https://files.makehumancommunity.org/asset_packs/dress01/dress01_cc0.zip",
        "f49ba54a3c93acd3c3307cc5a96cfc65daf8abfed9212a7e580791d821c9e93a",
        TOOLING / "assets",
    ),
]


def setup(offline=False):
    TOOLING.mkdir(parents=True, exist_ok=True)
    for name, url, digest, destination in PACKS:
        archive = TOOLING / name
        if not archive.exists():
            if offline:
                raise FileNotFoundError(f"Missing cached archive: {name}")
            print(f"Downloading {name}...", flush=True)
            partial = archive.with_suffix(".part")
            try:
                with (
                    urllib.request.urlopen(url, timeout=120) as response,
                    partial.open("wb") as output,
                ):
                    while chunk := response.read(1024 * 1024):
                        output.write(chunk)
                partial.rename(archive)
            finally:
                partial.unlink(missing_ok=True)
        checksum = hashlib.sha256()
        with archive.open("rb") as stream:
            while chunk := stream.read(1024 * 1024):
                checksum.update(chunk)
        actual = checksum.hexdigest()
        if actual != digest:
            raise ValueError(
                f"Checksum mismatch: {name}. Remove the cached archive and retry."
            )
        destination.mkdir(parents=True, exist_ok=True)
        root = destination.resolve()
        with zipfile.ZipFile(archive) as package:
            for entry in package.infolist():
                if not (root / entry.filename).resolve().is_relative_to(root):
                    raise ValueError("Unsafe archive path")
            package.extractall(root)
        print(f"Installed {name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--offline", action="store_true", help="Use cached archives only."
    )
    setup(parser.parse_args().offline)
