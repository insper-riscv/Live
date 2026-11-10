# Live 0.5.0 verification — 2026-11-10

- Ten unit checks passed: SDK selection, template preservation, project names,
  command manifest, clean templates, writable cache mount, toolbar settings,
  C/Rust editor actions, workspace/task/save/debug behavior and overlap prevention.
- Real VS Code extension-host tests passed for C and Rust: activation, Simulate,
  Fast Update FPGA, Program FPGA, debug toggling and generated task arguments.
  These editor checks use a fake SDK to isolate the extension from hardware.
- Clean packaging passed. The installation VSIX matches the rebuilt package and
  runtime source. The processor SDK bundles the same VSIX.
- Matching SDK candidate (processor main 0ea3460, SDK 0.5.0) passed real C/Rust
  simulation and Cyclone V programming, cached reprogramming, fast updates,
  complete long output and simulation/hardware mode switching.

The SDK integration awaits review before merging into the processor's existing
live-vscode branch. No marketplace publication is required to install the VSIX.
