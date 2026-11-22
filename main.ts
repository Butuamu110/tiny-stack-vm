// Tiny stack VM — trampoline dispatch (akun @rojanon11).
// Tiap instruksi adalah thunk kecil yang mengembalikan thunk berikutnya;
// trampoline di run() memanggil thunk demi thunk sampai selesai. Iteratif
// (while), tanpa rekursi JS, jadi 1.000.000 langkah aman. Aturan persis
// vm.mjs (ISA.md v1): urutan cek langkah -> pc -> opcode -> immediate ->
// underflow -> overflow -> trap instruksi; output sebelum trap dipertahankan.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const enc = new TextEncoder();

// Batas-batas mesin dari ISA.md v1, dinamai supaya cek di step() dan
// alokasi di run() tidak menyebar angka mentah ke seluruh berkas.
const MAX_STEPS = 1000000; // langkah maksimum sebelum trap (exit 10)
const STACK_CAP = 256;     // kedalaman maksimum tumpukan data
const CALL_CAP = 64;       // kedalaman maksimum tumpukan panggil
const OUT_CAP = 65536;     // ukuran maksimum buffer keluaran, dalam byte

// [byte immediate, pops, pushes] per opcode.
const TBL: Record<number, number[]> = {
  0: [0, 0, 0], 1: [1, 0, 1], 2: [4, 0, 1], 3: [0, 1, 0], 4: [0, 1, 2],
  5: [0, 2, 2], 6: [0, 2, 3], 7: [0, 3, 3],
  16: [0, 2, 1], 17: [0, 2, 1], 18: [0, 2, 1], 19: [0, 2, 1],
  20: [0, 2, 1], 21: [0, 2, 1], 22: [0, 2, 1], 23: [0, 1, 1],
  24: [0, 2, 1], 25: [0, 2, 1], 26: [0, 2, 1], 27: [0, 1, 1],
  28: [0, 2, 1], 29: [0, 2, 1], 30: [0, 2, 1],
  32: [0, 2, 1], 33: [0, 2, 1], 34: [0, 2, 1],
  48: [2, 0, 0], 49: [2, 1, 0], 50: [2, 1, 0], 51: [2, 0, 0], 52: [0, 0, 0],
  64: [0, 1, 1], 65: [0, 2, 0],
  80: [0, 1, 0], 81: [0, 1, 0], 82: [0, 0, 1], 83: [0, 1, 0],
};

// Akhiri mesin: set exit, kembalikan null (trampoline berhenti).
function end(s: any, x: number): null { s.exit = x; return null; }

// Thunk dispatcher: fetch + semua cek urutan vm.mjs, lalu kembalikan
// thunk handler instruksi itu.
function step(s: any): any {
  if (s.steps === MAX_STEPS) return end(s, 10);
  const n = s.p.length;
  if (s.pc < 0 || s.pc >= n) return end(s, 9);
  const op = s.p[s.pc], t = TBL[op];
  if (!t) return end(s, 5);
  if (s.pc + t[0] >= n) return end(s, 9);
  s.steps++; s.nx = s.pc + 1 + t[0]; s.pc = s.nx;
  if (s.sp < t[1]) return end(s, 2);
  if (s.sp - t[1] + t[2] > STACK_CAP) return end(s, 3);
  return H[op];
}

// Pembantu thunk biner: f mengembalikan undefined hanya untuk DIV_ZERO.
function bin(s: any, f: (a: number, b: number) => number | undefined): any {
  const b = s.D[s.sp - 1], a = s.D[s.sp - 2], r = f(a, b);
  if (r === undefined) return end(s, 4);
  s.sp -= 2; s.D[s.sp++] = r; return step;
}

function rel(s: any): number {
  return ((s.p[s.nx - 2] | (s.p[s.nx - 1] << 8)) << 16) >> 16;
}

// Satu thunk kecil per instruksi; tiap thunk mengembalikan thunk berikutnya.
const H: Record<number, (s: any) => any> = {
  0: (s) => end(s, 0),
  1: (s) => { s.D[s.sp++] = (s.p[s.nx - 1] << 24) >> 24; return step; },
  2: (s) => { s.D[s.sp++] = s.p[s.nx - 4] | (s.p[s.nx - 3] << 8) | (s.p[s.nx - 2] << 16) | (s.p[s.nx - 1] << 24); return step; },
  3: (s) => { s.sp--; return step; },
  4: (s) => { s.D[s.sp] = s.D[s.sp - 1]; s.sp++; return step; },
  5: (s) => { const t = s.D[s.sp - 1]; s.D[s.sp - 1] = s.D[s.sp - 2]; s.D[s.sp - 2] = t; return step; },
  6: (s) => { s.D[s.sp] = s.D[s.sp - 2]; s.sp++; return step; },
  7: (s) => { const a = s.D[s.sp - 3]; s.D[s.sp - 3] = s.D[s.sp - 2]; s.D[s.sp - 2] = s.D[s.sp - 1]; s.D[s.sp - 1] = a; return step; },
  16: (s) => bin(s, (a, b) => (a + b) | 0),
  17: (s) => bin(s, (a, b) => (a - b) | 0),
  18: (s) => bin(s, (a, b) => Math.imul(a, b)),
  19: (s) => bin(s, (a, b) => b === 0 ? undefined : (a === -2147483648 && b === -1 ? a : (a / b) | 0)),
  20: (s) => bin(s, (a, b) => b === 0 ? undefined : (b === -1 ? 0 : (a % b) | 0)),
  21: (s) => bin(s, (a, b) => b === 0 ? undefined : (Math.floor((a >>> 0) / (b >>> 0)) | 0)),
  22: (s) => bin(s, (a, b) => b === 0 ? undefined : (((a >>> 0) % (b >>> 0)) | 0)),
  23: (s) => { s.D[s.sp - 1] = -s.D[s.sp - 1] | 0; return step; },
  24: (s) => bin(s, (a, b) => a & b),
  25: (s) => bin(s, (a, b) => a | b),
  26: (s) => bin(s, (a, b) => a ^ b),
  27: (s) => { s.D[s.sp - 1] = ~s.D[s.sp - 1]; return step; },
  28: (s) => bin(s, (a, b) => a << (b & 31)),
  29: (s) => bin(s, (a, b) => a >> (b & 31)),
  30: (s) => bin(s, (a, b) => (a >>> (b & 31)) | 0),
  32: (s) => bin(s, (a, b) => (a === b ? 1 : 0)),
  33: (s) => bin(s, (a, b) => (a < b ? 1 : 0)),
  34: (s) => bin(s, (a, b) => ((a >>> 0) < (b >>> 0) ? 1 : 0)),
  48: (s) => { s.pc = s.nx + rel(s); return step; },
  49: (s) => { if (s.D[--s.sp] === 0) s.pc = s.nx + rel(s); return step; },
  50: (s) => { if (s.D[--s.sp] !== 0) s.pc = s.nx + rel(s); return step; },
  51: (s) => { if (s.csp === CALL_CAP) return end(s, 7); s.C[s.csp++] = s.nx; s.pc = s.p[s.nx - 2] | (s.p[s.nx - 1] << 8); return step; },
  52: (s) => { if (s.csp === 0) return end(s, 8); s.pc = s.C[--s.csp]; return step; },
  64: (s) => { const a = s.D[s.sp - 1]; if (a < 0 || a > 255) return end(s, 6); s.D[s.sp - 1] = s.M[a]; return step; },
  65: (s) => { const a = s.D[s.sp - 1], v = s.D[s.sp - 2]; if (a < 0 || a > 255) return end(s, 6); s.sp -= 2; s.M[a] = v; return step; },
  80: (s) => { const by = enc.encode(String(s.D[s.sp - 1])); if (s.ol + by.length > OUT_CAP) return end(s, 11); s.sp--; s.out.set(by, s.ol); s.ol += by.length; return step; },
  81: (s) => { if (s.ol + 1 > OUT_CAP) return end(s, 11); s.out[s.ol++] = s.D[--s.sp] & 255; return step; },
  82: (s) => { s.D[s.sp++] = s.ip < s.inp.length ? s.inp[s.ip++] : -1; return step; },
  83: (s) => end(s, s.D[--s.sp] & 255),
};

// Trampoline: panggil thunk demi thunk sampai thunk mengembalikan null.
function run(p: Uint8Array, inp: Uint8Array): any {
  const s = {
    p, inp, D: new Int32Array(STACK_CAP), sp: 0, C: new Int32Array(CALL_CAP), csp: 0,
    M: new Int32Array(256), out: new Uint8Array(OUT_CAP), ol: 0, ip: 0,
    pc: 0, steps: 0, nx: 0, exit: 0,
  };
  let f: any = step;
  while (f) f = f(s);
  return s;
}

for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out.subarray(0, r.ol));
  writeFileSync(join(O, id, 'exit.txt'), String(r.exit) + '\n');
}
