"""Verify the installation VSIX matches the package rebuilt from this source."""

import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
version = json.loads((root / "package.json").read_text())["version"]
built = root / "dist" / f"rv32-development-{version}.vsix"
bundle = root / "install/rv32-development.vsix"
with zipfile.ZipFile(built) as first, zipfile.ZipFile(bundle) as second:
    left = {name: first.read(name) for name in first.namelist() if not name.endswith("/")}
    right = {name: second.read(name) for name in second.namelist() if not name.endswith("/")}
    assert left == right, "Bundled VSIX differs from the package rebuilt from source"
    for name in ("extension.js", "src/core.js", "package.json", "templates/c/rv32.toml", "templates/c/.clang-format"):
        assert left[f"extension/{name}"] == (root / name).read_bytes(), name
print(f"Verified installation VSIX {version} against rebuilt package and source")
