/**
 * Terminal UI helpers for the ViBe CLI.
 * Provides colored banners, step progress, and a live service status board.
 * Zero extra dependencies — uses only Node.js built-ins and ANSI escape codes.
 */

// ── ANSI color helpers ────────────────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  // foreground
  red:     "\x1b[31m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  cyan:    "\x1b[36m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
  // bright foreground
  bgreen:  "\x1b[92m",
  byellow: "\x1b[93m",
  bcyan:   "\x1b[96m",
  bwhite:  "\x1b[97m",
};

const isTTY = process.stdout.isTTY ?? false;
const col = (code: string, text: string) => isTTY ? `${code}${text}${C.reset}` : text;

// ── Public color helpers ──────────────────────────────────────────────────────
export const clr = {
  bold:    (s: string) => col(C.bold,    s),
  dim:     (s: string) => col(C.dim,     s),
  red:     (s: string) => col(C.red,     s),
  green:   (s: string) => col(C.green,   s),
  yellow:  (s: string) => col(C.yellow,  s),
  cyan:    (s: string) => col(C.cyan,    s),
  gray:    (s: string) => col(C.gray,    s),
  bgreen:  (s: string) => col(C.bgreen,  s),
  byellow: (s: string) => col(C.byellow, s),
  bcyan:   (s: string) => col(C.bcyan,   s),
  bwhite:  (s: string) => col(C.bwhite,  s),
};

// ── Banner ────────────────────────────────────────────────────────────────────
export function printBanner() {
  const line = "─".repeat(52);
  const empty = " ".repeat(52);
  console.log();
  console.log(col(C.cyan + C.bold, `┌${line}┐`));
  console.log(col(C.cyan + C.bold, `│${empty}│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.bwhite + C.bold, "    ██╗   ██╗██╗██████╗ ███████╗") +
    "                    " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.bwhite + C.bold, "    ██║   ██║██║██╔══██╗██╔════╝") +
    "                    " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.bcyan + C.bold,  "    ██║   ██║██║██████╔╝█████╗  ") +
    "                    " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.bcyan + C.bold,  "    ╚██╗ ██╔╝██║██╔══██╗██╔══╝  ") +
    "                    " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.blue + C.bold,   "     ╚████╔╝ ██║██████╔╝███████╗") +
    "                    " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.blue + C.bold,   "      ╚═══╝  ╚═╝╚═════╝ ╚══════╝") +
    "                   " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│${empty}│`));
  console.log(col(C.cyan + C.bold, `│`) +
    col(C.gray, "    Local Development Environment — Starting up...") +
    "  " +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `│${empty}│`));
  console.log(col(C.cyan + C.bold, `└${line}┘`));
  console.log();
}

// ── Step logger ───────────────────────────────────────────────────────────────
export type StepStatus = "pending" | "running" | "ok" | "warn" | "error" | "skip";

interface Step {
  label: string;
  status: StepStatus;
  detail?: string;
}

const ICON: Record<StepStatus, string> = {
  pending: "○",
  running: "◌",
  ok:      "✓",
  warn:    "⚠",
  error:   "✗",
  skip:    "–",
};

const ICON_COLOR: Record<StepStatus, (s: string) => string> = {
  pending: clr.gray,
  running: clr.yellow,
  ok:      clr.bgreen,
  warn:    clr.byellow,
  error:   clr.red,
  skip:    clr.gray,
};

export class StepLogger {
  private steps: Step[] = [];

  add(label: string): number {
    this.steps.push({ label, status: "pending" });
    return this.steps.length - 1;
  }

  update(idx: number, status: StepStatus, detail?: string) {
    this.steps[idx].status = status;
    if (detail !== undefined) this.steps[idx].detail = detail;
    this.printStep(this.steps[idx]);
  }

  private printStep(step: Step) {
    const icon   = ICON[step.status];
    const colorFn = ICON_COLOR[step.status];
    const iconStr  = colorFn(icon);
    const labelStr = step.status === "error"
      ? clr.red(step.label)
      : step.status === "warn"
        ? clr.byellow(step.label)
        : step.status === "ok"
          ? clr.bgreen(step.label)
          : step.status === "skip"
            ? clr.gray(step.label)
            : clr.bwhite(step.label);
    const detailStr = step.detail ? clr.gray(`  ${step.detail}`) : "";
    console.log(`  ${iconStr} ${labelStr}${detailStr}`);
  }
}

// ── Service status board ──────────────────────────────────────────────────────
export interface ServiceInfo {
  name:   string;
  url?:   string;
  status: "starting" | "up" | "down";
}

export function printServiceBoard(services: ServiceInfo[]) {
  const line = "─".repeat(50);
  console.log();
  console.log(col(C.cyan + C.bold, `  ┌${line}┐`));
  console.log(col(C.cyan + C.bold, `  │`) +
    clr.bold("  ViBe — Local Stack Running") +
    " ".repeat(22) +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `  ├${line}┤`));

  for (const svc of services) {
    const statusStr = svc.status === "up"
      ? clr.bgreen("● UP")
      : svc.status === "starting"
        ? clr.byellow("◌ Starting")
        : clr.red("✗ DOWN");

    const urlStr = svc.url ? clr.cyan(svc.url) : "";
    const name   = clr.bwhite(svc.name.padEnd(22));
    const row    = `  │  ${name} ${statusStr.padEnd(6)}  ${urlStr}`;
    const padding = " ".repeat(Math.max(0, 52 - stripAnsi(row).length + 2));
    console.log(col(C.cyan + C.bold, `  │`) + `  ${name} ${statusStr}   ${urlStr}${padding}` + col(C.cyan + C.bold, `│`));
  }

  console.log(col(C.cyan + C.bold, `  ├${line}┤`));
  console.log(col(C.cyan + C.bold, `  │`) +
    clr.dim("  Press Ctrl+C to stop all services") +
    " ".repeat(15) +
    col(C.cyan + C.bold, `│`));
  console.log(col(C.cyan + C.bold, `  └${line}┘`));
  console.log();
}

// ── Section header ────────────────────────────────────────────────────────────
export function section(title: string) {
  console.log();
  console.log(clr.cyan("  ▸ ") + clr.bold(title));
}

// ── Utility ───────────────────────────────────────────────────────────────────
/** Strip ANSI escape codes for length calculations */
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export function log(msg: string)  { console.log(`  ${msg}`); }
export function ok(msg: string)   { console.log(`  ${clr.bgreen("✓")} ${msg}`); }
export function warn(msg: string) { console.log(`  ${clr.byellow("⚠")} ${clr.byellow(msg)}`); }
export function err(msg: string)  { console.log(`  ${clr.red("✗")} ${clr.red(msg)}`); }
export function info(msg: string) { console.log(`  ${clr.cyan("ℹ")} ${clr.gray(msg)}`); }
export function sep()             { console.log(clr.gray("  " + "─".repeat(48))); }
