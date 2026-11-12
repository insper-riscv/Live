# Changelog

## 0.6.0

- Add CPU profile selection in project TOML through the matching SDK.
- Pin the multilib development image and cap project containers at 8 GiB.
- Require Program FPGA after a CPU-profile change before Fast Update.

## 0.5.0

- Publish the extension and install guides in insper-riscv/Live.
- Pair with the reproducible SDK integration for the current processor layout.

## 0.4.5

- Support project.include_dirs in rv32.toml for additional C header directories.
- Include an include/ folder in new C projects.

## 0.4.4

- Hide infrastructure and generated folders in Explorer by default.

## 0.4.3

- Activate on C/Rust editors, including installation after container startup.
- Show project infrastructure, generated files and logs in Explorer.
- Include task shortcuts in extension-created projects as in SDK templates.

## 0.4.2

- Show Program FPGA, Fast Update and Simulate on Rust editors too.
- Configure Rust firmware checks without the unavailable embedded test harness.

## 0.4.1

- Reserve 64 KiB for program stdout on internal-mem and read its configured size.
- Keep 100,000 lines of terminal scrollback in project settings.
- Read only the used stdout payload over JTAG.

## 0.4.0

- Update the SDK to the current processor main and pinned components.
- Use HTIF results and the new checked JTAG FLASH loader for fast updates.
- Include the new RTL layout and Common-Components in SOF cache invalidation.
- Preserve quiet/debug output and existing C/Rust project workflows.

## 0.3.0

- Default to program-only terminal output, preserving exact stdout bytes.
- Add rv32.debug and RV32: Toggle Debug Output for verbose diagnostics.
- Retain diagnostics in logs and report failures briefly with nonzero status.
- Hide task command echoes and terminal reuse messages in normal mode.

## 0.2.3

- Configure the simulation cycle budget in rv32.toml (SDK default: 2,000,000).
- Preserve simulator failure status without an extra orchestration traceback.

## 0.2.2

- Enable and always show editor actions in RV32 project settings.
- Bundle the extension in the SDK and reinstall it during container creation.
- Label and order the buttons as Program FPGA, Fast Update FPGA, Simulate.

## 0.2.1

- Mount the writable cache parent so uv setup works as the Dev Container user.
- Keep GHDL available when Compose replaces PATH.

## 0.2.0

- Add Simulate, Run on FPGA and Program FPGA editor buttons for RV32 C projects.
- Save source files before executing commands and select the active workspace.
- Prevent overlapping button tasks and honor SDK selection in remote workspaces.
- Persist the SDK SOF cache across project containers.
- Validate commands in a real VS Code extension host.

## 0.1.0

- Create minimal external C projects.
- Add infrastructure safely to an existing folder.
- Discover the globally registered RV32 SDK.
- Provide setup, simulation, FPGA, and stdout commands and tasks.
- Include a Dev Container template without per-project Docker builds or path exports.
