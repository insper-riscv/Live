# Insper RISC-V Live

VS Code buttons and project templates for programming the Insper RV32 processor
in C and Rust. The processor, runtime, compiler integration and FPGA cache live
in the [processor repository](https://github.com/insper-riscv/Insper-RISC-V).
This repository contains the extension, not a second copy of the processor.

## Install on a workstation

This version requires SDK **0.7.0**. The SDK integration is under review; use the
[SDK feature checkout](https://github.com/insper-riscv/Insper-RISC-V/tree/sdk-profiles-drivers). The same SDK is integrated into the existing `live-vscode` PR branch; processor `main` is not changed.
The SDK's `SDK.md` documents its pinned processor and Tools revisions.

Prerequisites: Linux, VS Code with Microsoft Dev Containers, Docker access,
and Quartus Standard/Lite with support for the board. The development image
supplies GHDL and the RISC-V C toolchain. First setup needs internet access.

Register the matching SDK once, on the computer that hosts Docker and the FPGA:

```bash
cd /path/to/Insper-RISC-V
bash scripts/install-user.sh --quartus /path/to/altera/std25.1
```

Install [the bundled VSIX](install/rv32-development.vsix), either with
**Extensions: Install from VSIX...** or:

```bash
code --install-extension /path/to/Live/install/rv32-development.vsix --force
```

Run **RV32: Create New C Project**, open the resulting folder, then run
**RV32: Reopen Project in Dev Container**. The matching SDK bundles this extension
and installs it into the container during setup. After an extension update,
run **Developer: Reload Window**. If automatic installation cannot find the
VS Code server, install the same VSIX from the connected container window.

For Rust, use the SDK generator on the Docker host:

```bash
~/.local/bin/rv32-new rust /path/to/my-rust-app
```

The container bootstrap installs the Rust target and `rust-src`. The firmware is
`no_std`; `core` is available. `String` and `Vec` require an allocator, which this
release does not provide.

## Connect over SSH

Install Microsoft Remote - SSH on your laptop and connect to the lab computer.
Create/open projects on that remote computer, register the SDK there, and install
Live into the **SSH extension host** using **Install from VSIX...**. Run
**Dev Containers: Reopen in Container** in that SSH window. Docker, Quartus and
the USB-Blaster all remain on the lab computer; the laptop displays the editor.

VPN/Tailscale connectivity and SSH access must already work. On shared machines,
use your own SDK checkout and cache, and coordinate board ownership. If several
connected boards match the target chip, set `project.jtag_hardware` to the exact
cable name reported by **RV32: Check Environment**. An unrelated board is never
selected as a fallback. Do not reset a shared JTAG service while another board
is in use.

## Use the three editor buttons

Open a `.c` or `.rs` file in a folder containing `rv32.toml`:

| Button | Action |
|---|---|
| Program FPGA | Synthesize on a cache miss, program the verified SOF, load and run the application |
| Fast Update FPGA | Compile and load the application over JTAG without synthesizing or reprogramming |
| Simulate | Compile and run in GHDL |

Use Program FPGA after power-on or SDK/hardware updates. Use Fast Update for
application changes after that. A completed program must return to the restart
loop before another fast update. Application edits do not invalidate the SOF;
hardware/runtime/build-flow edits do. Cache artifacts have SHA-256 checksums.

The same commands appear in the Command Palette and **Terminal: Run Task**.
Files are saved before a task starts. An active task blocks overlapping actions.

Normal execution shows program stdout only, including programs with no output.
Enable `rv32.debug` or **RV32: Toggle Debug Output** for compiler/tool diagnostics.
Logs are retained under `logs/rv32/`. The SDK's internal-memory runtime reserves
64 KiB for stdout; exceeding that reports failure instead of silently truncating.
The terminal retains 100,000 lines. `project.simulation_timeout_cycles` defaults
to 2,000,000; `project.timeout_seconds` controls the FPGA wait independently.

## Multiple C sources and headers

```toml
[project]
name = "my-app"
language = "c"
source = "src/main.c"
sources = ["src/list.c", "src/utils.c"]
include_dirs = ["include", "vendor/headers"]
```

Paths are relative to the project. List additional source files explicitly;
headers are found through `include_dirs`. Generated `.rv32`, `build`, `logs`,
`.vscode` and `.devcontainer` folders are hidden in the default Explorer view.
Their presence on disk is normal. Do not delete the container configuration.

## Upgrade an existing project

Back up local settings, install the matching SDK/VSIX, and refresh the project's
container configuration from the current SDK templates. Rebuild the container
and reload the window. The cache directory is mounted as a writable parent to
avoid the old `/home/ubuntu/.cache/uv` permission error. Older SDK bitstreams
are incompatible with this release: run Program FPGA once before Fast Update.

## Develop and package

```bash
npm ci
npm test
npm run package
```

The package is `dist/rv32-development-0.7.0.vsix`. The published installation
copy is `install/rv32-development.vsix`; both must contain the same extension
source/version. CI runs tests, packages the source and checks the bundled copy.
The SDK has separate unit, real compiler/simulator and hardware checks; see its
`SDK.md`. No marketplace publication is required for VSIX installation.

## Select a CPU profile

With the matching SDK from `sdk-profiles-drivers`, add this under `[project]` in `rv32.toml`:

```toml
platform = "internal-mem"
cpu_profile = "rv32im_zicsr"
```

The SDK reads the named YAML from `Core/profiles/`, applies the CPU switches to private simulation/Quartus builds and compiles C for that ISA. `cpu_profile = "auto"` (or omission) preserves existing behavior. The platform selects the memory/peripheral map separately. Run **Program FPGA** after changing a profile, then **Fast Update FPGA** for C-only edits. The programming record tracks this SDK's last programming on that cable; after another tool programs the board, run Program FPGA again. Do not change generated `.rv32` files.

## Peripheral C drivers

Use the matching SDK 0.8.0. New C templates enable `generate_drivers = true` under `[project]`. The SDK regenerates files in `vendor/` when preparing/building the project, using `platform` and `cpu_profile` from TOML. **RV32: Refresh Peripheral Drivers** also regenerates them explicitly. Sources and header paths are linked automatically.

Only drivers for peripherals declared in the platform map are copied. The first reusable driver is GPIO (`vendor/GPIO`), including per-instance addresses, direction, set/clear/toggle, pin reads and IRQ read-and-clear. UART-only platforms receive address definitions and no invented GPIO. The SDK's `examples/gpio` uses the simulation-only modular platform to exercise two GPIO instances. Generated files are ownership-checked; hand edits and unrelated vendor files are preserved. See the matching SDK's `SDK.md`.


The matching SDK provides constructor-based C drivers for GPIO, TIMER, CLINT,
PLIC, UART serial/JTAG, DISPLAY and FLASH_CTRL. Pin/digit/source indices replace
application-side register arithmetic. Driver availability follows the platform
map and CPU elaboration requirements. New projects include `.clang-format`
for readable multiline C code. See the SDK examples and driver headers for
polling limits and register read/clear side effects.


### Rust and standalone driver examples (0.8.0)

Use **RV32: Create New Rust Project** from the command palette. It creates a full
Rust 2024 bare-metal project with Cargo, tasks, editor settings and a Dev Container.
**RV32: Add Rust Infrastructure to Current Folder** preserves existing files.
Reopen the project in its container, then run Prepare Project and Simulate.

The matching SDK makes `examples/gpio` and `examples/peripherals` complete projects.
Prepare/Refresh Drivers also creates one C project at `vendor/<DRIVER>/example/`
for every available driver. Each child has its own TOML/container/tasks, inherits
the parent's hardware selection and disables recursive example generation. The
run buttons use the active file's nearest TOML. Copy a generated project before
editing it; managed-file protection applies. Opt out with
`generate_driver_examples = false`. FLASH examples only read status.
