# RV32 C application

Edit `src/main.c`, then use the `RV32:` commands or tasks in VS Code.

The generated `.rv32/`, `build/`, and `logs/` directories are local artifacts
and are ignored by Git. The processor SDK is registered once on the workstation
at `~/.local/share/rv32-sdk` and is not copied into this application.

## Additional C sources and headers

List source files and header search directories in `rv32.toml`:

```toml
[project]
name = "app"
language = "c"
source = "src/main.c"
sources = ["src/math_utils.c"]
include_dirs = ["include", "vendor/include"]
```

Paths are relative to the project folder. Create each listed directory. Use
`#include "math_utils.h"` in your C files; do not list headers under `sources`.
The same paths apply to all C translation units in simulation and FPGA builds.
Projects that omit `include_dirs` keep their previous behavior.
